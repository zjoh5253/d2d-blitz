export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { SalesTable } from "./sales-table"

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
          <SalesTable data={tableData} />
        </CardContent>
      </Card>
    </div>
  )
}
