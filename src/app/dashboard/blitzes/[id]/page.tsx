import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import type { BlitzExpense, BlitzAssignment, Sale, CommissionRecord, User, Touchpoint } from "@prisma/client"
import { StatusBadge } from "@/components/ui/status-badge"
import { BlitzTabs } from "./blitz-tabs"
import { ShareCardButton } from "./share-card-button"

export const dynamic = "force-dynamic"

interface BlitzPageProps {
  params: Promise<{ id: string }>
}

export default async function BlitzPage({ params }: BlitzPageProps) {
  const { id } = await params

  const [blitz, availableReps, touchpoints] = await Promise.all([
    db.blitz.findUnique({
      where: { id },
      include: {
        market: { include: { carrier: true } },
        manager: { select: { id: true, name: true, email: true } },
        assignments: {
          include: {
            rep: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        expenses: { orderBy: { date: "desc" } },
        sales: {
          include: {
            rep: { select: { id: true, name: true } },
            commissionRecord: true,
          },
          orderBy: { submittedAt: "desc" },
        },
      },
    }),
    db.user.findMany({
      where: { role: "FIELD_REP" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    db.touchpoint.findMany({
      where: { blitzId: id },
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
    }),
  ])

  if (!blitz) {
    notFound()
  }

  // Serialize dates for client components
  const b = blitz!
  const serializedBlitz = {
    ...b,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    expenses: b.expenses.map((e: BlitzExpense) => ({
      ...e,
      date: e.date.toISOString(),
      createdAt: e.createdAt.toISOString(),
    })),
    assignments: b.assignments.map((a: BlitzAssignment & { rep: Pick<User, "id" | "name" | "email" | "role"> }) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    sales: b.sales.map((s: Sale & { rep: Pick<User, "id" | "name">; commissionRecord: CommissionRecord | null }) => ({
      ...s,
      installDate: s.installDate.toISOString(),
      submittedAt: s.submittedAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  }

  const serializedTouchpoints = touchpoints.map(
    (t: Touchpoint & { rep: Pick<User, "id" | "name" | "email"> }) => ({
      ...t,
      timestamp: t.timestamp.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/dashboard/blitzes" className="hover:underline">
              Blitzes
            </Link>
            <span>/</span>
            <span>{b.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {b.market.name} &middot; {b.market.carrier.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ShareCardButton blitzId={b.id} initialToken={b.publicCardToken} initialEnabled={b.publicCardEnabled} />
          <StatusBadge status={b.status} />
        </div>
      </div>

      {/* Tabs with all interactive content */}
      <BlitzTabs
        blitz={serializedBlitz as Parameters<typeof BlitzTabs>[0]["blitz"]}
        availableReps={availableReps}
        touchpoints={serializedTouchpoints as Parameters<typeof BlitzTabs>[0]["touchpoints"]}
      />
    </div>
  )
}
