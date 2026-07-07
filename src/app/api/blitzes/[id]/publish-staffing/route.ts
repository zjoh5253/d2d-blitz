import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWebPush } from "@/lib/push";

// "Finish & notify reps": finalize staffing. Stamps staffing_published_at (which
// lets check-in pings start) and pushes each ACTIVE rep a "you're confirmed"
// notification. Nothing pings reps before this, so setup mistakes stay silent.
// Admin / FIELD_MANAGER only.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const blitz = await db.blitz.findUnique({ where: { id }, select: { name: true } });
    if (!blitz) return NextResponse.json({ error: "Blitz not found" }, { status: 404 });

    await db.blitz.update({ where: { id }, data: { staffingPublishedAt: new Date() } });

    // Push each confirmed (ACTIVE) rep. Re-publishing re-notifies (idempotent flag).
    const active = await db.blitzSignup.findMany({ where: { blitzId: id, status: "ACTIVE" }, select: { repId: true } });
    const repIds = active.map((s) => s.repId);

    let sent = 0;
    const wp = getWebPush();
    if (wp && repIds.length) {
      const subs = await db.pushSubscription.findMany({ where: { repId: { in: repIds } }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
      const payload = JSON.stringify({ title: "You're confirmed for a blitz", body: `${blitz.name} — you're on the crew. Check your territory + check-ins.`, url: "/rep/board?tab=mine", tag: `blitz-confirmed-${id}` });
      for (const s of subs) {
        try {
          await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          sent++;
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true, confirmed: repIds.length, pushed: sent });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/publish-staffing]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
