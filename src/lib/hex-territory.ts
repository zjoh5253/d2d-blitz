import { latLngToCell, cellToLatLng, gridDisk } from "h3-js"

// Hex-grid territory planning. Splits a blitz's leads into K territories where
// each rep's hexes are CONTIGUOUS (touching) — a rep never has to cross another
// rep's turf to reach their own. Done by partitioning the hex adjacency graph
// via balanced region-growing (each region only ever claims an ADJACENT hex),
// which guarantees connected territories, unlike clustering the raw points.

export const HEX_RES = 8 // ~town-scale hexes; must match the hex map

interface LeadPt { id: string; lat: number; lng: number }

/**
 * Returns one array of leadIds per region (region i → reps[i]). Regions are
 * contiguous and balanced by lead count.
 */
export function planContiguousTerritories(leads: LeadPt[], k: number, res: number = HEX_RES): string[][] {
  if (k <= 0) return []
  // Group leads into hexes.
  const hexLeads = new Map<string, string[]>()
  for (const l of leads) {
    const h = latLngToCell(l.lat, l.lng, res)
    const arr = hexLeads.get(h)
    if (arr) arr.push(l.id)
    else hexLeads.set(h, [l.id])
  }
  const hexes = [...hexLeads.keys()]
  if (hexes.length === 0) return Array.from({ length: k }, () => [])
  if (k === 1) return [leads.map((l) => l.id)]

  const count = (h: string) => hexLeads.get(h)!.length
  const centroid = new Map(hexes.map((h) => [h, cellToLatLng(h)] as const)) // [lat, lng]
  const dist2 = (a: string, b: string) => {
    const [la, ga] = centroid.get(a)!, [lb, gb] = centroid.get(b)!
    const dl = la - lb, dg = ga - gb
    return dl * dl + dg * dg
  }

  // Adjacency between populated hexes only.
  const hexSet = new Set(hexes)
  const nbrs = new Map<string, string[]>()
  for (const h of hexes) nbrs.set(h, gridDisk(h, 1).filter((n) => n !== h && hexSet.has(n)))

  // Seeds: farthest-point sampling so regions start spread out.
  const K = Math.min(k, hexes.length)
  const seeds: string[] = [hexes[0]]
  while (seeds.length < K) {
    let best = "", bestD = -1
    for (const h of hexes) {
      if (seeds.includes(h)) continue
      let d = Infinity
      for (const s of seeds) d = Math.min(d, dist2(h, s))
      if (d > bestD) { bestD = d; best = h }
    }
    seeds.push(best)
  }

  // Balanced region growing: the lowest-load region with room claims its
  // nearest adjacent unclaimed hex. Only adjacent hexes → regions stay connected.
  const region = new Map<string, number>()
  const load: number[] = []
  const frontier: Set<string>[] = []
  seeds.forEach((s, i) => {
    region.set(s, i); load[i] = count(s)
    frontier[i] = new Set(nbrs.get(s)!.filter((n) => !region.has(n)))
  })
  let claimed = seeds.length
  while (claimed < hexes.length) {
    let ri = -1, minLoad = Infinity
    for (let i = 0; i < seeds.length; i++) {
      for (const f of [...frontier[i]]) if (region.has(f)) frontier[i].delete(f)
      if (frontier[i].size && load[i] < minLoad) { minLoad = load[i]; ri = i }
    }
    if (ri === -1) break // remaining hexes are disconnected from every region
    let pick = "", pd = Infinity
    for (const f of frontier[ri]) { const d = dist2(f, seeds[ri]); if (d < pd) { pd = d; pick = f } }
    region.set(pick, ri); load[ri] += count(pick); claimed++
    frontier[ri].delete(pick)
    for (const n of nbrs.get(pick)!) if (!region.has(n)) frontier[ri].add(n)
  }

  // True islands (no path to any seed) go to the geographically nearest region.
  for (const h of hexes) {
    if (region.has(h)) continue
    let ri = 0, bd = Infinity
    for (let i = 0; i < seeds.length; i++) { const d = dist2(h, seeds[i]); if (d < bd) { bd = d; ri = i } }
    region.set(h, ri)
  }

  const out: string[][] = Array.from({ length: k }, () => [])
  for (const [h, r] of region) out[r].push(...hexLeads.get(h)!)
  return out
}
