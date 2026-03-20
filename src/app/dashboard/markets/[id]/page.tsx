import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { BlitzesTable } from "./blitzes-table"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { id } = await params

  const market = await db.market.findUnique({
    where: { id },
    include: {
      carrier: true,
      owner: { select: { id: true, name: true, email: true } },
      blitzes: {
        include: {
          manager: { select: { id: true, name: true } },
          _count: { select: { assignments: true, sales: true } },
          sales: { where: { status: "VERIFIED" }, select: { id: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  })

  if (!market) notFound()

  const m = market!
  type BlitzItem = (typeof m.blitzes)[0]
  const totalBlitzes = m.blitzes.length
  const activeBlitzes = m.blitzes.filter((b: BlitzItem) => b.status === "ACTIVE").length
  const totalVerifiedInstalls = m.blitzes.reduce(
    (sum: number, b: BlitzItem) => sum + b.sales.length,
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/markets" className="hover:underline">
              Markets
            </Link>
            <span>/</span>
            <span>{m.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.name}</h1>
        </div>
        <StatusBadge status={m.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Blitzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalBlitzes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Blitzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{activeBlitzes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Verified Installs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalVerifiedInstalls}</p>
          </CardContent>
        </Card>
      </div>

      {/* Market Info */}
      <Card>
        <CardHeader>
          <CardTitle>Market Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Carrier</p>
            <p className="font-medium">{m.carrier.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Market Owner</p>
            <p className="font-medium">{m.owner.name ?? m.owner.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Coverage Area</p>
            <p className="font-medium">{m.coverageArea ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Revenue / Install</p>
            <p className="font-medium">
              ${m.carrier.revenuePerInstall.toFixed(2)}
            </p>
          </div>
          {m.competitionNotes && (
            <div className="col-span-2">
              <p className="text-muted-foreground mb-1">Competition Notes</p>
              <p className="font-medium whitespace-pre-line">
                {m.competitionNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blitzes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Blitzes</h2>
          <Link href={`/dashboard/blitzes/new?marketId=${m.id}`}>
            <Button size="sm">New Blitz</Button>
          </Link>
        </div>
        <BlitzesTable
          data={
            m.blitzes.map((b: BlitzItem) => ({
              ...b,
              startDate: b.startDate.toISOString(),
              endDate: b.endDate.toISOString(),
              managerName: b.manager.name,
              assignmentCount: b._count.assignments,
            })) as Record<string, unknown>[]
          }
        />
      </div>
    </div>
  )
}
