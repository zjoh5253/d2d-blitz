import "dotenv/config"
import * as fs from "node:fs"
import * as path from "node:path"
import { db } from "../src/lib/db"
import { parseCSVText, parseXLSXBuffer } from "../src/lib/lead-import"
import { keyFromFullAddress, applyCustomerSuppression } from "../src/lib/leads/customer-suppression"

// Ingest a carrier/partner customer-address export (e.g. Teki's Chuzo customer
// or installed-account list) into serviced_addresses, so every matching door
// is suppressed across all blitzes — current and future. Source-agnostic: it
// just needs columns it can turn into a street address + ZIP.
//
// Flexible column auto-detection (override with flags if it guesses wrong).
// Run --dry-run first to eyeball the detected columns + sample keys.
//
// Usage:
//   tsx scripts/import-customers-csv.ts <file.csv|.xlsx> --dry-run
//   tsx scripts/import-customers-csv.ts <file> --source chuzo-2026-06-04
//   tsx scripts/import-customers-csv.ts <file> --address-col "Service Address" --zip-col Zip

type Args = {
  file: string
  source: string
  dryRun: boolean
  addressCol?: string
  cityCol?: string
  stateCol?: string
  zipCol?: string
  noSweep: boolean
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { dryRun: false, noSweep: false }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry-run") out.dryRun = true
    else if (a === "--no-sweep") out.noSweep = true
    else if (a === "--source") out.source = argv[++i]
    else if (a === "--address-col") out.addressCol = argv[++i]
    else if (a === "--city-col") out.cityCol = argv[++i]
    else if (a === "--state-col") out.stateCol = argv[++i]
    else if (a === "--zip-col") out.zipCol = argv[++i]
    else positional.push(a)
  }
  if (!positional[0]) {
    console.error("usage: tsx scripts/import-customers-csv.ts <file.csv|.xlsx> [--dry-run] [--source NAME] [--address-col X] [--zip-col Y]")
    process.exit(2)
  }
  out.file = positional[0]
  out.source = out.source ?? `import-${path.basename(positional[0]).replace(/\.[^.]+$/, "")}`
  return out as Args
}

// Find the first header matching any of the given keyword regexes.
function findCol(headers: string[], patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(h))
    if (hit) return hit
  }
  return undefined
}

function loadRows(file: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) throw new Error(`file not found: ${file}`)
  if (/\.xlsx?$/i.test(file)) return parseXLSXBuffer(fs.readFileSync(file))
  return parseCSVText(fs.readFileSync(file, "utf8"))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const rows = loadRows(args.file)
  if (rows.length === 0) { console.log("no rows in file"); return }

  const headers = Object.keys(rows[0])
  // parseCSVText lowercases headers; match case-insensitively regardless.
  const lower = headers // already lowercased by the parsers
  const addressCol = args.addressCol?.toLowerCase()
    ?? findCol(lower, [/service.*addr/i, /install.*addr/i, /customer.*addr/i, /^address$/i, /addr/i, /street/i])
  const cityCol = args.cityCol?.toLowerCase() ?? findCol(lower, [/^city$/i, /city/i, /town/i])
  const stateCol = args.stateCol?.toLowerCase() ?? findCol(lower, [/^state$/i, /^st$/i, /province/i, /region/i])
  const zipCol = args.zipCol?.toLowerCase() ?? findCol(lower, [/zip/i, /postal/i, /post.?code/i])

  console.log(`File: ${args.file}  (${rows.length} rows)`)
  console.log(`Detected columns → address: ${addressCol ?? "—"} | city: ${cityCol ?? "—"} | state: ${stateCol ?? "—"} | zip: ${zipCol ?? "—"}`)
  if (!addressCol) {
    console.error(`\nCouldn't find an address column. Headers: ${headers.join(", ")}\nRe-run with --address-col "<header>" (and --zip-col if needed).`)
    process.exit(1)
  }

  // Build canonical keys. Compose a full address string and reuse the same
  // canonicalizer the suppression engine uses, so keys line up exactly.
  const keys = new Map<string, string>() // key -> raw (for audit)
  let skipped = 0
  for (const r of rows) {
    const street = String(r[addressCol] ?? "").trim()
    const city = cityCol ? String(r[cityCol] ?? "").trim() : ""
    const state = stateCol ? String(r[stateCol] ?? "").trim() : ""
    const zip = zipCol ? String(r[zipCol] ?? "").trim() : ""
    const full = [street, [city, state].filter(Boolean).join(", "), zip].filter(Boolean).join(", ")
    const key = keyFromFullAddress(full)
    if (!key) { skipped++; continue }
    if (!keys.has(key)) keys.set(key, full)
  }

  console.log(`\nUnique customer addresses parsed: ${keys.size}  (skipped ${skipped} with no usable street+zip)`)
  console.log("Sample keys:")
  let n = 0
  for (const [k, raw] of keys) { console.log(`  ${k}   <= ${raw}`); if (++n >= 5) break }

  if (args.dryRun) {
    console.log(`\nDRY RUN — nothing written. Re-run without --dry-run to import as source "${args.source}".`)
    return
  }

  // Upsert into serviced_addresses.
  const entries = [...keys.entries()]
  const CHUNK = 500
  let upserted = 0
  for (let i = 0; i < entries.length; i += CHUNK) {
    await db.$transaction(
      entries.slice(i, i + CHUNK).map(([key, raw]) =>
        db.servicedAddress.upsert({
          where: { addressKey: key },
          create: { addressKey: key, source: args.source, rawAddress: raw.slice(0, 300) },
          update: { source: args.source, rawAddress: raw.slice(0, 300) },
        })
      )
    )
    upserted += Math.min(CHUNK, entries.length - i)
    process.stdout.write(`\r  upserted ${upserted}/${entries.length}`)
  }
  process.stdout.write("\n")
  console.log(`Imported ${keys.size} customer addresses as source "${args.source}".`)

  if (!args.noSweep) {
    console.log("\nRunning suppression sweep...")
    const r = await applyCustomerSuppression({})
    console.log(`Sweep: ${r.knownCustomerKeys} known keys, suppressed ${r.updated} lead(s).`)
    for (const [reason, c] of Object.entries(r.byReason)) console.log(`  ${reason}: ${c}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
