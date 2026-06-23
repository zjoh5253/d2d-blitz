import type { AddressProvider, DiscoveredAddress } from "../address-source"

// OSM-based address discovery:
//   1. Resolve ZIP to a bounding box via OSM Nominatim
//   2. Query Overpass for all building footprints in the bbox
//   3. For each building, prefer OSM addr:* tags; fall back to Census
//      reverse-geocode when tags are missing
//
// Free, no API keys. OSM has strict User-Agent + rate-limit etiquette;
// failure modes show up as 429s or 503s. For our usage (one ZIP per
// blitz, occasional) we stay well under any limits.

const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const OVERPASS = "https://overpass-api.de/api/interpreter"
const CENSUS_REVERSE = "https://geocoding.geo.census.gov/geocoder/locations/coordinates"

// OSM bans generic User-Agents. Identify the app explicitly.
const USER_AGENT = "d2d-blitz/1.0 (+https://d2d-blitz-navy.vercel.app)"

// Reverse-geocode concurrency. Census API is fast and unmetered for
// reasonable volumes; we processed 212 forward-geocodes at 8-way concurrency
// without throttling.
const REVERSE_CONCURRENCY = 8

interface NominatimResult {
  boundingbox: [string, string, string, string] // [south, north, west, east]
  display_name: string
}

interface BBox {
  south: number
  north: number
  west: number
  east: number
}

async function getZipBoundingBox(zip: string): Promise<BBox | null> {
  const params = new URLSearchParams({
    postalcode: zip,
    country: "us",
    format: "json",
    limit: "1",
  })
  const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status} for ZIP ${zip}`)
  const data = (await res.json()) as NominatimResult[]
  if (!data.length) return null
  const [south, north, west, east] = data[0].boundingbox.map(parseFloat)
  return { south, north, west, east }
}

interface OverpassElement {
  id: number
  type: "node" | "way" | "relation"
  center?: { lat: number; lon: number }
  lat?: number
  lon?: number
  tags?: Record<string, string>
}

async function queryOverpassBuildings(bbox: BBox): Promise<DiscoveredAddress[]> {
  // Pull all building footprints — residential filtering happens at rep
  // canvass time. We grab nodes + ways because OSM has both styles.
  const q = `
    [out:json][timeout:90];
    (
      way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      node["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out center tags;
  `
  // Overpass intermittently returns 504/429 under load. Two retries with
  // backoff is usually enough to ride through the bad minute.
  let lastErr: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(OVERPASS, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
        body: q,
      })
      if (res.ok) {
        const data = (await res.json()) as { elements: OverpassElement[] }
        return parseOverpassElements(data.elements)
      }
      lastErr = new Error(`Overpass HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (attempt < 3) {
      const wait = attempt * 15000
      console.log(`  Overpass attempt ${attempt} failed; retrying in ${wait / 1000}s`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass exhausted retries")
}

function parseOverpassElements(elements: OverpassElement[]): DiscoveredAddress[] {
  const out: DiscoveredAddress[] = []
  for (const e of elements) {
    const lat = e.center?.lat ?? e.lat
    const lng = e.center?.lon ?? e.lon
    if (lat == null || lng == null) continue
    const t = e.tags ?? {}
    out.push({
      lat,
      lng,
      streetNumber: t["addr:housenumber"] ?? null,
      streetName: t["addr:street"] ?? null,
      city: t["addr:city"] ?? null,
      state: t["addr:state"] ?? null,
      zip: t["addr:postcode"] ?? "",
      externalId: `osm-${e.type}-${e.id}`,
    })
  }
  return out
}

interface CensusReverseResult {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string
      addressComponents?: {
        fromAddress?: string
        streetName?: string
        suffixType?: string
        city?: string
        state?: string
        zip?: string
      }
    }>
  }
}

async function reverseGeocodeOne(
  lat: number,
  lng: number
): Promise<Partial<DiscoveredAddress> | null> {
  const params = new URLSearchParams({
    x: String(lng),
    y: String(lat),
    benchmark: "Public_AR_Current",
    format: "json",
  })
  const res = await fetch(`${CENSUS_REVERSE}?${params.toString()}`)
  if (!res.ok) return null
  const data = (await res.json()) as CensusReverseResult
  const m = data.result?.addressMatches?.[0]
  if (!m) return null
  const c = m.addressComponents ?? {}
  const streetName = [c.streetName, c.suffixType].filter(Boolean).join(" ").trim() || null
  return {
    streetNumber: c.fromAddress ?? null,
    streetName,
    city: c.city ?? null,
    state: c.state ?? null,
    zip: c.zip ?? "",
  }
}

async function enrichMissingAddressesViaCensus(
  addresses: DiscoveredAddress[],
  fallbackZip: string
): Promise<DiscoveredAddress[]> {
  // Pins that already have housenumber + street from OSM tags don't need
  // reverse geocoding. Most US OSM data outside core cities lacks these.
  const needsReverse: number[] = []
  for (let i = 0; i < addresses.length; i++) {
    const a = addresses[i]
    if (!a.streetNumber || !a.streetName) needsReverse.push(i)
  }
  if (needsReverse.length === 0) return addresses

  let done = 0
  for (let i = 0; i < needsReverse.length; i += REVERSE_CONCURRENCY) {
    const batch = needsReverse.slice(i, i + REVERSE_CONCURRENCY)
    await Promise.all(
      batch.map(async (idx) => {
        const a = addresses[idx]
        try {
          const enriched = await reverseGeocodeOne(a.lat, a.lng)
          if (enriched) {
            addresses[idx] = { ...a, ...enriched, zip: enriched.zip || a.zip || fallbackZip }
          }
        } catch {
          /* leave as-is */
        } finally {
          done++
        }
      })
    )
    if (done % 50 === 0 || done === needsReverse.length) {
      process.stdout.write(`\r  reverse-geocoded ${done}/${needsReverse.length}`)
    }
  }
  process.stdout.write("\n")
  return addresses
}

async function discover(zip: string, opts?: { skipReverseGeocode?: boolean }): Promise<DiscoveredAddress[]> {
  const bbox = await getZipBoundingBox(zip)
  if (!bbox) throw new Error(`OSM Nominatim returned no result for ZIP ${zip}`)
  console.log(`  bbox: S=${bbox.south} W=${bbox.west} N=${bbox.north} E=${bbox.east}`)

  const buildings = await queryOverpassBuildings(bbox)
  console.log(`  OSM returned ${buildings.length} building elements`)

  // Census reverse-geocoding is the slow part. When skipped (on-demand path
  // running inside a request/tick), we keep only the OSM-tagged pins — fewer,
  // but no risk of timing out.
  const enriched = opts?.skipReverseGeocode
    ? buildings
    : await enrichMissingAddressesViaCensus(buildings, zip)
  const matched = enriched.filter((a) => a.streetNumber || a.streetName).length
  console.log(`  ${matched}/${enriched.length} pins have resolved street info${opts?.skipReverseGeocode ? " (reverse-geocode skipped)" : ""}`)

  return enriched.map((a) => ({ ...a, zip: a.zip || zip }))
}

export const osmOverpassProvider: AddressProvider = {
  name: "osm-overpass",
  discoverAddressesForZip: discover,
}
