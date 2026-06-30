/**
 * GET  /api/gps-sessions          — list the authenticated rep's own GPS sessions
 *                                    (optional ?date=YYYY-MM-DD filter on startedAt)
 * POST /api/gps-sessions          — create a GPS session for the authenticated rep
 *
 * Auth: mobile Bearer token (falls back to web session via getSessionFromRequest).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  pausedSeconds: z.number().int().nonnegative().optional(),
  knockCount: z.number().int().nonnegative().optional(),
  routeMiles: z.number().nonnegative().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = new URL(request.url).searchParams.get("date");
    let startedAtFilter: { gte: Date; lt: Date } | undefined;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      startedAtFilter = { gte: start, lt: end };
    }

    const sessions = await db.gpsSession.findMany({
      where: {
        repId: session.user.id,
        ...(startedAtFilter ? { startedAt: startedAtFilter } : {}),
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("[GET /api/gps-sessions]", error);
    captureApiError(error, "[GET /api/gps-sessions]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
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

    const { startedAt, endedAt, durationSeconds, pausedSeconds, knockCount, routeMiles } =
      parsed.data;

    const created = await db.gpsSession.create({
      data: {
        repId: session.user.id,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        durationSeconds,
        pausedSeconds: pausedSeconds ?? 0,
        knockCount: knockCount ?? 0,
        routeMiles: routeMiles ?? 0,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[POST /api/gps-sessions]", error);
    captureApiError(error, "[POST /api/gps-sessions]");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
