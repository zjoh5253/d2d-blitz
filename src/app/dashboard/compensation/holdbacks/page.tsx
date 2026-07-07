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
import { DollarSign, Clock, TrendingDown, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { RecordChargebackForm } from "./record-chargeback-form";

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0);

export default async function HoldbacksDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const now = new Date();
  const thirtyDaysOut = new Date(now);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const jan1 = new Date(now.getFullYear(), 0, 1);

  const [
    heldAggregate,
    releasingSoonCount,
    releasedYtdAggregate,
    chargebackAggregate,
    openChargebackCount,
    recentChargebacks,
    upcomingReleases,
  ] = await Promise.all([
    db.holdback.aggregate({
      where: { status: "HELD" },
      _sum: { amount: true },
      _count: true,
    }),
    db.holdback.count({
      where: {
        status: "HELD",
        releaseAt: { lte: thirtyDaysOut },
      },
    }),
    db.holdback.aggregate({
      where: {
        status: "RELEASED",
        releasedAt: { gte: jan1 },
      },
      _sum: { amount: true },
    }),
    db.chargeback.aggregate({
      _sum: { amount: true, outstandingBalance: true },
    }),
    db.chargeback.count({
      where: { status: "OPEN" },
    }),
    db.chargeback.findMany({
      take: 15,
      orderBy: { createdAt: "desc" },
      include: {
        rep: { select: { name: true } },
        carrier: { select: { name: true } },
        sale: { select: { customerName: true } },
      },
    }),
    db.holdback.findMany({
      where: { status: "HELD" },
      orderBy: { releaseAt: "asc" },
      take: 15,
      include: {
        rep: { select: { name: true } },
        carrier: { select: { name: true } },
      },
    }),
  ]);

  const stats = [
    {
      label: "Reserved (held)",
      value: fmt(heldAggregate._sum.amount),
      sub: `${heldAggregate._count} active holdbacks`,
      icon: ShieldAlert,
      color: "text-yellow-500",
    },
    {
      label: "Releasing within 30 days",
      value: releasingSoonCount.toLocaleString(),
      sub: "holdbacks due soon",
      icon: Clock,
      color: "text-blue-500",
    },
    {
      label: "Retention bonuses released (YTD)",
      value: fmt(releasedYtdAggregate._sum.amount),
      sub: "released this year",
      icon: TrendingDown,
      color: "text-green-500",
    },
    {
      label: "Open chargebacks",
      value: openChargebackCount.toLocaleString(),
      sub: `${fmt(chargebackAggregate._sum.outstandingBalance)} outstanding`,
      icon: DollarSign,
      color: "text-red-500",
    },
  ];

  const CHARGEBACK_STATUS_BADGE: Record<string, string> = {
    OPEN: "text-red-700 bg-red-100",
    RECOVERED: "text-green-700 bg-green-100",
    WRITTEN_OFF: "text-muted-foreground bg-muted",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Holdbacks &amp; Chargebacks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track reserved commission holdbacks, retention bonus releases, and
          chargeback recovery.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Chargebacks */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Chargebacks</CardTitle>
            </CardHeader>
            <CardContent>
              {recentChargebacks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No chargebacks recorded yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Rep</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Held Applied</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentChargebacks.map((cb) => (
                      <TableRow key={cb.id}>
                        <TableCell className="font-medium text-sm">
                          {cb.sale?.customerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {cb.rep.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {cb.carrier.name}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {fmt(cb.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt(cb.heldApplied)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {fmt(cb.outstandingBalance)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={CHARGEBACK_STATUS_BADGE[cb.status]}
                          >
                            {cb.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(cb.createdAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Releases */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Holdback Releases</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingReleases.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No pending holdbacks.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Releases</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingReleases.map((hb) => (
                      <TableRow key={hb.id}>
                        <TableCell className="font-medium text-sm">
                          {hb.rep.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {hb.carrier.name}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {fmt(hb.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(hb.releaseAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Record Chargeback Form */}
        <div>
          <RecordChargebackForm />
        </div>
      </div>
    </div>
  );
}
