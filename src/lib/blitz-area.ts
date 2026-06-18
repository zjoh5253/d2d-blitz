import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "d2d-blitz/1.0 (+https://d2d-blitz-navy.vercel.app)"

export interface AreaCandidate {
  zip: string
  city: string
  state: string
  addressCount: number
  inventoryReady: boolean
}

interface InventoryRow {
  zip: string
  city: string | null
  state: string
  addressCount: number
}

interface NominatimResult {
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    postcode?: string
    country_code?: string
    "ISO3166-2-lvl4"?: string
  }
}

function normalizeZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5)
}

function parseTownQuery(query: string): { town: string; state: string } {
  const parts = query.split(",").map((part) => part.trim()).filter(Boolean)
  return {
    town: parts[0] ?? query.trim(),
    state: (parts[1] ?? "").toUpperCase(),
  }
}

async function inventoryForZip(zip: string): Promise<AreaCandidate | null> {
  const rows = await db.$queryRaw<InventoryRow[]>`
    SELECT
      a.zip_code AS zip,
      MAX(NULLIF(a.city, '')) AS city,
      MAX(a.state) AS state,
      COUNT(DISTINCT UPPER(TRIM(a.street)))::int AS "addressCount"
    FROM scanner_addresses a
    WHERE a.zip_code = ${zip}
      AND a.street IS NOT NULL
      AND TRIM(a.street) <> ''
      AND TRIM(a.street) ~ '^[0-9]+[A-Za-z-]*[[:space:]]+.+'
      AND a.lat IS NOT NULL
      AND a.lng IS NOT NULL
    GROUP BY a.zip_code
  `
  const row = rows[0]
  if (!row) return null
  return {
    zip: row.zip,
    city: row.city ?? "",
    state: row.state,
    addressCount: row.addressCount,
    inventoryReady: row.addressCount > 0,
  }
}

async function searchInventoryByTown(town: string, state: string): Promise<AreaCandidate[]> {
  const townPattern = `%${town.toUpperCase()}%`
  const rows = state
    ? await db.$queryRaw<InventoryRow[]>`
        SELECT
          a.zip_code AS zip,
          MAX(NULLIF(a.city, '')) AS city,
          MAX(a.state) AS state,
          COUNT(DISTINCT UPPER(TRIM(a.street)))::int AS "addressCount"
        FROM scanner_addresses a
        WHERE UPPER(a.city) LIKE ${townPattern}
          AND UPPER(a.state) = ${state}
          AND a.street IS NOT NULL
          AND TRIM(a.street) <> ''
          AND TRIM(a.street) ~ '^[0-9]+[A-Za-z-]*[[:space:]]+.+'
          AND a.lat IS NOT NULL
          AND a.lng IS NOT NULL
        GROUP BY a.zip_code
        ORDER BY "addressCount" DESC
        LIMIT 20
      `
    : await db.$queryRaw<InventoryRow[]>`
        SELECT
          a.zip_code AS zip,
          MAX(NULLIF(a.city, '')) AS city,
          MAX(a.state) AS state,
          COUNT(DISTINCT UPPER(TRIM(a.street)))::int AS "addressCount"
        FROM scanner_addresses a
        WHERE UPPER(a.city) LIKE ${townPattern}
          AND a.street IS NOT NULL
          AND TRIM(a.street) <> ''
          AND TRIM(a.street) ~ '^[0-9]+[A-Za-z-]*[[:space:]]+.+'
          AND a.lat IS NOT NULL
          AND a.lng IS NOT NULL
        GROUP BY a.zip_code
        ORDER BY "addressCount" DESC
        LIMIT 20
      `

  return rows.map((row) => ({
    zip: row.zip,
    city: row.city ?? town,
    state: row.state,
    addressCount: row.addressCount,
    inventoryReady: row.addressCount > 0,
  }))
}

