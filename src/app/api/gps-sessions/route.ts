import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseISO, startOfDay, endOfDay } from "date-fns";

const createSchema = z.object({
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationSeconds: z.number().int().min(0),
  pausedSeconds: z.number().int().min(0).default(0),
  knockCount: z.number().int().min(0).default(0),
  routeMiles: z.number().min(0).default(0),
  // Optional. When the rep is staffed on exactly one ACTIVE blitz at
  // submission time and the client doesn't pass one, the POST handler
  // auto-attributes via that single assignment.
  blitzId: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repIdParam = searchParams.get("repId");
    const dateParam = searchParams.get("date");

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER";
    const repId = isManager && repIdParam ? repIdParam : session.user.id;

    const where: Record<string, unknown> = { repId };
    if (dateParam) {
      const day = parseISO(dateParam);
      where.startedAt = { gte: startOfDay(day), lte: endOfDay(day) };
    }

    const sessions = await db.gpsSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        // Latest edit request so the history view can show its review state.
        edits: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, reviewNote: true, createdAt: true },
        },
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[GET /api/gps-sessions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Auto-attribute the session to a blitz when the rep is unambiguously
    // on one. An explicit blitzId from the client wins; with 0 or >1
    // active assignments we leave it null and the scorecard falls back
    // to date-overlap for those rows.
    let blitzId: string | null = data.blitzId ?? null;
    if (!blitzId) {
      const active = await db.blitzAssignment.findMany({
        where: {
          repId: session.user.id!,
          blitz: { status: { in: ["READY", "ACTIVE", "REVIEW"] } },
        },
        select: { blitzId: true },
      });
      if (active.length === 1) blitzId = active[0].blitzId;
    }

    const created = await db.gpsSession.create({
      data: {
        repId: session.user.id,
        blitzId,
        startedAt: parseISO(data.startedAt),
        endedAt: parseISO(data.endedAt),
        durationSeconds: data.durationSeconds,
        pausedSeconds: data.pausedSeconds,
        knockCount: data.knockCount,
        routeMiles: data.routeMiles,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/gps-sessions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
