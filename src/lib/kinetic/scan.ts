import { db } from "@/lib/db"
import { KineticClient, KineticThrottledError } from "@/lib/kinetic/availability"
import { keyFromParts } from "@/lib/leads/customer-suppression"

// Core gokinetic scanning loop, extracted so both the CLI (scripts/scan-kinetic.ts)
// and the create-blitz "prepare" endpoint can drive it. Populates the
// KineticAddressStatus cache by checking PENDING-lead addresses against
// gokinetic.com (through the IP Royal proxy when configured). Cache-only — it
// does NOT suppress leads; the suppress-known-customers sweep reads isCustomer
// rows from here.
//
// Single-IP friendly: one address at a time with a delay + backoff. Prioritizes
// active/live blitzes, dedups by canonical address, and skips addresses already
// scanned within maxAgeDays (resumable — safe to re-run / poll in batches).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type ScanArgs = {
  limit: number
  blitzId?: string
  maxAgeDays: number
  minDelay: number
  cooldown: number
  kineticOnly: boolean
  maxThrottleStreak?: number
  // >1 fans the scan out across N concurrent gokinetic sessions. Only safe
  // with a ROTATING residential proxy (IP Royal) — each worker gets its own
  // session/route so we don't hammer a single IP. Default 1 = the original
  // sequential, single-IP-polite behavior used by the CLI + cron.
  concurrency?: number
}

export type ScanResult = { scanned: number; serviceable: number; customers: number; errors: number }

type ScanRep = { key: string; line1: string; city: string; state: string; zip: string; prio: number }

// Upsert one scanned address into the KineticAddressStatus cache.
async function cacheStatus(key: string, s: Awaited<ReturnType<KineticClient["check"]>>) {
  await db.kineticAddressStatus.upsert({
    where: { addressKey: key },
    create: {
      addressKey: key, serviceable: s.serviceable, isCustomer: s.isCustomer, comingSoon: s.comingSoon,
      validationResult: s.validationResult, maxQual: s.maxQual, techType: s.techType,
      billingStatus: s.billingStatus, estCompletionDt: s.estCompletionDt, raw: s.raw,
    },
    update: {
      serviceable: s.serviceable, isCustomer: s.isCustomer, comingSoon: s.comingSoon,
      validationResult: s.validationResult, maxQual: s.maxQual, techType: s.techType,
      billingStatus: s.billingStatus, estCompletionDt: s.estCompletionDt, raw: s.raw,
      checkedAt: new Date(),
    },
  })
}

