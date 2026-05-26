import * as XLSX from "xlsx"

// Shared parsing + normalization for door-knock lead imports.
// Used by both the admin upload route (src/app/api/door-knock-leads/import)
// and CLI scripts that bulk-ingest carrier-provided lead lists.

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function parseCSVText(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ""
    })
    rows.push(row)
  }
  return rows
}

export function parseXLSXBuffer(buf: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
  return rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(r)) out[k.toLowerCase().trim()] = r[k]
    return out
  })
}

function extractCityState(raw: string): { city: string; state: string } {
  const parts = raw.split(",").map((p) => p.trim())
  if (parts.length >= 2) return { city: parts[0], state: parts[1] }
  return { city: raw.trim(), state: "" }
}

function splitAddress(raw: string): { streetNumber: string; streetName: string } {
  const trimmed = raw.trim()
  const m = trimmed.match(/^(\d+\w*)\s+(.+)$/)
  if (m) return { streetNumber: m[1], streetName: m[2].trim() }
  return { streetNumber: "", streetName: trimmed }
}

function coerceString(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v).trim()
}

function coerceNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export interface NormalizedLead {
  firstName: string | null
  lastName: string | null
  streetNumber: string
  streetName: string
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  notes: string | null
  disposition: "PENDING"
  uploadedById: string
  uploadBatchId: string
  blitzId: string | null
}

export interface ImportContext {
  uploadedById: string
  uploadBatchId: string
  blitzId: string | null
}

export function normalizeRow(
  row: Record<string, unknown>,
  ctx: ImportContext
): NormalizedLead | null {
  // CrowdFiber-style imports flag "Bad Address" rows the carrier doesn't
  // want hit — skip them entirely.
  if (coerceString(row["bad address"])) return null

  // Two address layouts in the wild:
  //   (a) single combined `Address` field — CrowdFiber, most carrier exports
  //   (b) separate street number / street name fields — our seed CSV format
  const combinedAddr = coerceString(row["address"] ?? row["street address"])
  let streetNumber = coerceString(
    row["street number"] ?? row["streetnumber"] ?? row["street_number"] ?? row["address number"]
  )
  let streetName = coerceString(
    row["street name"] ?? row["streetname"] ?? row["street_name"] ?? row["street"]
  )
  if (!streetNumber && !streetName && combinedAddr) {
    const split = splitAddress(combinedAddr)
    streetNumber = split.streetNumber
    streetName = split.streetName
  }
  if (!streetNumber && !streetName) return null

  let city = coerceString(row["city"])
  let state = coerceString(row["state"])
  if (city.includes(",")) {
    const ex = extractCityState(city)
    city = ex.city
    state = state || ex.state
  }

  const zip = coerceString(
    row["zip"] ?? row["zipcode"] ?? row["zip code"] ?? row["zip_code"] ?? row["postal"]
  )

  const lat = coerceNum(row["lat"] ?? row["latitude"])
  // CrowdFiber uses `lon`; our existing convention is `lng`. Accept both.
  const lng = coerceNum(row["lng"] ?? row["lon"] ?? row["longitude"])

  // Pack CrowdFiber context fields into notes so the rep sees them in-app.
  const extraBits: string[] = []
  const pon = coerceString(row["pon name"] ?? row["pon"])
  const zone = coerceString(row["zone"])
  const inService = coerceString(row["in service date"])
  if (pon) extraBits.push(`PON: ${pon}`)
  if (zone) extraBits.push(`Zone: ${zone}`)
  if (inService) extraBits.push(`In service: ${inService}`)
  const userNotes = coerceString(row["notes"])
  const combinedNotes = [userNotes, extraBits.join(" · ")].filter(Boolean).join(" — ")

  return {
    firstName: coerceString(row["first name"] ?? row["firstname"] ?? row["first_name"]) || null,
    lastName: coerceString(row["last name"] ?? row["lastname"] ?? row["last_name"]) || null,
    streetNumber,
    streetName,
    city,
    state,
    zip,
    lat,
    lng,
    notes: combinedNotes || null,
    disposition: "PENDING",
    uploadedById: ctx.uploadedById,
    uploadBatchId: ctx.uploadBatchId,
    blitzId: ctx.blitzId,
  }
}

export function generateUploadBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
