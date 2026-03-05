import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    let holdsCreated = 0;
    let holdsRestored = 0;

    // Get all active blitzes
    const activeBlitzes = await db.blitz.findMany({
      where: { status: "ACTIVE" },
      include: {
        assignments: {
          where: { status: { in: ["ASSIGNED", "CONFIRMED", "ACTIVE"] } },
          include: { rep: true },
        },
      },
    });

    for (const blitz of activeBlitzes) {
      const blitzStart = blitz.startDate;
      const blitzEnd = blitz.endDate < now ? blitz.endDate : now;

      // Iterate each day the blitz has been active
      const current = new Date(blitzStart);
      current.setHours(0, 0, 0, 0);
      const end = new Date(blitzEnd);
      end.setHours(0, 0, 0, 0);

      const activeDays: Date[] = [];
      while (current <= end) {
        activeDays.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      for (const assignment of blitz.assignments) {
        const rep = assignment.rep;

        for (const day of activeDays) {
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);

          const report = await db.dailyReport.findFirst({
            where: {
              repId: rep.id,
              blitzId: blitz.id,
              date: { gte: dayStart, lte: dayEnd },
            },
          });

          if (!report) {
            // Check if there's already an active hold for this rep/reason
            const existingHold = await db.complianceHold.findFirst({
              where: {
                repId: rep.id,
                reason: `Missing daily report for blitz "${blitz.name}" on ${dayStart.toISOString().slice(0, 10)}`,
                restoredDate: null,
              },
            });

            if (!existingHold) {
              await db.complianceHold.create({
                data: {
                  repId: rep.id,
                  reason: `Missing daily report for blitz "${blitz.name}" on ${dayStart.toISOString().slice(0, 10)}`,
                  holdDate: now,
                },
              });
              holdsCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      holdsCreated,
      holdsRestored,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("[POST /api/compliance/check]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
