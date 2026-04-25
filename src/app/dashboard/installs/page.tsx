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
import { Upload, CheckCircle, XCircle, ArrowRight, AlertTriangle, DollarSign } from "lucide-react";
import { format, subHours } from "date-fns";

export default async function InstallsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cutoff24h = subHours(new Date(), 24);

  const [uploads, totalRecords, matchedRecords, unmatchedRecords, matchedWithCommission, flaggedUnreconciled] =
    await Promise.all([
      db.installUpload.findMany({
        orderBy: { uploadedAt: "desc" },
        take: 10,
        include: {
          carrier: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      }),
      db.installRecord.count(),
      db.installRecord.count({ where: { status: "MATCHED" } }),
      db.installRecord.count({ where: { status: "UNMATCHED" } }),
      // Matched installs that also have a commission record
      db.installRecord.count({
        where: {
          status: "MATCHED",
          matchedSale: { commissionRecord: { isNot: null } },
        },
      }),
      // Matched installs older than 24h with NO commission record yet
      db.installRecord.findMany({
        where: {
          status: "MATCHED",
          createdAt: { lt: cutoff24h },
          matchedSale: { commissionRecord: null },
        },
        include: {
          carrier: { select: { name: true } },
          matchedSale: {
            select: {
              customerName: true,
              rep: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
    ]);

  const matchRate =
    totalRecords > 0
      ? Math.round((matchedRecords / totalRecords) * 100)
      : 0;

  const reconciliationRate =
    matchedRecords > 0
      ? Math.round((matchedWithCommission / matchedRecords) * 100)
      : 100;

  const stats = [
    {
      label: "Total Records",
      value: totalRecords,
      icon: Upload,
      color: "text-blue-500",
    },
    {
      label: "Matched",
      value: matchedRecords,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      label: "Unmatched",
      value: unmatchedRecords,
      icon: XCircle,
      color: "text-red-500",
    },
    {
      label: "Match Rate",
      value: `${matchRate}%`,
      icon: ArrowRight,
      color: "text-yellow-500",
    },
    {
      label: "Commission Rate",
      value: `${reconciliationRate}%`,
      icon: DollarSign,
      color: reconciliationRate >= 95 ? "text-emerald-500" : "text-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Install Verification</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload and verify carrier install records against submitted sales.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/installs/upload"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/installs/upload", label: "Upload CSV", desc: "Import carrier install data" },
          { href: "/installs/review", label: "Review Records", desc: "Match and resolve install records" },
          { href: "/installs/exceptions", label: "Exception Queue", desc: "Manage disputed installs" },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <p className="font-medium">{link.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{link.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Reconciliation Alert */}
      {flaggedUnreconciled.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {flaggedUnreconciled.length} Install{flaggedUnreconciled.length !== 1 ? "s" : ""} Without Commission (&gt;24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Rep</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Matched At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedUnreconciled.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="font-medium">{r.customerName}</TableCell>
                    <TableCell>{r.matchedSale?.rep?.name ?? "—"}</TableCell>
                    <TableCell>{r.carrier.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(r.createdAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No uploads yet. Upload a CSV to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Unmatched</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium text-sm">
                      {upload.fileName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {upload.carrier.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {upload.uploadedBy.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{upload.rowCount}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        {upload.matchedCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-red-700 bg-red-100">
                        {upload.unmatchedCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(upload.uploadedAt), "MMM d, yyyy")}
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
