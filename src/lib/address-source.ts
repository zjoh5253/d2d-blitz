// Pluggable address discovery: given a US ZIP, return geocoded
// residential pins suitable for door-knock canvassing.
//
// Why this exists: carrier exports (Lockhart AT&T, AR CrowdFiber) ship
// without coords sometimes, OpenAddresses has county-level gaps (Walton
// County GA being the case that prompted this), and any new blitz in a
// new market needs something to canvass. This abstraction lets us swap
// providers as data sources improve.
//
// Selection: ADDRESS_PROVIDER env var picks the implementation.
// Default = "osm" (OpenStreetMap Overpass + Nominatim + Census reverse
// geocode — all free, no API keys). To add a paid provider like Smarty,
// drop it under providers/ and register in getAddressProvider().

export interface DiscoveredAddress {
  lat: number
  lng: number
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  state?: string | null
  zip: string
  externalId?: string | null // provider-specific stable ID for dedup
}

export interface AddressProvider {
  readonly name: string
  discoverAddressesForZip(zip: string): Promise<DiscoveredAddress[]>
}

export async function getAddressProvider(): Promise<AddressProvider> {
  const name = process.env.ADDRESS_PROVIDER || "osm"
  if (name === "osm") {
    const mod = await import("./providers/osm-overpass")
    return mod.osmOverpassProvider
  }
  throw new Error(`Unknown ADDRESS_PROVIDER: ${name}. Supported: osm`)
}
