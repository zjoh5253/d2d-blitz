import { NextRequest, NextResponse } from "next/server"
import { applyCustomerSuppression } from "@/lib/leads/customer-suppression"

// Scheduled suppression sweep. DB-only (no external calls), so it runs fine
// from the cloud and persists customer-hiding automatically:
//   - a lead marked SOLD / a new Sale / a new InstallRecord → its address is
//     suppressed across any other PENDING leads on the next tick
//   - new-blitz leads whose address is an already-known customer (incl.
//     gokinetic-cached billingStatus=A) get hidden immediately
//
// The gokinetic SCAN that discovers NEW customers needs a residential IP and
// runs separately (scripts/kinetic-cron.ts on a residential box). This route
// is the reliable always-on half.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; we also accept
// `?token=<CRON_SECRET>` so any external cron service can trigger it.

export const maxDuration = 60

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

  const r = await applyCustomerSuppression({})
  return NextResponse.json({ ok: true, ...r })
}
