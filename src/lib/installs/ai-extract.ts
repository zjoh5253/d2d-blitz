import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, AI_MODEL } from "@/lib/ai/client";
import type { IngestResult, TabularData } from "./ingest";

// AI-powered install-report extraction. Two strategies:
//
//  1. TABULAR (CSV/XLSX): we don't send every row to the model. We send the
//     headers + a few sample rows and ask Claude for a COLUMN MAPPING (which
//     columns hold the customer name, the service address, the install date,
//     the carrier order id). Then we apply that mapping to all N rows in
//     code — token cost is flat regardless of file size, and it scales to
//     thousands of rows. This replaces the old manual column-mapping UI.
//
//  2. DOCUMENT (PDF / unstructured): no reliable column structure, so we hand
//     the file to Claude (PDFs as a native document block — it reads scanned
//     ones via vision too) and have it extract records directly.
//
// Either way the output is a list of { customerName, customerAddress,
// installDate, externalId, confidence } that feeds the matcher.

export type ExtractedRecord = {
  customerName: string;
  customerAddress: string;
  installDate: string; // as-found; normalized to a Date at persist time
  externalId: string | null;
  rep: string | null; // sales rep / agent who sold it, as named in the report
  status: string | null; // order/install status text (ORDER COMPLETE, CANCELLED, …)
  confidence: number; // 0–1
};

export type ExtractionResult = {
  records: ExtractedRecord[];
  method: "tabular-mapping" | "document";
  // For tabular: which columns were mapped (for the UI to show its work).
  mapping?: ColumnMapping;
  notes: string | null;
};

const SYSTEM_PROMPT = `You are a data-extraction engine for a door-to-door sales company. Carriers (AT&T, Kinetic, Rightfiber, etc.) send "install reports" — lists of addresses where internet service was actually installed — in wildly inconsistent formats. Your job is to normalize them so they can be reconciled against the sales our reps logged.

Rules:
- A "record" is one installed service location: a customer name, a full service address, and an install/activation date.
- The service address is the physical address where service was installed — NOT a billing address or PO box if both appear. Include unit/apt when present.
- "Install date" may be labeled activation date, service date, completed date, turn-up date, etc. Pick the date the service went live.
- "External id" is any carrier-side order/account/work-order number that identifies the install.
- "Rep" is the sales rep / agent / dealer who sold the order — look for columns like Rep, Agent, Sold By, Salesperson, AgentId. Return the person's name (strip parentheticals like "(Teki)" and AgentId/email noise; keep the human name).
- "Status" is the order/install status text if present (e.g. ORDER COMPLETE, ACTIVATED, PENDING INSTALLATION, CANCELLED, READY FOR TECH DISPATCH).
- Be conservative with confidence: 1.0 = unambiguous, 0.5 = a reasonable guess, <0.3 = highly uncertain. Never fabricate a value — if a field is absent, leave it empty/null rather than inventing one.
- Ignore summary rows, totals, headers repeated mid-file, and blank separator rows.`;

// ---- Tabular: column mapping ----------------------------------------------

const ColumnMappingSchema = z.object({
  // Arrays so split columns (Street #, Street Name, City, State, Zip) can be
  // concatenated in order. Empty array = field not present.
  customerName: z.array(z.string()),
  customerAddress: z.array(z.string()),
  installDate: z.string().nullable(),
  externalId: z.string().nullable(),
  rep: z.string().nullable(),
  status: z.string().nullable(),
  confidence: z.number(),
  notes: z.string().nullable(),
});

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export async function inferColumnMapping(data: TabularData): Promise<ColumnMapping> {
  const sample = data.rows.slice(0, 5);
  const client = getAnthropic();
  const userText = `Here is an install report's column headers and the first ${sample.length} data rows.

HEADERS: ${JSON.stringify(data.headers)}

SAMPLE ROWS:
${JSON.stringify(sample, null, 2)}

Identify which column(s) map to each target field. Return the EXACT header strings (copy them verbatim from HEADERS). For customerName and customerAddress, return an ordered array of the columns to concatenate (e.g. ["Street #","Street Name","City","State","Zip"] for a split address, or ["Service Address"] for a combined one). For installDate, externalId, rep (the sales rep/agent column), and status (order/install status column), return a single header string or null if absent.`;

  const res = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
    output_config: { format: zodOutputFormat(ColumnMappingSchema) },
  });

  const mapping = res.parsed_output;
  if (!mapping) throw new Error("AI column mapping failed (no parsed output)");

  // Defensive: drop any column names the model hallucinated that aren't real headers.
  const valid = new Set(data.headers);
  const clean = (cols: string[]) => cols.filter((c) => valid.has(c));
  return {
    ...mapping,
    customerName: clean(mapping.customerName),
    customerAddress: clean(mapping.customerAddress),
    installDate: mapping.installDate && valid.has(mapping.installDate) ? mapping.installDate : null,
    externalId: mapping.externalId && valid.has(mapping.externalId) ? mapping.externalId : null,
    rep: mapping.rep && valid.has(mapping.rep) ? mapping.rep : null,
    status: mapping.status && valid.has(mapping.status) ? mapping.status : null,
  };
}

