export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { BatchStatusActions } from "../payout-actions";
import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  REVIEWED: "text-blue-700 bg-blue-100",
  APPROVED: "text-green-700 bg-green-100",
  PAID: "text-purple-700 bg-purple-100",
};

interface PayoutDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PayoutDetailPage({ params }: PayoutDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const batch = await db.payoutBatch.findUnique({
    where: { id },
    include: {
      approvedBy: { select: { id: true, name: true } },
      payoutLines: {
        include: {
          rep: { select: { id: true, name: true } },
        },
        orderBy: { netPay: "desc" },
      },
    },
  });

  if (!batch) notFound();

  const totalGross = batch.payoutLines.reduce((s, l) => s + l.grossPay, 0);
  const totalDeductions = batch.payoutLines.reduce((s, l) => s + l.totalDeductions, 0);
  const totalNet = batch.payoutLines.reduce((s, l) => s + l.netPay, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payout Batch: {batch.period}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Created {format(new Date(batch.createdAt), "MMMM d, yyyy")}
            {batch.approvedAt &&
              ` &middot; Approved ${format(new Date(batch.approvedAt), "MMMM d, yyyy")}`}
          </p>
        </div>
        <BatchStatusActions batchId={batch.id} currentStatus={batch.status} />
      </div>

      {/* Batch Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant="secondary" className={`mt-1 ${STATUS_BADGE[batch.status]}`}>
              {batch.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Gross</p>
            <p className="text-xl font-bold mt-1">${totalGross.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Deductions</p>
            <p className="text-xl font-bold mt-1 text-red-700">-${totalDeductions.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Net Pay</p>
            <p className="text-xl font-bold mt-1 text-green-700">${totalNet.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Batch Info */}
      {batch.approvedBy && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval</CardTitle>
            <CardDescription>
              Approved by {batch.approvedBy.name} on{" "}
              {batch.approvedAt
                ? format(new Date(batch.approvedAt), "MMMM d, yyyy 'at' h:mm a")
                : "—"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Payout Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Payout Lines ({batch.payoutLines.length} reps)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {batch.payoutLines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No payout lines in this batch.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Governance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.payoutLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium text-sm">
                      {line.rep.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">${line.grossPay.toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-red-700">
                      {line.totalDeductions > 0
                        ? `-$${line.totalDeductions.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-green-700">
                      ${line.netPay.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {line.complianceVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      {line.governanceChecked ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
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
