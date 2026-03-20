"use client"

import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"
import { ComplianceActions } from "./compliance-actions"

const columns = [
  { key: "name", label: "Rep Name", sortable: true },
  { key: "blitz", label: "Blitz" },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (val: unknown) =>
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
    render: (val: unknown) => (
      <span className="text-sm text-muted-foreground truncate max-w-xs block">
        {(val as string | null) ?? "—"}
      </span>
    ),
  },
  {
    key: "holdDate",
    label: "Hold Date",
    render: (val: unknown) => (val as string | null) ?? "—",
  },
  {
    key: "holdId",
    label: "Actions",
    render: (val: unknown, row: Record<string, unknown>) => {
      const holdId = val as string | null;
      if (!holdId) return null;
      return (
        <ComplianceActions
          holdId={holdId}
          repName={row.name as string}
        />
      );
    },
  },
]

export function ComplianceTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["name", "blitz", "status"]}
      pagination
      pageSize={15}
      emptyMessage="No reps found."
    />
  )
}
