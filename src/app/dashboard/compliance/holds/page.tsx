export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/charts/stat-card";
import { ShieldAlert, ShieldCheck, History } from "lucide-react";
import { HoldsTable, type HoldRow } from "./holds-table";
import { ExportHoldsButton } from "./holds-actions";
import { HoldsFilters } from "./holds-filters";

interface PageProps {
  searchParams: Promise<{ period?: string; repId?: string; activeOnly?: string }>;
}

export default async function ComplianceHoldsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const { period, repId, activeOnly } = params;

  const validPeriod = period && /^\d{4}-\d{2}$/.test(period) ? period : undefined;

  let periodFilter: { gte: Date; lt: Date } | undefined;
  if (validPeriod) {
    const [year, month] = validPeriod.split("-").map(Number);
    periodFilter = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  const holds = await db.complianceHold.findMany({
    where: {
      ...(repId ? { repId } : {}),
      ...(activeOnly === "true" ? { restoredDate: null } : {}),
      ...(periodFilter ? { holdDate: periodFilter } : {}),
    },
    include: {
      rep: { select: { id: true, name: true, email: true } },
      restoredBy: { select: { id: true, name: true } },
    },
    orderBy: { holdDate: "desc" },
  });

  const activeHolds = holds.filter((h) => !h.restoredDate);
  const restoredHolds = holds.filter((h) => h.restoredDate);

  const tableData: HoldRow[] = holds.map((h) => ({
    id: h.id,
    repName: h.rep.name ?? h.rep.email,
    repEmail: h.rep.email,
    holdDate: new Date(h.holdDate).toLocaleDateString(),
    reason: h.reason,
    status: h.restoredDate ? "Restored" : "Active",
    restoredDate: h.restoredDate
      ? new Date(h.restoredDate).toLocaleDateString()
      : null,
    restoredBy: h.restoredBy?.name ?? null,
  }));

  const now = new Date();
  const periodOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    return { value, label };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hold Management</h1>
          <p className="text-sm text-muted-foreground">
            View, restore, and export compliance holds on rep commissions
          </p>
        </div>
        <ExportHoldsButton
          period={validPeriod}
          repId={repId}
          activeOnly={activeOnly === "true"}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldAlert} label="Active Holds" value={activeHolds.length} />
        <StatCard icon={ShieldCheck} label="Restored" value={restoredHolds.length} />
        <StatCard icon={History} label="Total (filtered)" value={holds.length} />
      </div>

      {/* Filters */}
      <HoldsFilters
        periodOptions={periodOptions}
        currentPeriod={validPeriod}
        currentActiveOnly={activeOnly === "true"}
      />

      {/* Holds Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Compliance Holds
            {validPeriod ? ` — ${validPeriod}` : ""}
            {activeOnly === "true" ? " (Active Only)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <HoldsTable data={tableData} />
        </CardContent>
      </Card>
    </div>
  );
}
