import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { activateRepOnBlitz } from "@/lib/blitz-activation";

// In-Staffing territory assignment (#1): assign a share of the blitz's
// unassigned knockable leads to a claimed rep, which activates them + starts
// their gates — so a manager never has to leave the Staffing tab. The full
// Door-Knocks map stays available for precise geographic carving.
// Admin / FIELD_MANAGER only.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const [knockable, unassigned] = await Promise.all([
    db.doorKnockLead.count({ where: { blitzId: id, suppressed: false } }),
    db.doorKnockLead.count({ where: { blitzId: id, suppressed: false, assignedRepId: null } }),
  ]);
  return NextResponse.json({ knockable, unassigned });
}

const assignSchema = z.object({ repId: z.string().min(1), count: z.coerce.number().int().positive() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id: blitzId } = await params;
    const parsed = assignSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "repId and a positive count are required" }, { status: 400 });
    const { repId, count } = parsed.data;

    // Take the next `count` unassigned knockable leads, ordered by location so a
    // rep's share is roughly contiguous (not scattered across town).
    const leads = await db.doorKnockLead.findMany({
      where: { blitzId, suppressed: false, assignedRepId: null },
      select: { id: true },
      orderBy: [{ lat: "asc" }, { lng: "asc" }],
      take: count,
    });
    if (leads.length === 0) return NextResponse.json({ error: "No unassigned leads left to assign." }, { status: 400 });

    await db.doorKnockLead.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data: { assignedRepId: repId } });
    const activated = await activateRepOnBlitz(blitzId, repId, session.user.id);

    return NextResponse.json({ ok: true, assigned: leads.length, activated });
  } catch (error) {
    console.error("[POST /api/blitzes/:id/territory]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
