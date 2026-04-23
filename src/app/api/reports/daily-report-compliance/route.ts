/**
 * GET /api/reports/daily-report-compliance
 *
 * Returns 30-day rolling daily report compliance rates per active blitz.
 * Compliance % = days with at least one report submitted / active days in window.
 *
 * Auth: Admin, Executive, Field Manager
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subDays, startOfDay, eachDayOfInterval, isBefore } from "date-fns";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const windowEnd = startOfDay(new Date());
    const windowStart = subDays(windowEnd, 29); // 30-day window inclusive

    // Fetch active blitzes with their assignments and daily reports in the window
    const blitzes = await db.blitz.findMany({
      where: { status: { in: ["ACTIVE", "REVIEW"] } },
      include: {
        market: { select: { id: true, name: true } },
        assignments: {
          where: {
            status: { notIn: ["DEPARTED", "REMOVED"] },
          },
          include: {
            rep: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        dailyReports: {
          where: {
            date: { gte: windowStart },
          },
          select: { repId: true, date: true },
        },
      },
    });

    const result = blitzes.map((blitz) => {
      // For each assignment, compute how many days in the window have a report
      const repRows = blitz.assignments.map((assignment) => {
        const repId = assignment.repId;
        const repStart = isBefore(assignment.createdAt, windowStart)
          ? windowStart
          : startOfDay(assignment.createdAt);

        const activeDays = eachDayOfInterval({ start: repStart, end: windowEnd });

        const reportedDays = new Set(
          blitz.dailyReports
            .filter((r) => r.repId === repId)
            .map((r) => startOfDay(r.date).toISOString())
        );

        const daysWithReport = activeDays.filter((d) =>
          reportedDays.has(d.toISOString())
        ).length;

        const compliance =
          activeDays.length > 0
            ? Math.round((daysWithReport / activeDays.length) * 100)
            : 100;

        return {
          repId,
          repName: assignment.rep.name ?? assignment.rep.email,
          activeDays: activeDays.length,
          daysWithReport,
          compliance,
        };
      });

      const totalAssignments = repRows.length;
      const blitzCompliance =
        totalAssignments > 0
          ? Math.round(
              repRows.reduce((sum, r) => sum + r.compliance, 0) /
                totalAssignments
            )
          : 100;

      const compliantCount = repRows.filter((r) => r.compliance >= 80).length;

      return {
        blitzId: blitz.id,
        blitzName: blitz.name,
        marketName: blitz.market.name,
        blitzStatus: blitz.status,
        totalAssignments,
        compliantCount,
        complianceRate: blitzCompliance,
        reps: repRows,
      };
    });

    // Overall 30-day compliance rate across all active blitzes
    const allRepRows = result.flatMap((b) => b.reps);
    const overallCompliance =
      allRepRows.length > 0
        ? Math.round(
            allRepRows.reduce((sum, r) => sum + r.compliance, 0) /
              allRepRows.length
          )
        : 100;

    return NextResponse.json({
      windowDays: 30,
      overallCompliance,
      blitzes: result,
    });
  } catch (error) {
    console.error("[GET /api/reports/daily-report-compliance]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
