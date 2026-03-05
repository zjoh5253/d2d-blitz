import Link from "next/link"
import { db } from "@/lib/db"
import { MarketsClient } from "./markets-client"

export const dynamic = "force-dynamic"

export default async function MarketsPage() {
  const [markets, carriers, marketOwners] = await Promise.all([
    db.market.findMany({
      include: {
        carrier: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { blitzes: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.carrier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { role: "MARKET_OWNER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground">
            Manage carrier markets and coverage areas
          </p>
        </div>
      </div>

      <MarketsClient
        markets={markets as Parameters<typeof MarketsClient>[0]["markets"]}
        carriers={carriers}
        marketOwners={marketOwners}
      />
    </div>
  )
}
