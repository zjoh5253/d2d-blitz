import { db } from "@/lib/db"

// Resolve a Market for a carrier + state, creating the Carrier and/or Market
// when they don't exist yet. Used by the "Create blitz" auto-flow from the
// map-scanner monopoly buttons so ANY carrier (not just the ones we've already
// set up markets for) can spin up a blitz. New carriers get revenuePerInstall=0
// (edit later); only Kinetic blitzes get the customer filter downstream.

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

export async function resolveOrCreateMarket(opts: {
  carrierSlug?: string
  carrierName: string
  state: string
  ownerId: string
}): Promise<string> {
  const stateName = STATE_NAMES[opts.state.toUpperCase()] ?? opts.state
  const brand = opts.carrierName.trim().toLowerCase()
  const slug = (opts.carrierSlug ?? "").trim().toLowerCase()

  // 1. Reuse an existing market for this carrier + state (matches Kinetic's
  //    per-state markets, e.g. "Kinetic Ohio").
  const markets = await db.market.findMany({
    select: { id: true, name: true, carrier: { select: { name: true } } },
  })
  const existing = markets.find((m) => {
    const cn = m.carrier.name.toLowerCase()
    const carrierMatch = cn.includes(brand) || brand.includes(cn) || (slug !== "" && cn.includes(slug))
    return carrierMatch && m.name.toLowerCase().includes(stateName.toLowerCase())
  })
  if (existing) return existing.id

  // 2. Find or create the carrier (loose match so "Kinetic" → "Kinetic by
  //    Windstream"; exact-ish for others).
  let carrier =
    (await db.carrier.findFirst({ where: { name: { equals: opts.carrierName, mode: "insensitive" } } })) ??
    (await db.carrier.findFirst({ where: { name: { contains: opts.carrierName, mode: "insensitive" } } }))
  if (!carrier) {
    carrier = await db.carrier.create({ data: { name: opts.carrierName, revenuePerInstall: 0 } })
  }

  // 3. Create the per-state market.
  const market = await db.market.create({
    data: { name: `${carrier.name} ${stateName}`, carrierId: carrier.id, ownerId: opts.ownerId },
  })
  return market.id
}
