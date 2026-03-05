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
import { Upload, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default async function InstallsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [uploads, totalRecords, matchedRecords, unmatchedRecords] =
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
    ]);

  const matchRate =
    totalRecords > 0
      ? Math.round((matchedRecords / totalRecords) * 100)
      : 0;

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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
