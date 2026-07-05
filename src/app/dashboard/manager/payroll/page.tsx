export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { RunPayrollButton } from "./run-payroll-button";

const ALLOWED_ROLES = ["FIELD_MANAGER", "MARKET_OWNER", "ADMIN"];

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

const OVERRIDE_ROLE_BADGE: Record<string, string> = {
  MANAGER_OVERRIDE: "text-blue-700 bg-blue-100",
  MARKET_OWNER_SPREAD: "text-purple-700 bg-purple-100",
};

const EARNING_STATUS_BADGE: Record<string, string> = {
  ELIGIBLE: "text-yellow-700 bg-yellow-100",
  PENDING: "text-blue-700 bg-blue-100",
  PAID: "text-green-700 bg-green-100",
};

const BATCH_STATUS_BADGE: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  REVIEWED: "text-blue-700 bg-blue-100",
  APPROVED: "text-green-700 bg-green-100",
  PAID: "text-purple-700 bg-purple-100",
};

export default async function ManagerPayrollPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) redirect("/dashboard");

  const payeeId = session.user.id;

  const [eligibleAgg, pendingAgg, paidAgg, recentEarnings, recentBatches] =
    await Promise.all([
      db.overrideEarning.aggregate({
        where: { payeeId, status: "ELIGIBLE" },
        _sum: { amount: true },
        _count: true,
      }),
      db.overrideEarning.aggregate({
        where: { payeeId, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      db.overrideEarning.aggregate({
        where: { payeeId, status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
      db.overrideEarning.findMany({
        where: { payeeId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          commissionRecord: {
            include: {
              sale: { select: { customerName: true } },
              blitz: { select: { name: true } },
              rep: { select: { name: true } },
            },
          },
        },
      }),
      db.payoutBatch.findMany({
        where: { initiatedById: payeeId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          payoutLines: { select: { netPay: true } },
        },
      }),
    ]);

  const stats = [
    {
      label: "Eligible (unbatched)",
      value: fmt(eligibleAgg._sum.amount),
      sub: `${eligibleAgg._count} earning${eligibleAgg._count === 1 ? "" : "s"}`,
      icon: DollarSign,
      color: "text-yellow-500",
    },
    {
      label: "Pending (in a run)",
      value: fmt(pendingAgg._sum.amount),
      sub: `${pendingAgg._count} earning${pendingAgg._count === 1 ? "" : "s"}`,
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Paid (lifetime)",
      value: fmt(paidAgg._sum.amount),
      sub: `${paidAgg._count} earning${paidAgg._count === 1 ? "" : "s"}`,
      icon: TrendingUp,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll &amp; Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your override earnings and payroll runs.
          </p>
        </div>
        <RunPayrollButton />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.sub && (
                    <p className="text-xs text-muted-foreground/70">{stat.sub}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Override Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Override Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEarnings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No override earnings yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Blitz</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEarnings.map((earning) => (
                  <TableRow key={earning.id}>
                    <TableCell className="font-medium text-sm">
                      {earning.commissionRecord?.rep?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {earning.commissionRecord?.blitz?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {earning.commissionRecord?.sale?.customerName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={OVERRIDE_ROLE_BADGE[earning.role] ?? ""}
                      >
                        {earning.role === "MANAGER_OVERRIDE"
                          ? "Override"
                          : "Owner spread"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {fmt(earning.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={EARNING_STATUS_BADGE[earning.status] ?? ""}
                      >
                        {earning.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(earning.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Your Payroll Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No payroll runs initiated yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payees</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBatches.map((batch) => {
                  const totalNet = batch.payoutLines.reduce(
                    (sum, l) => sum + l.netPay,
                    0
                  );
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium text-sm">
                        {batch.period}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={BATCH_STATUS_BADGE[batch.status] ?? ""}
                        >
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {batch.payoutLines.length}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-green-700">
                        {fmt(totalNet)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(batch.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