// Apply an inferred mapping to every row — pure code, no tokens.
export function applyMapping(mapping: ColumnMapping, data: TabularData): ExtractedRecord[] {
  const join = (cols: string[], row: Record<string, string>) =>
    cols
      .map((c) => (row[c] ?? "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  const out: ExtractedRecord[] = [];
  for (const row of data.rows) {
    const customerName = join(mapping.customerName, row);
    const customerAddress = join(mapping.customerAddress, row);
    const installDate = mapping.installDate ? (row[mapping.installDate] ?? "").trim() : "";
    const externalId = mapping.externalId ? (row[mapping.externalId] ?? "").trim() || null : null;
    const rep = mapping.rep ? (row[mapping.rep] ?? "").trim() || null : null;
    const status = mapping.status ? (row[mapping.status] ?? "").trim() || null : null;
    // Skip blank/summary rows that have neither a name nor an address.
    if (!customerName && !customerAddress) continue;
    out.push({ customerName, customerAddress, installDate, externalId, rep, status, confidence: mapping.confidence });
  }
  return out;
}

// ---- Document: direct extraction (PDF / unstructured) ---------------------

const DocumentRecordsSchema = z.object({
  records: z.array(
    z.object({
      customerName: z.string(),
      customerAddress: z.string(),
      installDate: z.string(),
      externalId: z.string().nullable(),
      rep: z.string().nullable(),
      status: z.string().nullable(),
      confidence: z.number(),
    })
  ),
  notes: z.string().nullable(),
});

export async function extractFromDocument(
  source: { kind: "pdf"; base64: string } | { kind: "text"; text: string }
): Promise<{ records: ExtractedRecord[]; notes: string | null }> {
  const client = getAnthropic();
  const instruction =
    "Extract every installed service location from this install report as a structured record. Skip totals, headers, and blank rows.";

  const content =
    source.kind === "pdf"
      ? [
          {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: source.base64 },
          },
          { type: "text" as const, text: instruction },
        ]
      : [{ type: "text" as const, text: `${instruction}\n\nREPORT:\n${source.text}` }];

  const res = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(DocumentRecordsSchema) },
  });

  const parsed = res.parsed_output;
  if (!parsed) throw new Error("AI document extraction failed (no parsed output)");
  return { records: parsed.records, notes: parsed.notes };
}

// ---- Unified entry point ---------------------------------------------------

export async function extractInstallRecords(ingest: IngestResult): Promise<ExtractionResult> {
  if (ingest.kind === "pdf") {
    const { records, notes } = await extractFromDocument({ kind: "pdf", base64: ingest.base64 });
    return { records, method: "document", notes };
  }

  // Tabular: infer mapping once, apply to all rows.
  const mapping = await inferColumnMapping(ingest.data);
  // If the model couldn't find name/address columns, fall back to handing the
  // whole sheet to the document extractor as text (handles weird layouts where
  // the "headers" aren't really headers).
  if (mapping.customerAddress.length === 0 && mapping.customerName.length === 0) {
    const asText = [ingest.data.headers.join("\t"), ...ingest.data.rows.map((r) => ingest.data.headers.map((h) => r[h]).join("\t"))].join("\n");
    const { records, notes } = await extractFromDocument({ kind: "text", text: asText });
    return { records, method: "document", notes: notes ?? mapping.notes };
  }
  const records = applyMapping(mapping, ingest.data);
  return { records, method: "tabular-mapping", mapping, notes: mapping.notes };
}
