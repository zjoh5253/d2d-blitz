export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExceptionResolver } from "./exception-resolver";
import { format } from "date-fns";

interface ExceptionsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function ExceptionsPage({ searchParams }: ExceptionsPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const filter = params.filter === "resolved" ? "resolved" : "unresolved";
  const showResolved = filter === "resolved";

  const exceptions = await db.installException.findMany({
    where: showResolved
      ? { resolvedAt: { not: null } }
      : { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      installRecord: {
        include: {
          carrier: { select: { id: true, name: true } },
        },
      },
      sale: {
        include: {
          rep: { select: { id: true, name: true } },
        },
      },
      resolvedBy: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage disputed install records and resolve exceptions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-input">
        {[
          { value: "unresolved", label: "Unresolved" },
          { value: "resolved", label: "Resolved" },
        ].map((f) => (
          <a
            key={f.value}
            href={`?filter=${f.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f.value
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
            {showResolved ? "Resolved" : "Unresolved"} Exceptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No {showResolved ? "resolved" : "unresolved"} exceptions found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Install Record</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Linked Sale</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Resolved By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{ex.installRecord.customerName}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-40">
                        {ex.installRecord.customerAddress}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {ex.installRecord.carrier.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ex.sale ? (
                        <div>
                          <div>{ex.sale.customerName}</div>
                          <div className="text-xs text-muted-foreground">
                            Rep: {ex.sale.rep.name ?? "—"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-48">
                      <p className="truncate" title={ex.reason}>
                        {ex.reason}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm max-w-48">
                      {ex.resolution ? (
                        <p className="truncate" title={ex.resolution}>
                          {ex.resolution}
                        </p>
                      ) : (
                        <Badge variant="outline" className="text-xs text-yellow-700 bg-yellow-50">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ex.resolvedBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ex.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <ExceptionResolver
                        exceptionId={ex.id}
                        resolved={!!ex.resolvedAt}
                      />
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
