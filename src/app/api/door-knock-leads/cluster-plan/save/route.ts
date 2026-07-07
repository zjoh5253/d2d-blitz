import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { randomUUID } from "node:crypto";

// Persist a draft of the rep-assignment plan so an admin can iterate
// without losing work between sessions. The `assignments` payload is a
// snapshot of the planner UI state at save time — clusters, per-cluster
// rep picks, and lightweight per-point info needed to re-hydrate the
// map without re-running k-means.

const saveSchema = z.object({
  blitzId: z.string().min(1),
  name: z.string().min(1).max(120),
  numReps: z.number().int().min(1).max(50),
  numDays: z.number().int().min(1).max(60).optional(),
  // Opaque to the API; serialized PlannerResult + clusterAssignments.
  assignments: z.unknown(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { blitzId, name, numReps, numDays, assignments } = parsed.data;

    const id = randomUUID();
    await db.$executeRaw`
      INSERT INTO blitz_assignment_plans (
        id, blitz_id, name, num_reps, num_days, assignments, created_by_id, created_at
      ) VALUES (
        ${id}, ${blitzId}, ${name}, ${numReps}, ${numDays ?? null},
        ${JSON.stringify(assignments)}::jsonb, ${session.user.id}, NOW()
      )
    `;
    return NextResponse.json({ id, name });
  } catch (error) {
    console.error("[POST /api/door-knock-leads/cluster-plan/save]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const blitzId = new URL(request.url).searchParams.get("blitzId");
    if (!blitzId) {
      return NextResponse.json({ error: "blitzId required" }, { status: 400 });
    }
    const rows = await db.$queryRaw<
      Array<{ id: string; name: string; num_reps: number; num_days: number | null; assignments: unknown; created_at: Date; applied_at: Date | null }>
    >`
      SELECT id, name, num_reps, num_days, assignments, created_at, applied_at
      FROM blitz_assignment_plans
      WHERE blitz_id = ${blitzId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        numReps: r.num_reps,
        numDays: r.num_days,
        assignments: r.assignments,
        createdAt: r.created_at,
        appliedAt: r.applied_at,
      }))
    );
  } catch (error) {
    console.error("[GET /api/door-knock-leads/cluster-plan/save]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await db.$executeRaw`DELETE FROM blitz_assignment_plans WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/door-knock-leads/cluster-plan/save]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
