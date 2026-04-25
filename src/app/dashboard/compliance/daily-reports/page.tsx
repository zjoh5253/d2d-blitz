export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { subDays, startOfDay, eachDayOfInterval, isBefore } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, TrendingUp, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function complianceBadge(pct: number) {
  if (pct >= 80)
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        {pct}%
      </Badge>
    );
  if (pct >= 60)
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        {pct}%
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{pct}%</Badge>
  );
}

export default async function DailyReportCompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const windowEnd = startOfDay(new Date());
  const windowStart = subDays(windowEnd, 29);

  const blitzes = await db.blitz.findMany({
    where: { status: { in: ["ACTIVE", "REVIEW"] } },
    include: {
      market: { select: { id: true, name: true } },
      assignments: {
        where: { status: { notIn: ["DEPARTED", "REMOVED"] } },
        include: {
          rep: { select: { id: true, name: true, email: true } },
        },
      },
      dailyReports: {
        where: { date: { gte: windowStart } },
        select: { repId: true, date: true },
      },
    },
  });

  type RepRow = {
    repId: string;
    repName: string;
    activeDays: number;
    daysWithReport: number;
    compliance: number;
  };

  type BlitzRow = {
    blitzId: string;
    blitzName: string;
    marketName: string;
    blitzStatus: string;
    complianceRate: number;
    compliantCount: number;
    totalAssignments: number;
    reps: RepRow[];
  };

  const blitzRows: BlitzRow[] = blitzes.map((blitz) => {
    const repRows: RepRow[] = blitz.assignments.map((assignment) => {
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
        repName: assignment.rep.name ?? assignment.rep.email ?? repId,
        activeDays: activeDays.length,
        daysWithReport,
        compliance,
      };
    });

    const totalAssignments = repRows.length;
    const complianceRate =
      totalAssignments > 0
        ? Math.round(
            repRows.reduce((s, r) => s + r.compliance, 0) / totalAssignments
          )
        : 100;
    const compliantCount = repRows.filter((r) => r.compliance >= 80).length;

    return {
      blitzId: blitz.id,
      blitzName: blitz.name,
      marketName: blitz.market.name,
      blitzStatus: blitz.status,
      complianceRate,
      compliantCount,
      totalAssignments,
      reps: repRows,
    };
  });

  const allReps = blitzRows.flatMap((b) => b.reps);
  const overallCompliance =
    allReps.length > 0
      ? Math.round(allReps.reduce((s, r) => s + r.compliance, 0) / allReps.length)
      : 100;

  const compliantBlitzes = blitzRows.filter((b) => b.complianceRate >= 80).length;
  const targetMet = overallCompliance >= 80;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Daily Report Compliance
          </h1>
          <p className="text-sm text-muted-foreground">
            30-day rolling window &mdash; Q2 target: ≥ 80%
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {targetMet ? (
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
              <div>
                <p className="text-2xl font-bold">{overallCompliance}%</p>
                <p className="text-xs text-muted-foreground">Overall (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{allReps.length}</p>
                <p className="text-xs text-muted-foreground">Active Reps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {allReps.filter((r) => r.compliance >= 80).length}
              </p>
              <p className="text-xs text-muted-foreground">Reps ≥ 80%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-2xl font-bold">
                {compliantBlitzes} / {blitzRows.length}
              </p>
              <p className="text-xs text-muted-foreground">Blitzes on target</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-blitz breakdown */}
      {blitzRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No active blitzes to show compliance for.
          </CardContent>
        </Card>
      ) : (
        blitzRows.map((blitz) => (
          <Card key={blitz.blitzId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {blitz.blitzName}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {blitz.marketName}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {blitz.compliantCount}/{blitz.totalAssignments} reps on target
                  </span>
                  {complianceBadge(blitz.complianceRate)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    blitz.complianceRate >= 80
                      ? "bg-emerald-500"
                      : blitz.complianceRate >= 60
                      ? "bg-amber-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(blitz.complianceRate, 100)}%` }}
                />
              </div>
            </CardHeader>

            {blitz.reps.length > 0 && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Active Days</TableHead>
                      <TableHead className="text-right">Days Filed</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blitz.reps
                      .slice()
                      .sort((a, b) => a.compliance - b.compliance)
                      .map((rep) => (
                        <TableRow key={rep.repId}>
                          <TableCell className="font-medium">
                            {rep.repName}
                          </TableCell>
                          <TableCell className="text-right">
                            {rep.activeDays}
                          </TableCell>
                          <TableCell className="text-right">
                            {rep.daysWithReport}
                          </TableCell>
                          <TableCell className="text-right">
                            {complianceBadge(rep.compliance)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
