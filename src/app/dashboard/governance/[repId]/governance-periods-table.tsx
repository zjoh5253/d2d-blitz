"use client"

import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"

const columns = [
  { key: "period", label: "Month/Year", sortable: true },
  { key: "submittedInstalls", label: "Submitted", sortable: true },
  { key: "verifiedInstalls", label: "Verified", sortable: true },
  { key: "installRate", label: "Install Rate", sortable: true },
  {
    key: "tier",
    label: "Tier",
    render: (val: unknown) => (
      <Badge variant="outline">{val as string}</Badge>
    ),
  },
  {
    key: "strike",
    label: "Strike",
    render: (val: unknown, row: Record<string, unknown>) => {
      const isStrike = val as boolean;
      const consec = row.consecutiveStrikes as number;
      return isStrike ? (
        <Badge variant="destructive">
          Strike ({consec})
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-emerald-600 border-emerald-600"
        >
          Clear
        </Badge>
      );
    },
  },
]

export function GovernancePeriodsTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      pagination
      pageSize={12}
      emptyMessage="No governance periods recorded yet."
    />
  )
}
