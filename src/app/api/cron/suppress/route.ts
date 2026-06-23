import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { applyCustomerSuppression } from "@/lib/leads/customer-suppression"
import { advanceBlitzFiltering } from "@/lib/blitz-prep"

// Scheduled suppression sweep + lead-filtering backstop.
//
// 1. applyCustomerSuppression (DB-only): a SOLD lead / new Sale / new
//    InstallRecord → its address is hidden across other PENDING leads; new-blitz
//    leads matching an already-known customer get hidden immediately.
// 2. Backstop the create-flow filter: advance any blitz still in FILTERING by
//    scanning a batch through the rotating IP Royal proxy and persisting
//    progress, so a blitz finishes filtering (and becomes staffable) even if no
//    admin has the app open. Bounded per tick to stay under the function limit.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; we also accept
// `?token=<CRON_SECRET>` so any external cron service can trigger it.

export const maxDuration = 60

// Keep within the function time budget: a couple of blitzes, modest batch each.
const MAX_BLITZES_PER_TICK = 2
const BATCH_PER_BLITZ = 100

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  }
  const auth = request.headers.get("authorization")
  const token = new URL(request.url).searchParams.get("token")
  if (auth !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const suppression = await applyCustomerSuppression({})

  // Oldest-progress-first so every filtering blitz gets a turn across ticks.
  const filtering = await db.blitz.findMany({
    where: { leadPrepStatus: "FILTERING" },
    select: { id: true },
    orderBy: [{ leadPrepUpdatedAt: { sort: "asc", nulls: "first" } }],
    take: MAX_BLITZES_PER_TICK,
  })

  const advanced = []
  for (const b of filtering) {
    const r = await advanceBlitzFiltering(b.id, { batch: BATCH_PER_BLITZ })
    if (r) advanced.push({ blitzId: r.blitzId, scanned: r.scanned, pending: r.pending, status: r.leadPrepStatus })
  }

  return NextResponse.json({ ok: true, suppression, advanced })
}
