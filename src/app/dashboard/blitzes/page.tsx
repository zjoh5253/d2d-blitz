import Link from "next/link"
import { db } from "@/lib/db"
import { BlitzesClient } from "./blitzes-client"

export const dynamic = "force-dynamic"

export default async function BlitzesPage() {
  const blitzes = await db.blitz.findMany({
    include: {
      market: {
        include: { carrier: true },
      },
      manager: { select: { id: true, name: true, email: true } },
      _count: { select: { assignments: true, sales: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Per-blitz address counts for the list hover. Split by `suppressed` so we can
  // show the FILTERED (knockable) count up front and the total/filtered-out
  // breakdown on hover. One grouped query for the whole page.
  const leadCounts = await db.doorKnockLead.groupBy({
    by: ["blitzId", "suppressed"],
    where: { blitzId: { in: blitzes.map((b) => b.id) } },
    _count: { _all: true },
  })
  const countsByBlitz = new Map<string, { filtered: number; suppressed: number }>()
  for (const c of leadCounts) {
    if (!c.blitzId) continue
    const e = countsByBlitz.get(c.blitzId) ?? { filtered: 0, suppressed: 0 }
    if (c.suppressed) e.suppressed += c._count._all
    else e.filtered += c._count._all
    countsByBlitz.set(c.blitzId, e)
  }
  const blitzesWithCounts = blitzes.map((b) => {
    const c = countsByBlitz.get(b.id) ?? { filtered: 0, suppressed: 0 }
    return { ...b, addresses: { filtered: c.filtered, suppressed: c.suppressed, total: c.filtered + c.suppressed } }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blitzes</h1>
          <p className="text-sm text-muted-foreground">
            Manage field blitz campaigns across markets
          </p>
        </div>
        <Link href="/dashboard/blitzes/new">
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            New Blitz
          </button>
        </Link>
      </div>

      <BlitzesClient blitzes={blitzesWithCounts as Parameters<typeof BlitzesClient>[0]["blitzes"]} />
    </div>
  )
}
