export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { DataTable } from "@/components/tables/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { format } from "date-fns"

type SaleStatus =
  | "SUBMITTED"
  | "PENDING_INSTALL"
  | "INSTALLED"
  | "VERIFIED"
  | "CANCELLED"
  | "DISPUTED"

interface SaleRow {
  id: string
  customerName: string
  customerAddress: string
  installDate: Date
  orderConfirmation: string | null
  status: SaleStatus
  submittedAt: Date
  carrier: { name: string }
  blitz: { name: string }
}

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
    default:
      return "outline"
  }
}

export default async function RepSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const repId = session.user.id
  const { status: statusFilter } = await searchParams

  const validStatuses: SaleStatus[] = [
    "SUBMITTED",
    "PENDING_INSTALL",
    "INSTALLED",
    "VERIFIED",
    "CANCELLED",
    "DISPUTED",
  ]
  const whereStatus =
    statusFilter && validStatuses.includes(statusFilter as SaleStatus)
      ? (statusFilter as SaleStatus)
      : undefined

  const sales = await db.sale.findMany({
    where: {
      repId,
      ...(whereStatus ? { status: whereStatus } : {}),
    },
    include: { carrier: true, blitz: true },
    orderBy: { submittedAt: "desc" },
  })

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

  const tableData = (sales as SaleRow[]).map((s) => ({
    ...s,
    "carrier.name": s.carrier.name,
    "blitz.name": s.blitz.name,
  })) as unknown as Record<string, unknown>[]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Sales</h1>
          <p className="text-muted-foreground">
            View and manage your submitted sales.
          </p>
        </div>
        <Link href="/dashboard/reps/sales/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Sale
          </Button>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/reps/sales">
          <Button variant={!statusFilter ? "default" : "outline"} size="sm">
            All
          </Button>
        </Link>
        {validStatuses.map((s) => (
          <Link key={s} href={`/dashboard/reps/sales?status=${s}`}>
            <Button
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
            >
              {s.replace("_", " ")}
            </Button>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {whereStatus ? whereStatus.replace("_", " ") : "All Sales"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({sales.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={tableData}
            columns={columns}
            searchable
            searchKeys={["customerName", "customerAddress", "orderConfirmation"]}
            pagination
            pageSize={15}
            emptyMessage="No sales found."
          />
        </CardContent>
      </Card>
    </div>
  )
}
