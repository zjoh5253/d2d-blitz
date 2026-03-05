export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
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
import { DollarSign, Clock, CheckCircle, Settings } from "lucide-react";
import { format } from "date-fns";

export default async function CompensationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [commissions, payoutBatches] = await Promise.all([
    db.commissionRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        rep: { select: { id: true, name: true } },
        sale: {
          include: {
            carrier: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.payoutBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        payoutLines: {
          select: {
            grossPay: true,
            totalDeductions: true,
            netPay: true,
          },
        },
      },
    }),
  ]);

  const totalPayable = commissions
    .filter((c) => c.status === "ELIGIBLE" || c.status === "PENDING")
    .reduce((sum, c) => sum + c.repPay, 0);

  const pendingPayouts = payoutBatches.filter(
    (b) => b.status === "DRAFT" || b.status === "REVIEWED"
  ).length;

  const paidThisPeriod = payoutBatches
    .filter((b) => b.status === "PAID")
    .flatMap((b) => b.payoutLines)
    .reduce((sum, l) => sum + l.netPay, 0);

  const stats = [
    {
      label: "Total Payable",
      value: `$${totalPayable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      label: "Pending Payouts",
      value: pendingPayouts,
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      label: "Paid This Period",
      value: `$${paidThisPeriod.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: CheckCircle,
      color: "text-blue-500",
    },
  ];

  const STATUS_BADGE: Record<string, string> = {
    DRAFT: "text-muted-foreground bg-muted",
    REVIEWED: "text-blue-700 bg-blue-100",
    APPROVED: "text-green-700 bg-green-100",
    PAID: "text-purple-700 bg-purple-100",
  };

  const COMMISSION_STATUS_BADGE: Record<string, string> = {
    ELIGIBLE: "text-green-700 bg-green-100",
    PENDING: "text-yellow-700 bg-yellow-100",
    ON_HOLD: "text-red-700 bg-red-100",
    PAID: "text-purple-700 bg-purple-100",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compensation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage commissions, payouts, and compensation configuration.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/compensation/payouts"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <DollarSign className="h-4 w-4" />
            Manage Payouts
          </Link>
          <Link
            href="/compensation/config"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            Stack Config
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Commission Records */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Commission Records</CardTitle>
          <Link
            href="/compensation/payouts"
            className="text-sm text-primary hover:underline"
          >
            View all payouts
          </Link>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No commission records yet. Calculate commissions from verified sales.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Carrier Payout</TableHead>
                  <TableHead>Rep Pay</TableHead>
                  <TableHead>Company Floor</TableHead>
                  <TableHead>Manager Override</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">
                      {c.rep.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.sale.carrier.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      ${c.carrierPayout.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      ${c.repPay.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ${c.companyFloor.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      ${c.managerOverride.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={COMMISSION_STATUS_BADGE[c.status]}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Payout Batches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Payout Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No payout batches yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Total Net Pay</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutBatches.map((batch) => {
                  const totalNet = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium text-sm">
                        <Link
                          href={`/compensation/payouts/${batch.id}`}
                          className="hover:underline text-primary"
                        >
                          {batch.period}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_BADGE[batch.status]}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{batch.payoutLines.length}</TableCell>
                      <TableCell className="text-sm font-medium">
                        ${totalNet.toFixed(2)}
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
