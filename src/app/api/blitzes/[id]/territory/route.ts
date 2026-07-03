import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { activateRepOnBlitz } from "@/lib/blitz-activation";

// In-Staffing territory assignment (#1). GET returns counts, or the lead points
// for the embedded map (?leads=1). POST assigns leads to a claimed rep — which
// activates them + starts gates — by explicit leadIds (map box-select) or by a
// count (quick share). Passing leadIds with no repId unassigns them.
// Admin / FIELD_MANAGER only.

const MAP_LEAD_CAP = 5000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  if (new URL(request.url).searchParams.get("leads") === "1") {
    const leads = await db.doorKnockLead.findMany({
      where: { blitzId: id, suppressed: false, lat: { not: null }, lng: { not: null } },
      select: { id: true, lat: true, lng: true, streetNumber: true, streetName: true, assignedRepId: true },
      take: MAP_LEAD_CAP,
    });
    return NextResponse.json({
      leads: leads.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, street: `${l.streetNumber} ${l.streetName}`, assignedRepId: l.assignedRepId })),
      capped: leads.length >= MAP_LEAD_CAP,
    });
  }

  const [knockable, unassigned] = await Promise.all([
    db.doorKnockLead.count({ where: { blitzId: id, suppressed: false } }),
    db.doorKnockLead.count({ where: { blitzId: id, suppressed: false, assignedRepId: null } }),
  ]);
  return NextResponse.json({ knockable, unassigned });
}

const postSchema = z.object({
  repId: z.string().optional(), // omit to unassign the given leads
  leadIds: z.array(z.string()).optional(),
  count: z.coerce.number().int().positive().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: blitzId } = await params;
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { repId, leadIds, count } = parsed.data;

    // Resolve the target leads: explicit selection from the map, or the next
    // `count` unassigned leads (ordered by location for rough contiguity).
    let ids: string[];
    if (leadIds && leadIds.length) {
      ids = leadIds;
    } else if (repId && count) {
      const leads = await db.doorKnockLead.findMany({
        where: { blitzId, suppressed: false, assignedRepId: null },
        select: { id: true },
        orderBy: [{ lat: "asc" }, { lng: "asc" }],
        take: count,
      });
      ids = leads.map((l) => l.id);
    } else {
      return NextResponse.json({ error: "Provide leadIds or a repId + count." }, { status: 400 });
    }
    if (ids.length === 0) return NextResponse.json({ error: "No leads to assign." }, { status: 400 });

    // Only touch this blitz's leads (guards against cross-blitz id spoofing).
    const res = await db.doorKnockLead.updateMany({
      where: { id: { in: ids }, blitzId },
      data: { assignedRepId: repId ?? null },
    });

    const activated = repId ? await activateRepOnBlitz(blitzId, repId, session.user.id) : false;
    return NextResponse.json({ ok: true, assigned: res.count, activated });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/territory]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
