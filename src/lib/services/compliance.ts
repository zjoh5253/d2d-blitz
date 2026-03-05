import { db } from "@/lib/db";
import { eachDayOfInterval, isWeekend } from "date-fns";

export async function runComplianceCheck() {
  const activeBlitzes = await db.blitz.findMany({
    where: { status: "ACTIVE" },
    include: {
      assignments: {
        where: { status: "ACTIVE" },
        include: { rep: true },
      },
    },
  });

  const results = { holdsCreated: 0, holdsRestored: 0 };
  const today = new Date();

  for (const blitz of activeBlitzes) {
    const blitzDays = eachDayOfInterval({
      start: blitz.startDate,
      end: today < blitz.endDate ? today : blitz.endDate,
    }).filter((day) => !isWeekend(day)); // Only weekdays

    for (const assignment of blitz.assignments) {
      for (const day of blitzDays) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const report = await db.dailyReport.findFirst({
          where: {
            repId: assignment.repId,
            blitzId: blitz.id,
            date: { gte: dayStart, lte: dayEnd },
          },
        });

        if (!report) {
          // Check if hold already exists for this day
          const existingHold = await db.complianceHold.findFirst({
            where: {
              repId: assignment.repId,
              holdDate: { gte: dayStart, lte: dayEnd },
              restoredDate: null,
            },
          });

          if (!existingHold) {
            await db.complianceHold.create({
              data: {
                repId: assignment.repId,
                reason: `Missing daily report for ${day.toISOString().split("T")[0]} - ${blitz.name}`,
                holdDate: day,
              },
            });
            results.holdsCreated++;
          }
        } else {
          // Report exists - restore any holds for this day
          const holds = await db.complianceHold.findMany({
            where: {
              repId: assignment.repId,
              holdDate: { gte: dayStart, lte: dayEnd },
              restoredDate: null,
            },
          });

          for (const hold of holds) {
            await db.complianceHold.update({
              where: { id: hold.id },
              data: { restoredDate: new Date() },
            });
            results.holdsRestored++;
          }
        }
      }
    }
  }

  return results;
}
