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

const BLITZ_STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-gray-100 text-gray-700",
  STAFFING: "bg-blue-100 text-blue-700",
  READY: "bg-cyan-100 text-cyan-700",
  ACTIVE: "bg-green-100 text-green-700",
  REVIEW: "bg-yellow-100 text-yellow-700",
  CLOSED: "bg-slate-100 text-slate-700",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function ManagerBlitzesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const blitzes = await db.blitz.findMany({
    orderBy: { startDate: "desc" },
    include: {
      market: {
        select: {
          name: true,
          carrier: { select: { name: true, revenuePerInstall: true } },
        },
      },
      assignments: {
        where: { status: { not: "REMOVED" } },
        select: { repId: true },
      },
      sales: {
        select: { status: true },
      },
      expenses: {
        select: { amount: true },
      },
    },
  });

  const activeBlitzes = blitzes.filter((b) => b.status === "ACTIVE").length;

  let totalRevenue = 0;
  let totalExpenses = 0;

  const blitzRows = blitzes.map((blitz) => {
    const repCount = new Set(blitz.assignments.map((a) => a.repId)).size;
    const verifiedSales = blitz.sales.filter((s) => s.status === "VERIFIED").length;
    const allSales = blitz.sales.length;
    const revenue = verifiedSales * blitz.market.carrier.revenuePerInstall;
    const expenses = blitz.expenses.reduce((s, e) => s + e.amount, 0);
    const profit = revenue - expenses;

    totalRevenue += revenue;
    totalExpenses += expenses;

    return {
      id: blitz.id,
      name: blitz.name,
      market: blitz.market.name,
      status: blitz.status,
      repCount,
      allSales,
      verifiedSales,
      revenue,
      expenses,
      profit,
    };
  });

  const avgProfit =
    blitzes.length > 0 ? (totalRevenue - totalExpenses) / blitzes.length : 0;

  const summaryStats = [
    { label: "Active Blitzes", value: activeBlitzes },
    { label: "Total Revenue", value: formatCurrency(totalRevenue) },
    { label: "Total Expenses", value: formatCurrency(totalExpenses) },
    { label: "Avg Profit / Blitz", value: formatCurrency(avgProfit) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blitz Performance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of all blitz operations, revenue, and profitability.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Blitzes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Blitzes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {blitzes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No blitzes found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blitz Name</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Reps</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blitzRows.map((blitz) => (
                  <TableRow key={blitz.id}>
                    <TableCell className="font-medium text-sm">
                      {blitz.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {blitz.market}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${BLITZ_STATUS_COLORS[blitz.status] ?? ""}`}
                        variant="outline"
                      >
                        {blitz.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {blitz.repCount}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {blitz.allSales}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {blitz.verifiedSales}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(blitz.revenue)}
                    </TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {formatCurrency(blitz.expenses)}
                    </TableCell>
                    <TableCell
                      className={`text-sm text-right font-medium ${
                        blitz.profit >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {formatCurrency(blitz.profit)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/blitzes/${blitz.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