async function searchNominatim(query: string): Promise<AreaCandidate[]> {
  const { town, state } = parseTownQuery(query)
  const params = new URLSearchParams({
    city: town,
    country: "us",
    format: "json",
    addressdetails: "1",
    limit: "10",
  })
  if (state) params.set("state", state)

  const response = await fetch(`${NOMINATIM}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 86_400 },
  })
  if (!response.ok) throw new Error(`Location search failed: HTTP ${response.status}`)

  const results = (await response.json()) as NominatimResult[]
  const byZip = new Map<string, AreaCandidate>()
  for (const result of results) {
    const address = result.address
    if (!address || address.country_code !== "us") continue
    const zip = normalizeZip(address.postcode ?? "")
    if (zip.length !== 5 || byZip.has(zip)) continue
    const inventory = await inventoryForZip(zip)
    const stateCode = address["ISO3166-2-lvl4"]?.replace("US-", "") ?? state
    byZip.set(zip, inventory ?? {
      zip,
      city: address.city ?? address.town ?? address.village ?? address.municipality ?? town,
      state: stateCode || address.state || "",
      addressCount: 0,
      inventoryReady: false,
    })
  }
  return [...byZip.values()]
}

export async function searchBlitzAreas(rawQuery: string): Promise<AreaCandidate[]> {
  const query = rawQuery.trim()
  const zip = normalizeZip(query)
  if (/^\d{5}$/.test(query) && zip.length === 5) {
    const inventory = await inventoryForZip(zip)
    if (inventory) return [inventory]

    const params = new URLSearchParams({
      postalcode: zip,
      country: "us",
      format: "json",
      addressdetails: "1",
      limit: "1",
    })
    const response = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86_400 },
    })
    const results = response.ok ? (await response.json()) as NominatimResult[] : []
    const address = results[0]?.address
    return [{
      zip,
      city: address?.city ?? address?.town ?? address?.village ?? "",
      state: address?.["ISO3166-2-lvl4"]?.replace("US-", "") ?? address?.state ?? "",
      addressCount: 0,
      inventoryReady: false,
    }]
  }

  const { town, state } = parseTownQuery(query)
  const inventoryResults = await searchInventoryByTown(town, state)
  if (inventoryResults.length > 0) return inventoryResults
  return searchNominatim(query)
}

export async function importScannerInventory(opts: {
  zip: string
  blitzId: string
  uploadedById: string
  dbClient?: Prisma.TransactionClient
}): Promise<{ imported: number; uploadBatchId: string }> {
  const zip = normalizeZip(opts.zip)
  if (zip.length !== 5) throw new Error("A valid 5-digit ZIP is required")

  const uploadBatchId = `area_${Date.now()}_${randomUUID().slice(0, 8)}`
  const client = opts.dbClient ?? db
  const imported = await client.$executeRaw`
    WITH source AS (
      SELECT DISTINCT ON (UPPER(TRIM(a.street)))
        TRIM(a.street) AS street,
        COALESCE(NULLIF(TRIM(a.city), ''), '') AS city,
        COALESCE(NULLIF(TRIM(a.state), ''), '') AS state,
        a.zip_code AS zip,
        a.lat,
        a.lng
      FROM scanner_addresses a
      WHERE a.zip_code = ${zip}
        AND a.street IS NOT NULL
        AND TRIM(a.street) ~ '^[0-9]+[A-Za-z-]*[[:space:]]+.+'
        AND a.lat IS NOT NULL
        AND a.lng IS NOT NULL
      ORDER BY UPPER(TRIM(a.street)), a.id
    )
    INSERT INTO door_knock_leads (
      id,
      first_name,
      last_name,
      street_number,
      street_name,
      city,
      state,
      zip,
      lat,
      lng,
      disposition,
      notes,
      assigned_rep_id,
      blitz_id,
      suppressed,
      suppression_reason,
      uploaded_by_id,
      upload_batch_id,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid()::text,
      NULL,
      NULL,
      SUBSTRING(source.street FROM '^([0-9]+[A-Za-z-]*)'),
      REGEXP_REPLACE(source.street, '^[0-9]+[A-Za-z-]*[[:space:]]+', ''),
      source.city,
      source.state,
      source.zip,
      source.lat,
      source.lng,
      'PENDING',
      'Source: Map Scanner address inventory',
      NULL,
      ${opts.blitzId},
      FALSE,
      NULL,
      ${opts.uploadedById},
      ${uploadBatchId},
      NOW(),
      NOW()
    FROM source
  `

  return { imported, uploadBatchId }
}
