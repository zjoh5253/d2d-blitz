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

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  PENDING_INSTALL: "bg-yellow-100 text-yellow-700",
  INSTALLED: "bg-emerald-100 text-emerald-700",
  VERIFIED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function InboundSalesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sales = await db.inboundSale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { id: true, customerName: true, source: true } },
      agent: { select: { id: true, name: true } },
      carrier: { select: { id: true, name: true } },
    },
  });

  const stats = [
    {
      label: "Total Sales",
      value: sales.length,
    },
    {
      label: "Submitted",
      value: sales.filter((s) => s.status === "SUBMITTED").length,
    },
    {
      label: "Installed",
      value: sales.filter((s) => s.status === "INSTALLED").length,
    },
    {
      label: "Verified",
      value: sales.filter((s) => s.status === "VERIFIED").length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbound Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sales converted from inbound leads.
          </p>
        </div>
        <Link
          href="/inbound"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Leads
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Inbound Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sales.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No inbound sales yet. Convert a qualified lead to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Install Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium text-sm">
                      {sale.customerName}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.carrier.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.agent.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sale.installDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs ${STATUS_COLORS[sale.status] ?? ""}`}
                        variant="outline"
                      >
                        {sale.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sale.lead.source.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/inbound/leads/${sale.leadId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View Lead
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