// Fan the scan out across N concurrent gokinetic sessions (one KineticClient
// per worker → independent session + rotating IP Royal route). A throttled
// (429) address is skipped — it stays uncached and gets retried on the next
// poll/cron tick. If throttling becomes pervasive we stop pulling new work so
// the run ends fast and the background path can recover.
async function runParallel(todo: ScanRep[], args: ScanArgs, concurrency: number): Promise<ScanResult> {
  let scanned = 0, serviceable = 0, customers = 0, errors = 0, throttled = 0
  let next = 0
  let stop = false
  const throttleCap = args.maxThrottleStreak ?? 12
  const t0 = Date.now()

  const worker = async () => {
    const client = new KineticClient({ minDelayMs: args.minDelay })
    while (!stop) {
      const i = next++ // atomic: no await between read and increment
      if (i >= todo.length) break
      const r = todo[i]
      try {
        const s = await client.check({ addressLine1: r.line1, city: r.city, state: r.state, postalCode: r.zip })
        await cacheStatus(r.key, s)
        scanned++
        if (s.serviceable) serviceable++
        if (s.isCustomer) customers++
      } catch (e) {
        if (e instanceof KineticThrottledError) {
          throttled++
          if (throttled >= throttleCap) stop = true
          continue // skip; uncached → retried next run
        }
        errors++
        if (errors >= 20) stop = true
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`[parallel x${concurrency}] ${secs}s — scanned ${scanned}, serviceable ${serviceable}, customers ${customers}, throttled ${throttled}, errors ${errors}`)
  return { scanned, serviceable, customers, errors }
}

// Higher = scanned first. Active/live blitzes before planning ones.
const STATUS_PRIORITY: Record<string, number> = {
  ACTIVE: 5, READY: 4, STAFFING: 3, PLANNING: 2, REVIEW: 1, CLOSED: 0,
}

export async function runScan(args: ScanArgs): Promise<ScanResult | undefined> {
  console.log(`limit=${args.limit} blitz=${args.blitzId ?? "ALL"} kineticOnly=${args.kineticOnly} maxAgeDays=${args.maxAgeDays} minDelay=${args.minDelay}ms\n`)

  const leads = await db.doorKnockLead.findMany({
    where: {
      disposition: "PENDING",
      suppressed: false,
      ...(args.blitzId ? { blitzId: args.blitzId } : {}),
      // gokinetic only matters for blitzes selling Kinetic — skip Rightfiber /
      // AT&T blitzes so we don't waste the IP's throttle budget on them.
      ...(args.kineticOnly
        ? { blitz: { market: { carrier: { name: { contains: "Kinetic", mode: "insensitive" } } } } }
        : {}),
    },
    select: {
      streetNumber: true, streetName: true, city: true, state: true, zip: true,
      blitz: { select: { status: true, name: true } },
    },
  })

  // Dedup by canonical address key; keep one representative + its blitz priority.
  const byKey = new Map<string, ScanRep>()
  for (const l of leads) {
    const key = keyFromParts(l.streetNumber, l.streetName, l.zip)
    if (!key) continue
    const prio = STATUS_PRIORITY[l.blitz?.status ?? ""] ?? 0
    const existing = byKey.get(key)
    if (!existing || prio > existing.prio) {
      byKey.set(key, {
        key,
        line1: `${l.streetNumber} ${l.streetName}`.trim(),
        city: l.city, state: l.state, zip: (l.zip || "").replace(/\D/g, "").slice(0, 5),
        prio,
      })
    }
  }

  // Skip addresses already scanned recently.
  const cutoff = new Date(Date.now() - args.maxAgeDays * 86_400_000)
  const allKeys = [...byKey.keys()]
  const fresh = await db.kineticAddressStatus.findMany({
    where: { addressKey: { in: allKeys }, checkedAt: { gte: cutoff } },
    select: { addressKey: true },
  })
  const freshSet = new Set(fresh.map((f) => f.addressKey))

  const todo = [...byKey.values()]
    .filter((r) => !freshSet.has(r.key))
    .sort((a, b) => b.prio - a.prio)
    .slice(0, args.limit)

  console.log(`unique addresses: ${byKey.size} | already fresh: ${freshSet.size} | scanning: ${todo.length}\n`)
  if (todo.length === 0) { console.log("nothing to scan."); return }

  const concurrency = Math.max(1, args.concurrency ?? 1)
  if (concurrency > 1) return runParallel(todo, args, concurrency)

  const client = new KineticClient({ minDelayMs: args.minDelay })
  let scanned = 0, serviceable = 0, customers = 0, errors = 0, throttleStreak = 0
  const t0 = Date.now()
  for (let idx = 0; idx < todo.length; idx++) {
    const r = todo[idx]
    try {
      const s = await client.check({ addressLine1: r.line1, city: r.city, state: r.state, postalCode: r.zip })
      await cacheStatus(r.key, s)
      scanned++
      throttleStreak = 0
      if (s.serviceable) serviceable++
      if (s.isCustomer) customers++
    } catch (e) {
      if (e instanceof KineticThrottledError) {
        throttleStreak++
        // Bail once the streak hits the cap. With maxThrottleStreak=1 (the
        // cron) we stop on the FIRST throttle WITHOUT any cooldown, so the
        // long gap between ticks lets the IP recover. Default (5) preserves the
        // cooldown-and-retry behavior for manual/CLI runs.
        if (throttleStreak >= (args.maxThrottleStreak ?? 5)) {
          console.log(`\nThrottled ${throttleStreak}x — stopping this run (resumable; retries next run).`)
          break
        }
        if (args.cooldown > 0) {
          process.stdout.write(`\r  throttled — cooling down ${(args.cooldown / 1000).toFixed(0)}s (streak ${throttleStreak})...            `)
          await sleep(args.cooldown)
        }
        idx-- // retry this same address
        continue
      }
      errors++
      if (errors <= 3) console.log(`  error on ${r.line1}, ${r.city}: ${e instanceof Error ? e.message : e}`)
      if (errors >= 20) { console.log("\nToo many non-throttle errors — stopping."); break }
    }
    if (scanned % 10 === 0 && scanned > 0) {
      const rate = ((Date.now() - t0) / scanned / 1000).toFixed(1)
      process.stdout.write(`\r  scanned ${scanned}/${todo.length} · ${serviceable} serviceable · ${customers} customers · ${rate}s/addr            `)
    }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`\n\nDone in ${secs}s — scanned ${scanned}, serviceable ${serviceable}, customers ${customers}, errors ${errors}`)
  return { scanned, serviceable, customers, errors }
}
