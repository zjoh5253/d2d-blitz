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
import { CreateBatchButton } from "./payout-actions";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  REVIEWED: "text-blue-700 bg-blue-100",
  APPROVED: "text-green-700 bg-green-100",
  PAID: "text-purple-700 bg-purple-100",
};

interface PayoutsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status?.toUpperCase();
  const validStatuses = ["DRAFT", "REVIEWED", "APPROVED", "PAID"];
  const activeFilter = statusFilter && validStatuses.includes(statusFilter)
    ? statusFilter
    : null;

  const batches = await db.payoutBatch.findMany({
    where: activeFilter ? { status: activeFilter as "DRAFT" | "REVIEWED" | "APPROVED" | "PAID" } : {},
    orderBy: { createdAt: "desc" },
    include: {
      payoutLines: {
        select: {
          grossPay: true,
          totalDeductions: true,
          netPay: true,
        },
      },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payout Batches</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage payout batches for rep commissions.
          </p>
        </div>
        <CreateBatchButton />
      </div>

      {/* Status Filter */}
      <div className="flex gap-1 border-b border-input">
        {[
          { value: null, label: "All" },
          { value: "DRAFT", label: "Draft" },
          { value: "REVIEWED", label: "Reviewed" },
          { value: "APPROVED", label: "Approved" },
          { value: "PAID", label: "Paid" },
        ].map((f) => (
          <a
            key={f.label}
            href={f.value ? `?status=${f.value.toLowerCase()}` : "/compensation/payouts"}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeFilter === f.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {activeFilter ? `${activeFilter.charAt(0) + activeFilter.slice(1).toLowerCase()} Batches` : "All Batches"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No payout batches found. Create a new batch to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Total Deductions</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => {
                  const totalGross = batch.payoutLines.reduce((s, l) => s + l.grossPay, 0);
                  const totalDeductions = batch.payoutLines.reduce((s, l) => s + l.totalDeductions, 0);
                  const totalNet = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium text-sm">
                        {batch.period}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_BADGE[batch.status]}>
                          {batch.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{batch.payoutLines.length}</TableCell>
                      <TableCell className="text-sm">${totalGross.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-red-700">
                        -${totalDeductions.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        ${totalNet.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {batch.approvedBy?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(batch.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/compensation/payouts/${batch.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          View
                        </Link>
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
