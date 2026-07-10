import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getAddressProvider } from "@/lib/address-source"

const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "d2d-blitz/1.0 (+https://d2d-blitz-navy.vercel.app)"

export interface AreaCandidate {
  zip: string
  city: string
  state: string
  addressCount: number
  inventoryReady: boolean
  // True for any valid 5-digit ZIP: even with no pre-loaded inventory we can
  // pull addresses on-demand at create time (OSM fallback), so the UI lets the
  // user select it.
  discoverable: boolean
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

export async function inventoryForZip(zip: string): Promise<AreaCandidate | null> {
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
    discoverable: true,
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
    discoverable: true,
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
      discoverable: true,
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
      discoverable: true,
    }]
  }

  const { town, state } = parseTownQuery(query)
  const inventoryResults = await searchInventoryByTown(town, state)
  if (inventoryResults.length > 0) return inventoryResults
  return searchNominatim(query)
}

// scanner_addresses.zip_code has an FK to scanner_zips(zip_code); the parent
// row must exist before inserting addresses. Idempotent.
async function ensureZipParent(
  zip: string,
  state: string,
  city: string | null,
  client: Prisma.TransactionClient | typeof db = db
): Promise<void> {
  await client.$executeRawUnsafe(
    `INSERT INTO scanner_zips (zip_code, state, city)
     VALUES ($1, $2, $3)
     ON CONFLICT (zip_code) DO UPDATE
       SET state = COALESCE(NULLIF(EXCLUDED.state, ''), scanner_zips.state),
           city  = COALESCE(scanner_zips.city, EXCLUDED.city)`,
    zip, state, city
  )
}

export interface EnsureInventoryResult {
  zip: string
  addressCount: number
  source: "cache" | "osm"
}

