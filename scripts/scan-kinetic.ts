import "dotenv/config"
import { db } from "../src/lib/db"
import { KineticClient, KineticThrottledError } from "../src/lib/kinetic/availability"
import { keyFromParts } from "../src/lib/leads/customer-suppression"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Populate the KineticAddressStatus cache by checking PENDING-lead addresses
// against gokinetic.com. Cache-only — it does NOT suppress leads; that's the
// suppress-known-customers sweep's job (which reads isCustomer rows here).
//
// Single-IP friendly: one address at a time with a delay + backoff. Prioritizes
// active/live blitzes, dedups by canonical address, and skips addresses already
// scanned within --max-age-days (resumable — safe to re-run / cron).
//
// Usage:
//   tsx scripts/scan-kinetic.ts --limit 25                 # scan 25 fresh addrs
//   tsx scripts/scan-kinetic.ts --blitz <id> --limit 500
//   tsx scripts/scan-kinetic.ts --limit 2000 --min-delay 500

type Args = { limit: number; blitzId?: string; maxAgeDays: number; minDelay: number; cooldown: number }
function parseArgs(argv: string[]): Args {
  // gokinetic throttles a single IP hard (~10 calls then 429). Default to a
  // slow, polite cadence + a long cooldown when throttled. Resumable, so it's
  // fine to run in small chunks / via cron.
  const out: Args = { limit: 25, maxAgeDays: 30, minDelay: 1500, cooldown: 120_000 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--limit") out.limit = parseInt(argv[++i], 10) || out.limit
    else if (a === "--blitz") out.blitzId = argv[++i]
    else if (a === "--max-age-days") out.maxAgeDays = parseInt(argv[++i], 10) || out.maxAgeDays
    else if (a === "--min-delay") out.minDelay = parseInt(argv[++i], 10) || out.minDelay
    else if (a === "--cooldown") out.cooldown = parseInt(argv[++i], 10) || out.cooldown
  }
  return out
}

// Higher = scanned first. Active/live blitzes before planning ones.
const STATUS_PRIORITY: Record<string, number> = {
  ACTIVE: 5, READY: 4, STAFFING: 3, PLANNING: 2, REVIEW: 1, CLOSED: 0,
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  console.log(`limit=${args.limit} blitz=${args.blitzId ?? "ALL"} maxAgeDays=${args.maxAgeDays} minDelay=${args.minDelay}ms\n`)

  const leads = await db.doorKnockLead.findMany({
    where: {
      disposition: "PENDING",
      suppressed: false,
      ...(args.blitzId ? { blitzId: args.blitzId } : {}),
    },
    select: {
      streetNumber: true, streetName: true, city: true, state: true, zip: true,
      blitz: { select: { status: true, name: true } },
    },
  })

  // Dedup by canonical address key; keep one representative + its blitz priority.
  type Rep = { key: string; line1: string; city: string; state: string; zip: string; prio: number }
  const byKey = new Map<string, Rep>()
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

  const client = new KineticClient({ minDelayMs: args.minDelay })
  let scanned = 0, serviceable = 0, customers = 0, errors = 0, throttleStreak = 0
  const t0 = Date.now()
  for (let idx = 0; idx < todo.length; idx++) {
    const r = todo[idx]
    try {
      const s = await client.check({ addressLine1: r.line1, city: r.city, state: r.state, postalCode: r.zip })
      await db.kineticAddressStatus.upsert({
        where: { addressKey: r.key },
        create: {
          addressKey: r.key, serviceable: s.serviceable, isCustomer: s.isCustomer, comingSoon: s.comingSoon,
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
      scanned++
      throttleStreak = 0
      if (s.serviceable) serviceable++
      if (s.isCustomer) customers++
    } catch (e) {
      if (e instanceof KineticThrottledError) {
        throttleStreak++
        if (throttleStreak >= 5) {
          console.log(`\nPersistent throttling after ${throttleStreak} cooldowns — stopping. Re-run later (resumable).`)
          break
        }
        process.stdout.write(`\r  throttled — cooling down ${(args.cooldown / 1000).toFixed(0)}s (streak ${throttleStreak})...            `)
        await sleep(args.cooldown)
        idx-- // retry this same address after the cooldown
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
  if (customers > 0) console.log(`Run suppress-known-customers.ts to hide the ${customers} customer addresses from reps.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
