export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/charts/stat-card";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldCheck, ShieldAlert } from "lucide-react";
import { ComplianceActions } from "./compliance-actions";

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "EXECUTIVE", "FIELD_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Get all FIELD_REPs
  const reps = await db.user.findMany({
    where: { role: "FIELD_REP", status: "ACTIVE" },
    include: {
      blitzAssignments: {
        where: { status: { in: ["ASSIGNED", "CONFIRMED", "ACTIVE"] } },
        include: { blitz: { select: { id: true, name: true } } },
      },
      complianceHolds: {
        where: { restoredDate: null },
        orderBy: { holdDate: "desc" },
        take: 1,
      },
    },
  });

  const totalReps = reps.length;
  const heldReps = reps.filter((r) => r.complianceHolds.length > 0);
  const compliantReps = reps.filter((r) => r.complianceHolds.length === 0);
  const holdRate =
    totalReps > 0 ? Math.round((heldReps.length / totalReps) * 100) : 0;

  const tableData = reps.map((rep) => {
    const activeHold = rep.complianceHolds[0];
    const blitzName =
      rep.blitzAssignments[0]?.blitz?.name ?? "Unassigned";
    return {
      id: rep.id,
      name: rep.name ?? rep.email,
      blitz: blitzName,
      status: activeHold ? "HELD" : "COMPLIANT",
      holdReason: activeHold?.reason ?? null,
      holdDate: activeHold?.holdDate
        ? new Date(activeHold.holdDate).toLocaleDateString()
        : null,
      holdId: activeHold?.id ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Track daily report compliance and holds
          </p>
        </div>
        <ComplianceActions />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total Reps" value={totalReps} />
        <StatCard
          icon={ShieldCheck}
          label="Compliant"
          value={compliantReps.length}
        />
        <StatCard
          icon={ShieldAlert}
          label="On Hold"
          value={heldReps.length}
        />
      </div>

      {/* Compliance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rep Compliance Status ({holdRate}% hold rate)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <DataTable
            data={tableData as Record<string, unknown>[]}
            columns={[
              { key: "name", label: "Rep Name", sortable: true },
              { key: "blitz", label: "Blitz" },
              {
                key: "status",
                label: "Status",
                sortable: true,
                render: (val) =>
                  val === "HELD" ? (
                    <Badge variant="destructive">Held</Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-600"
                    >
                      Compliant
                    </Badge>
                  ),
              },
              {
                key: "holdReason",
                label: "Hold Reason",
                render: (val) => (
                  <span className="text-sm text-muted-foreground truncate max-w-xs block">
                    {(val as string | null) ?? "—"}
                  </span>
                ),
              },
              {
                key: "holdDate",
                label: "Hold Date",
                render: (val) => (val as string | null) ?? "—",
              },
              {
                key: "holdId",
                label: "Actions",
                render: (val, row) => {
                  const holdId = val as string | null;
                  if (!holdId) return null;
                  return (
                    <ComplianceActions
                      holdId={holdId}
                      repName={(row as { name: string }).name}
                    />
                  );
                },
              },
            ]}
            searchable
            searchKeys={["name", "blitz", "status"]}
            pagination
            pageSize={15}
            emptyMessage="No reps found."
          />
        </CardContent>
      </Card>
    </div>
  );
}
