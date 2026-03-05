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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blitzes</h1>
          <p className="text-sm text-muted-foreground">
            Manage field blitz campaigns across markets
          </p>
        </div>
        <Link href="/blitzes/new">
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            New Blitz
          </button>
        </Link>
      </div>

      <BlitzesClient blitzes={blitzes as Parameters<typeof BlitzesClient>[0]["blitzes"]} />
    </div>
  )
}
