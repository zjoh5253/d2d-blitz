import Papa from "papaparse";
import * as XLSX from "xlsx";

// Unified file ingestion for install reports. Turns an uploaded CSV / XLSX
// into normalized tabular data (headers + string rows), or a PDF into base64
// for Claude to read natively as a document block. The AI layer
// (ai-extract.ts) consumes whichever shape this produces.

export type TabularData = { headers: string[]; rows: Record<string, string>[] };

export type IngestResult =
  | { kind: "tabular"; format: "csv" | "xlsx"; data: TabularData }
  | { kind: "pdf"; base64: string };

export type FileFormat = "csv" | "xlsx" | "pdf" | "unknown";

export function detectFormat(fileName: string, mimeType?: string): FileFormat {
  const name = fileName.toLowerCase();
  const mt = (mimeType || "").toLowerCase();
  if (name.endsWith(".pdf") || mt === "application/pdf") return "pdf";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || mt.includes("spreadsheetml") || mt.includes("ms-excel"))
    return "xlsx";
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") || mt.includes("csv") || mt === "text/plain")
    return "csv";
  return "unknown";
}

// Coerce a sheet_to_json result into uniform string rows + a stable header list.
function toTabular(rows: Record<string, unknown>[]): TabularData {
  const headerSet: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        headerSet.push(k);
      }
    }
  }
  const stringRows = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const h of headerSet) {
      const v = row[h];
      out[h] = v == null ? "" : String(v).trim();
    }
    return out;
  });
  return { headers: headerSet, rows: stringRows };
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const fmt = detectFormat(file.name, file.type);

  if (fmt === "pdf") {
    const buf = Buffer.from(await file.arrayBuffer());
    return { kind: "pdf", base64: buf.toString("base64") };
  }

  if (fmt === "xlsx") {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // raw:false formats dates/numbers as display strings; defval keeps blanks.
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    return { kind: "tabular", format: "xlsx", data: toTabular(json) };
  }

  // CSV / TSV / plain text → PapaParse with header row.
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = (parsed.meta.fields ?? []).map((h) => h.trim());
  const rows = (parsed.data ?? []).map((r) => {
    const out: Record<string, string> = {};
    for (const h of headers) out[h] = (r[h] ?? "").toString().trim();
    return out;
  });
  return { kind: "tabular", format: "csv", data: { headers, rows } };
}

// Lenient date parser for the varied formats carriers use (MM/DD/YYYY,
// YYYY-MM-DD, "Jan 5 2026", Excel-formatted strings, etc.). Returns null when
// unparseable so the caller can flag the record instead of inventing a date.
export function parseLooseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Try MM/DD/YYYY or M-D-YY explicitly (Date() is inconsistent across runtimes).
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    let year = parseInt(yy, 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const dt = new Date(year, parseInt(mm, 10) - 1, parseInt(dd, 10));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}
