"use client"

import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

type SaleStatus =
  | "SUBMITTED"
  | "PENDING_INSTALL"
  | "INSTALLED"
  | "VERIFIED"
  | "CANCELLED"
  | "DISPUTED"
  | "CHARGEBACK"

function getSaleStatusVariant(
  status: SaleStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "VERIFIED":
      return "default"
    case "INSTALLED":
      return "secondary"
    case "CANCELLED":
      return "destructive"
    case "DISPUTED":
      return "destructive"
    case "CHARGEBACK":
      return "destructive"
    default:
      return "outline"
  }
}

const columns = [
  {
    key: "customerName",
    label: "Customer",
    sortable: true,
  },
  {
    key: "customerAddress",
    label: "Address",
    sortable: true,
  },
  {
    key: "installDate",
    label: "Install Date",
    render: (value: unknown) =>
      value instanceof Date ? format(value, "MMM d, yyyy") : String(value),
    sortable: true,
  },
  {
    key: "orderConfirmation",
    label: "Order #",
    render: (value: unknown) => (value ? String(value) : "—"),
  },
  {
    key: "status",
    label: "Status",
    render: (value: unknown) => {
      const s = value as SaleStatus
      return <Badge variant={getSaleStatusVariant(s)}>{s}</Badge>
    },
    sortable: true,
  },
  {
    key: "submittedAt",
    label: "Submitted",
    render: (value: unknown) =>
      value instanceof Date ? format(value, "MMM d, yyyy") : String(value),
    sortable: true,
  },
]

export function SalesTable({ data }: { data: Record<string, unknown>[] }) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["customerName", "customerAddress", "orderConfirmation"]}
      pagination
      pageSize={15}
      emptyMessage="No sales found."
    />
  )
}
