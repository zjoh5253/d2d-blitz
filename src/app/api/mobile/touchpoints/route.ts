import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  blitzId: z.string().min(1, "Blitz is required"),
  type: z.enum(["DOOR_KNOCK", "CONTACT", "CONVERSATION", "DEMO", "CLOSE"]),
  notes: z.string().optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * GET /api/mobile/touchpoints?blitzId=
 * Rep retrieves their own touchpoints for a blitz.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const blitzId = searchParams.get("blitzId");

    if (!blitzId) {
      return NextResponse.json(
        { error: "blitzId query param is required" },
        { status: 400 }
      );
    }

    const touchpoints = await db.touchpoint.findMany({
      where: {
        repId: session.user.id,
        blitzId,
      },
      select: {
        id: true,
        type: true,
        notes: true,
        latitude: true,
        longitude: true,
        timestamp: true,
        createdAt: true,
      },
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json(touchpoints);
  } catch (error) {
    console.error("[GET /api/mobile/touchpoints]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mobile/touchpoints
 * Rep logs a touchpoint during a blitz (mobile, JWT auth).
 */
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
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { blitzId, type, notes, latitude, longitude, timestamp } =
      parsed.data;

    // Verify blitz exists and rep is assigned
    const blitz = await db.blitz.findUnique({
      where: { id: blitzId },
      include: {
        assignments: {
          where: { repId: session.user.id, status: { not: "REMOVED" } },
          select: { id: true },
        },
      },
    });

    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 });
    }

    if (blitz.assignments.length === 0) {
      return NextResponse.json(
        { error: "You are not assigned to this blitz" },
        { status: 403 }
      );
    }

    const touchpoint = await db.touchpoint.create({
      data: {
        repId: session.user.id,
        blitzId,
        type,
        notes: notes || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
      select: {
        id: true,
        type: true,
        notes: true,
        latitude: true,
        longitude: true,
        timestamp: true,
        createdAt: true,
      },
    });

    return NextResponse.json(touchpoint, { status: 201 });
  } catch (error) {
    console.error("[POST /api/mobile/touchpoints]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
