import { db } from "@/lib/db"
import { KineticClient, KineticThrottledError, type KineticStatus } from "@/lib/kinetic/availability"
import { keyFromParts } from "@/lib/leads/customer-suppression"

type ScannerAddress = {
  id: string
  street: string
  unit: string | null
  city: string
  state: string
  zip_code: string
  kind: "PROBE" | "LEAD"
}

type ScanRep = {
  key: string
  line1: string
  city: string
  state: string
  zip: string
}

export type ScannerPoolScanResult = {
  zipsQueued: number
  candidatesConsidered: number
  queued: number
  scanned: number
  serviceable: number
  customers: number
  filtered: number
  throttled: number
  errors: number
}

const MAX_REAL_LEADS_PER_ZIP = 5000
const PREFETCH_PER_ZIP = MAX_REAL_LEADS_PER_ZIP * 2

function splitStreet(street: string): { streetNumber: string; streetName: string } {
  const match = street.trim().match(/^(\S+)\s+(.+)$/)
  if (!match) return { streetNumber: "", streetName: street }
  const [, first, rest] = match
  if (/^\d/.test(first)) return { streetNumber: first, streetName: rest }
  return { streetNumber: "", streetName: street }
}

async function getKineticScannerZips(limit: number): Promise<string[]> {
  const readyRows = await db.$queryRaw<Array<{ zip_code: string }>>`
    SELECT DISTINCT sm.zip_code
    FROM scanner_markets sm
    WHERE sm.is_blitz_ready = true
      AND EXISTS (
        SELECT 1
        FROM scanner_addresses a
        WHERE a.zip_code = sm.zip_code
          AND a.kind = 'LEAD'
      )
    ORDER BY sm.zip_code ASC
    LIMIT ${limit}
  `

  let monopolyRows: Array<{ zip_code: string }> = []
  const monopolyTable = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.carrier_monopolies') IS NOT NULL AS exists
  `
  if (monopolyTable[0]?.exists) {
    monopolyRows = await db.$queryRaw<Array<{ zip_code: string }>>`
      SELECT DISTINCT zip_code
      FROM carrier_monopolies
      WHERE provider_slug = 'kinetic'
      ORDER BY zip_code ASC
      LIMIT ${limit}
    `
  }

  return [...new Set([...readyRows, ...monopolyRows].map((r) => r.zip_code))].slice(0, limit)
}

async function getScannerAddressesForZip(zip: string): Promise<ScannerAddress[]> {
  return db.$queryRaw<ScannerAddress[]>`
    SELECT id, street, unit, city, state, zip_code, kind
    FROM (
      SELECT
        a.id, a.street, a.unit, a.city, a.state, a.zip_code, a.kind,
        row_number() OVER (
          PARTITION BY a.kind
          ORDER BY a.street ASC, a.unit ASC NULLS FIRST, a.id ASC
        ) AS rn
      FROM scanner_addresses a
      WHERE a.zip_code = ${zip}
        AND a.kind IN ('PROBE', 'LEAD')
    ) selected
    WHERE kind = 'PROBE' OR rn <= ${PREFETCH_PER_ZIP}
    ORDER BY zip_code ASC, kind DESC, street ASC, unit ASC NULLS FIRST, id ASC
  `
}

async function cacheStatus(key: string, status: KineticStatus): Promise<void> {
  await db.kineticAddressStatus.upsert({
    where: { addressKey: key },
    create: {
      addressKey: key,
      serviceable: status.serviceable,
      isCustomer: status.isCustomer,
      comingSoon: status.comingSoon,
      validationResult: status.validationResult,
      maxQual: status.maxQual,
      techType: status.techType,
      billingStatus: status.billingStatus,
      estCompletionDt: status.estCompletionDt,
      raw: status.raw,
    },
    update: {
      serviceable: status.serviceable,
      isCustomer: status.isCustomer,
      comingSoon: status.comingSoon,
      validationResult: status.validationResult,
      maxQual: status.maxQual,
      techType: status.techType,
      billingStatus: status.billingStatus,
      estCompletionDt: status.estCompletionDt,
      raw: status.raw,
      checkedAt: new Date(),
    },
  })
}

async function collectTodo(opts: {
  limit: number
  maxAgeDays: number
  zipLimit: number
}): Promise<{ zipsQueued: number; candidatesConsidered: number; todo: ScanRep[] }> {
  const zips = await getKineticScannerZips(opts.zipLimit)
  const cutoff = new Date(Date.now() - opts.maxAgeDays * 86_400_000)
  const byKey = new Map<string, ScanRep>()
  let candidatesConsidered = 0

  for (const zip of zips) {
    if (byKey.size >= opts.limit * 3) break
    const addresses = await getScannerAddressesForZip(zip)
    candidatesConsidered += addresses.length
    const keys = new Map<string, ScanRep>()
    for (const address of addresses) {
      const { streetNumber, streetName } = splitStreet(address.street)
      const fullStreet = address.unit ? `${streetName} ${address.unit}` : streetName
      const key = keyFromParts(streetNumber, fullStreet, address.zip_code)
      if (!key || keys.has(key) || byKey.has(key)) continue
      keys.set(key, {
        key,
        line1: `${streetNumber} ${fullStreet}`.trim(),
        city: address.city,
        state: address.state,
        zip: address.zip_code.replace(/\D/g, "").slice(0, 5),
      })
    }

    const keyList = [...keys.keys()]
    const fresh = keyList.length
      ? await db.kineticAddressStatus.findMany({
          where: { addressKey: { in: keyList }, checkedAt: { gte: cutoff } },
          select: { addressKey: true },
        })
      : []
    const freshSet = new Set(fresh.map((r) => r.addressKey))
    for (const [key, rep] of keys) {
      if (!freshSet.has(key)) byKey.set(key, rep)
      if (byKey.size >= opts.limit) break
    }
  }

  return {
    zipsQueued: zips.length,
    candidatesConsidered,
    todo: [...byKey.values()].slice(0, opts.limit),
  }
}

export async function scanKineticScannerPool(opts: {
  limit?: number
  concurrency?: number
  maxAgeDays?: number
  zipLimit?: number
  minDelayMs?: number
} = {}): Promise<ScannerPoolScanResult> {
  const limit = Math.max(1, opts.limit ?? 150)
  const concurrency = Math.max(1, opts.concurrency ?? 10)
  const maxAgeDays = Math.max(1, opts.maxAgeDays ?? 30)
  const zipLimit = Math.max(1, opts.zipLimit ?? 50)
  const minDelayMs = Math.max(0, opts.minDelayMs ?? 100)
  const { zipsQueued, candidatesConsidered, todo } = await collectTodo({ limit, maxAgeDays, zipLimit })

  let scanned = 0
  let serviceable = 0
  let customers = 0
  let filtered = 0
  let throttled = 0
  let errors = 0
  let next = 0
  let stop = false

  const worker = async () => {
    const client = new KineticClient({ minDelayMs })
    while (!stop) {
      const i = next++
      if (i >= todo.length) break
      const address = todo[i]
      try {
        const status = await client.check({
          addressLine1: address.line1,
          city: address.city,
          state: address.state,
          postalCode: address.zip,
        })
        await cacheStatus(address.key, status)
        scanned++
        if (status.serviceable && !status.isCustomer) serviceable++
        if (status.isCustomer) customers++
        if (status.isCustomer || status.comingSoon || !status.serviceable) filtered++
      } catch (error) {
        if (error instanceof KineticThrottledError) {
          throttled++
          if (throttled >= 12) stop = true
          continue
        }
        errors++
        if (errors >= 20) stop = true
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()))

  return {
    zipsQueued,
    candidatesConsidered,
    queued: todo.length,
    scanned,
    serviceable,
    customers,
    filtered,
    throttled,
    errors,
  }
}
