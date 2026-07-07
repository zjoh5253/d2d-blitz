import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";

const BlitzAssignmentStatusValues = [
  "ASSIGNED",
  "CONFIRMED",
  "IN_TRANSIT",
  "ACTIVE",
  "DEPARTED",
  "REMOVED",
] as const;

const PatchBodySchema = z.object({
  arrivalConfirmed: z.boolean().optional(),
  status: z.enum(BlitzAssignmentStatusValues).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repId = session.user.id;

    const activeAssignment = await db.blitzAssignment.findFirst({
      where: {
        repId,
        status: { in: ["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE"] },
        blitz: { status: { in: ["ACTIVE", "READY"] } },
      },
      include: {
        blitz: {
          include: {
            market: { include: { carrier: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      activeAssignment: activeAssignment
        ? {
            id: activeAssignment.id,
            status: activeAssignment.status,
            arrivalConfirmed: activeAssignment.arrivalConfirmed,
            housingAssignment: activeAssignment.housingAssignment,
            travelCoordination: activeAssignment.travelCoordination,
            blitz: {
              id: activeAssignment.blitz.id,
              name: activeAssignment.blitz.name,
              startDate: activeAssignment.blitz.startDate,
              endDate: activeAssignment.blitz.endDate,
              status: activeAssignment.blitz.status,
              market: {
                name: activeAssignment.blitz.market.name,
                carrier: activeAssignment.blitz.market.carrier
                  ? { name: activeAssignment.blitz.market.carrier.name }
                  : undefined,
              },
            },
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching active assignment:", error);
    return NextResponse.json(
      { error: "Failed to fetch active assignment" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repId = session.user.id;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { arrivalConfirmed, status } = parsed.data;

    const assignment = await db.blitzAssignment.findFirst({
      where: {
        repId,
        status: { in: ["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE"] },
        blitz: { status: { in: ["ACTIVE", "READY"] } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "No active assignment" },
        { status: 404 }
      );
    }

    const updateData: {
      arrivalConfirmed?: boolean;
      status?: (typeof BlitzAssignmentStatusValues)[number];
    } = {};

    if (arrivalConfirmed !== undefined) {
      updateData.arrivalConfirmed = arrivalConfirmed;
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    // When confirming arrival and currently ASSIGNED, auto-advance to CONFIRMED
    // only if the caller did not also supply an explicit status override.
    if (
      arrivalConfirmed === true &&
      assignment.status === "ASSIGNED" &&
      status === undefined
    ) {
      updateData.status = "CONFIRMED";
    }

    const updated = await db.blitzAssignment.update({
      where: { id: assignment.id },
      data: updateData,
      include: {
        blitz: {
          include: {
            market: { include: { carrier: true } },
          },
        },
      },
    });

    return NextResponse.json({
      activeAssignment: {
        id: updated.id,
        status: updated.status,
        arrivalConfirmed: updated.arrivalConfirmed,
        housingAssignment: updated.housingAssignment,
        travelCoordination: updated.travelCoordination,
        blitz: {
          id: updated.blitz.id,
          name: updated.blitz.name,
          startDate: updated.blitz.startDate,
          endDate: updated.blitz.endDate,
          status: updated.blitz.status,
          market: {
            name: updated.blitz.market.name,
            carrier: updated.blitz.market.carrier
              ? { name: updated.blitz.market.carrier.name }
              : undefined,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error updating active assignment:", error);
    return NextResponse.json(
      { error: "Failed to update active assignment" },
      { status: 500 }
    );
  }
}