// Guarantee that `scanner_addresses` holds usable inventory for a ZIP, pulling
// it on-demand if it's empty. ZIPs we've pre-loaded from OpenAddresses (the
// good, fully-addressed data) hit the cache path. Anything else falls back to
// the OSM provider — we keep only pins with a real house number + street, since
// the create flow's street regex and the gokinetic customer filter both require
// one (street-less OSM pins would be silently dropped downstream anyway).
export async function ensureInventoryForZip(
  rawZip: string,
  opts: { skipReverseGeocode?: boolean } = {}
): Promise<EnsureInventoryResult> {
  const zip = normalizeZip(rawZip)
  if (zip.length !== 5) throw new Error("A valid 5-digit ZIP is required")

  const existing = await inventoryForZip(zip)
  if (existing && existing.addressCount > 0) {
    return { zip, addressCount: existing.addressCount, source: "cache" }
  }

  const provider = await getAddressProvider()
  const discovered = await provider.discoverAddressesForZip(zip, { skipReverseGeocode: opts.skipReverseGeocode })
  const usable = discovered.filter((a) => a.streetNumber && a.streetName)
  if (usable.length === 0) {
    return { zip, addressCount: 0, source: "osm" }
  }

  // Parent ZIP row — best-effort state/city from the discovered pins.
  const state = (usable.find((a) => a.state)?.state ?? "").toUpperCase()
  const city = usable.find((a) => a.city)?.city ?? null
  await ensureZipParent(zip, state, city ? city.toUpperCase() : null)

  // Bulk insert in batches via multi-row VALUES. kind is the literal 'LEAD'
  // (unknown-typed → coerced to the enum). De-dup on the PK so re-runs no-op.
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < usable.length; i += CHUNK) {
    const slice = usable.slice(i, i + CHUNK)
    const tuples: string[] = []
    const params: unknown[] = []
    slice.forEach((a, j) => {
      const b = j * 8
      tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},'LEAD',NOW(),NOW())`)
      params.push(
        `osm_${a.externalId ?? `${zip}_${a.streetNumber}_${a.streetName}`}`.replace(/\s+/g, "_").slice(0, 200),
        `${a.streetNumber} ${a.streetName}`.toUpperCase(),
        (a.city ?? city ?? "").toUpperCase(),
        (a.state ?? state ?? "").toUpperCase(),
        // Always store under the requested ZIP — the OSM bbox spans neighboring
        // ZIPs, and only this ZIP's scanner_zips parent is guaranteed to exist.
        zip,
        a.lat,
        a.lng,
        a.externalId ?? null,
      )
    })
    inserted += await db.$executeRawUnsafe(
      `INSERT INTO scanner_addresses
         (id, street, city, state, zip_code, lat, lng, external_id, kind, created_at, updated_at)
       VALUES ${tuples.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      ...params
    )
  }

  const after = await inventoryForZip(zip)
  return { zip, addressCount: after?.addressCount ?? inserted, source: "osm" }
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
  // MDU model (docs/MDU_MODEL_SPEC.md): a building with MORE than this many
  // distinct units collapses to ONE leasing-office lead (honest knock count),
  // tagged with its unit count. Buildings at/under it keep individual doors.
  const MDU_UNIT_THRESHOLD = 4
  const imported = await client.$executeRaw`
    WITH addr AS (
      SELECT
        TRIM(a.street) AS street,
        UPPER(TRIM(a.street)) AS street_key,
        COALESCE(NULLIF(TRIM(a.unit), ''), '') AS unit,
        COALESCE(NULLIF(TRIM(a.city), ''), '') AS city,
        COALESCE(NULLIF(TRIM(a.state), ''), '') AS state,
        a.zip_code AS zip,
        a.lat,
        a.lng,
        a.id
      FROM scanner_addresses a
      WHERE a.zip_code = ${zip}
        AND a.street IS NOT NULL
        AND TRIM(a.street) ~ '^[0-9]+[A-Za-z-]*[[:space:]]+.+'
        AND a.lat IS NOT NULL
        AND a.lng IS NOT NULL
    ),
    unit_counts AS (
      SELECT street_key, count(DISTINCT unit) FILTER (WHERE unit <> '') AS unit_n
      FROM addr GROUP BY street_key
    ),
    -- Big complexes (> threshold units): one leasing-office lead per building.
    mdu AS (
      SELECT DISTINCT ON (a.street_key)
        a.street, ''::text AS unit, a.city, a.state, a.zip, a.lat, a.lng,
        TRUE AS is_mdu, uc.unit_n::int AS unit_count
      FROM addr a JOIN unit_counts uc ON uc.street_key = a.street_key
      WHERE uc.unit_n > ${MDU_UNIT_THRESHOLD}
      ORDER BY a.street_key, a.id
    ),
    -- Single-family + small multiplexes (<= threshold): one lead per unit/door.
    nonmdu AS (
      SELECT DISTINCT ON (a.street_key, a.unit)
        a.street, a.unit, a.city, a.state, a.zip, a.lat, a.lng,
        FALSE AS is_mdu, NULL::int AS unit_count
      FROM addr a JOIN unit_counts uc ON uc.street_key = a.street_key
      WHERE uc.unit_n <= ${MDU_UNIT_THRESHOLD}
      ORDER BY a.street_key, a.unit, a.id
    ),
    source AS (
      SELECT * FROM mdu UNION ALL SELECT * FROM nonmdu
    )
    INSERT INTO door_knock_leads (
      id, first_name, last_name, street_number, street_name, city, state, zip,
      lat, lng, disposition, notes, assigned_rep_id, blitz_id, suppressed,
      suppression_reason, is_mdu, unit_count, uploaded_by_id, upload_batch_id,
      created_at, updated_at
    )
    SELECT
      gen_random_uuid()::text,
      NULL,
      NULL,
      SUBSTRING(source.street FROM '^([0-9]+[A-Za-z-]*)'),
      REGEXP_REPLACE(source.street, '^[0-9]+[A-Za-z-]*[[:space:]]+', '') ||
        CASE WHEN source.unit = '' THEN ''
             WHEN source.unit ~ '^[0-9]' THEN ' Unit ' || source.unit
             ELSE ' ' || source.unit END,
      source.city,
      source.state,
      source.zip,
      source.lat,
      source.lng,
      'PENDING',
      CASE WHEN source.is_mdu
           THEN 'Source: Map Scanner (apartment/MDU — ' || source.unit_count::text || ' units — knock the leasing office)'
           ELSE 'Source: Map Scanner address inventory' END,
      NULL,
      ${opts.blitzId},
      FALSE,
      NULL,
      source.is_mdu,
      source.unit_count,
      ${opts.uploadedById},
      ${uploadBatchId},
      NOW(),
      NOW()
    FROM source
  `

  return { imported, uploadBatchId }
}
