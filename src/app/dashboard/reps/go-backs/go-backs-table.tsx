"use client"

import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

type GoBackStatus = "SCHEDULED" | "REVISITED" | "CONVERTED" | "CLOSED"

function getGoBackStatusVariant(
  status: GoBackStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "SCHEDULED":
      return "default"
    case "REVISITED":
      return "secondary"
    case "CONVERTED":
      return "outline"
    case "CLOSED":
      return "destructive"
    default:
      return "outline"
  }
}

const columns = [
  {
    key: "prospectName",
    label: "Prospect Name",
    sortable: true,
  },
  {
    key: "prospectAddress",
    label: "Address",
    sortable: true,
  },
  {
    key: "prospectPhone",
    label: "Phone",
    render: (value: unknown) => (value ? String(value) : "—"),
  },
  {
    key: "status",
    label: "Status",
    render: (value: unknown) => {
      const s = value as GoBackStatus
      return <Badge variant={getGoBackStatusVariant(s)}>{s}</Badge>
    },
    sortable: true,
  },
  {
    key: "followUpDate",
    label: "Follow-Up Date",
    render: (value: unknown) =>
      value instanceof Date ? format(value, "MMM d, yyyy") : String(value),
    sortable: true,
  },
  {
    key: "blitz.name",
    label: "Blitz",
    sortable: true,
  },
]

export function GoBacksTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["prospectName", "prospectAddress"]}
      pagination
      pageSize={15}
      emptyMessage="No go-backs found."
    />
  )
}
