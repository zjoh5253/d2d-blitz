"use client"

import Link from "next/link"
import { DataTable } from "@/components/tables/data-table"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"

const columns = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    render: (_: unknown, row: Record<string, unknown>) => (
      <Link
        href={`/dashboard/blitzes/${row.id}`}
        className="font-medium text-foreground hover:underline"
      >
        {row.name as string}
      </Link>
    ),
  },
  {
    key: "startDate",
    label: "Start",
    sortable: true,
    render: (val: unknown) =>
      new Date(val as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  },
  {
    key: "endDate",
    label: "End",
    render: (val: unknown) =>
      new Date(val as string).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  },
  {
    key: "repCap",
    label: "Rep Cap",
  },
  {
    key: "managerName",
    label: "Manager",
    render: (val: unknown) => (val as string) ?? "—",
  },
  {
    key: "status",
    label: "Status",
    render: (val: unknown) => <StatusBadge status={val as string} />,
  },
  {
    key: "assignmentCount",
    label: "Reps",
  },
  {
    key: "id",
    label: "",
    render: (_: unknown, row: Record<string, unknown>) => (
      <Link href={`/dashboard/blitzes/${row.id}`}>
        <Button variant="ghost" size="sm">
          View
        </Button>
      </Link>
    ),
  },
]

export function BlitzesTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      pagination
      pageSize={10}
      emptyMessage="No blitzes for this market yet."
    />
  )
}
