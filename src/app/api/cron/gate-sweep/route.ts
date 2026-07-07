import { NextRequest, NextResponse } from "next/server";
import { sweepGates } from "@/lib/gate-sweep";

// Periodic gate sweep (spec §11.1 background job): marks overdue gates missed
// and applies the auto-reopen / escalation consequences. Schedule every ~5 min.
// Auth mirrors the other crons: Bearer CRON_SECRET or ?token=CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  const auth = request.headers.get("authorization");
  const token = new URL(request.url).searchParams.get("token");
  if (auth !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepGates();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[GET /api/cron/gate-sweep]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
