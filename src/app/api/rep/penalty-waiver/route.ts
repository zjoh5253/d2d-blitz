import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

// Rep requests a no-penalty waiver for abandoning a blitz commitment (Teki #8).
// The blitz manager approves with a reason; an approved waiver makes the
// readiness recompute skip that blitz's misses. One request per (rep, blitz).
const schema = z.object({ blitzId: z.string().min(1), reason: z.string().min(3) });

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const repId = session.user.id;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "A blitz and a reason are required." }, { status: 400 });
    const { blitzId, reason } = parsed.data;

    const waiver = await db.penaltyWaiver.upsert({
      where: { repId_blitzId: { repId, blitzId } },
      create: { repId, blitzId, reason, status: "REQUESTED" },
      // Re-requesting resets a denied/old request back to REQUESTED.
      update: { reason, status: "REQUESTED", decidedById: null, decidedAt: null },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, ...waiver });
  } catch (error) {
    console.error("[POST /api/rep/penalty-waiver]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// The rep's own waiver requests.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const waivers = await db.penaltyWaiver.findMany({
    where: { repId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, blitzId: true, reason: true, status: true, blitz: { select: { name: true } } },
  });
  return NextResponse.json(waivers);
}
