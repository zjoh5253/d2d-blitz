export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { GoBacksTable } from "./go-backs-table"

type GoBackStatus = "SCHEDULED" | "REVISITED" | "CONVERTED" | "CLOSED"

type GoBackRow = {
  id: string
  prospectName: string
  prospectAddress: string
  prospectPhone: string | null
  status: GoBackStatus
  followUpDate: Date
  notes: string | null
  blitz: { name: string }
}

export default async function GoBacksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const repId = session.user.id
  const { status: statusFilter } = await searchParams

  const validStatuses: GoBackStatus[] = [
    "SCHEDULED",
    "REVISITED",
    "CONVERTED",
    "CLOSED",
  ]
  const whereStatus =
    statusFilter && validStatuses.includes(statusFilter as GoBackStatus)
      ? (statusFilter as GoBackStatus)
      : undefined

  const gobacks = await db.goBack.findMany({
    where: {
      repId,
      ...(whereStatus ? { status: whereStatus } : {}),
    },
    include: { blitz: true },
    orderBy: { followUpDate: "asc" },
  })

  const tableData = (gobacks as GoBackRow[]).map((gb) => ({
    ...gb,
    "blitz.name": gb.blitz.name,
  })) as unknown as Record<string, unknown>[]

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Go-Backs</h1>
          <p className="text-muted-foreground">
            Track prospects who need a follow-up visit.
          </p>
        </div>
        <Link href="/dashboard/reps/go-backs/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add Go-Back
          </Button>
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/reps/go-backs">
          <Button variant={!statusFilter ? "default" : "outline"} size="sm">
            All
          </Button>
        </Link>
        {validStatuses.map((s) => (
          <Link key={s} href={`/dashboard/reps/go-backs?status=${s}`}>
            <Button
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
            >
              {s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
            </Button>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {whereStatus
              ? `${whereStatus.charAt(0) + whereStatus.slice(1).toLowerCase()} Go-Backs`
              : "All Go-Backs"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({gobacks.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GoBacksTable data={tableData} />
        </CardContent>
      </Card>
    </div>
  )
}
