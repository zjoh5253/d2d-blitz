"use client"

import Link from "next/link"
import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"

const columns = [
  {
    key: "name",
    label: "Rep Name",
    sortable: true,
    render: (val: unknown, row: Record<string, unknown>) => (
      <Link
        href={`/dashboard/governance/${row.id}`}
        className="font-medium text-primary hover:underline"
      >
        {val as string}
      </Link>
    ),
  },
  {
    key: "tier",
    label: "Current Tier",
    render: (val: unknown) => (
      <Badge variant="outline">{val as string}</Badge>
    ),
  },
  { key: "installRate", label: "Install Rate", sortable: true },
  {
    key: "strikes",
    label: "Strikes",
    sortable: true,
    render: (val: unknown) => {
      const strikes = val as number;
      return (
        <span
          className={
            strikes >= 2
              ? "font-semibold text-destructive"
              : strikes === 1
                ? "font-semibold text-amber-500"
                : "text-muted-foreground"
          }
        >
          {strikes}
        </span>
      );
    },
  },
  { key: "lastReview", label: "Last Review" },
]

export function GovernanceTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["name", "tier"]}
      pagination
      pageSize={10}
      emptyMessage="No field reps found."
    />
  )
}
