export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { StatCard } from "@/components/charts/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DoorOpen,
  MessageSquare,
  ShoppingCart,
  RotateCcw,
  CalendarCheck,
  MapPin,
} from "lucide-react"
import { format, startOfDay, endOfDay, addDays } from "date-fns"

interface GoBackItem {
  id: string
  prospectName: string
  prospectAddress: string
  prospectPhone: string | null
  followUpDate: Date
}

interface SaleItem {
  id: string
  customerName: string
  customerAddress: string
  status: string
  submittedAt: Date
  installDate: Date
  carrier: { name: string }
}

function getSaleStatusVariant(
  status: string
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

export default async function RepDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const repId = session.user.id
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const tomorrowEnd = endOfDay(addDays(today, 1))

  // Fetch active blitz assignment
  const activeAssignment = await db.blitzAssignment.findFirst({
    where: {
      repId,
      status: { in: ["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE"] },
      blitz: { status: { in: ["ACTIVE", "READY"] } },
    },
    include: {
      blitz: {
        include: {
          market: { include: { carrier: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const activeBlitzId = activeAssignment?.blitzId

  // Fetch today's daily report
  const todayReport = activeBlitzId
    ? await db.dailyReport.findFirst({
        where: {
          repId,
          blitzId: activeBlitzId,
          date: { gte: todayStart, lte: todayEnd },
        },
      })
    : null

  // Recent sales (last 5)
  const recentSales = await db.sale.findMany({
    where: { repId },
    orderBy: { submittedAt: "desc" },
    take: 5,
    include: { carrier: true },
  })

  // Go-backs due today and tomorrow
  const goBacksDueSoon = await db.goBack.findMany({
    where: {
      repId,
      status: "SCHEDULED",
      followUpDate: { gte: todayStart, lte: tomorrowEnd },
    },
    orderBy: { followUpDate: "asc" },
  })

  // Install follow-up checklist: sales with upcoming install dates (next 7 days)
  const upcomingInstalls = await db.sale.findMany({
    where: {
      repId,
      status: { in: ["SUBMITTED", "PENDING_INSTALL"] },
      installDate: {
        gte: today,
        lte: addDays(today, 7),
      },
    },
    orderBy: { installDate: "asc" },
    take: 10,
  })

  // Pending go-backs count
  const pendingGoBacksCount = await db.goBack.count({
    where: { repId, status: "SCHEDULED" },
  })

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DoorOpen}
          label="Doors Knocked Today"
          value={todayReport?.doorsKnocked ?? 0}
        />
        <StatCard
          icon={MessageSquare}
          label="Conversations Today"
          value={todayReport?.conversations ?? 0}
        />
        <StatCard
          icon={ShoppingCart}
          label="Sales Today"
          value={todayReport?.salesCount ?? 0}
        />
        <StatCard
          icon={RotateCcw}
          label="Go-Backs Pending"
          value={pendingGoBacksCount}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Blitz Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Current Blitz
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAssignment ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-lg">
                    {activeAssignment.blitz.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeAssignment.blitz.market.name} &mdash;{" "}
                    {activeAssignment.blitz.market.carrier.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start</span>
                    <p className="font-medium">
                      {format(activeAssignment.blitz.startDate, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End</span>
                    <p className="font-medium">
                      {format(activeAssignment.blitz.endDate, "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{activeAssignment.status}</Badge>
                  <Badge variant="secondary">
                    {activeAssignment.blitz.status}
                  </Badge>
                </div>
                {activeAssignment.housingAssignment && (
                  <p className="text-sm text-muted-foreground">
                    Housing: {activeAssignment.housingAssignment}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No active blitz assignment found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Go-Backs Due Today/Tomorrow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Go-Backs Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goBacksDueSoon.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No go-backs due today or tomorrow.
              </p>
            ) : (
              <ul className="space-y-3">
                {(goBacksDueSoon as GoBackItem[]).map((gb) => (
                  <li
                    key={gb.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-input p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{gb.prospectName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {gb.prospectAddress}
                      </p>
                      {gb.prospectPhone && (
                        <p className="text-xs text-muted-foreground">
                          {gb.prospectPhone}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        gb.followUpDate <= todayEnd ? "default" : "outline"
                      }
                      className="shrink-0"
                    >
                      {gb.followUpDate <= todayEnd ? "Today" : "Tomorrow"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales yet.</p>
            ) : (
              <ul className="space-y-3">
                {(recentSales as SaleItem[]).map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-input p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {sale.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {sale.customerAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.carrier.name} &middot;{" "}
                        {format(sale.submittedAt, "MMM d")}
                      </p>
                    </div>
                    <Badge
                      variant={getSaleStatusVariant(sale.status)}
                      className="shrink-0"
                    >
                      {sale.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Install Follow-Up Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Installs</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInstalls.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No installs scheduled in the next 7 days.
              </p>
            ) : (
              <ul className="space-y-3">
                {(upcomingInstalls as unknown as SaleItem[]).map((sale) => {
                  const daysUntil = Math.ceil(
                    (sale.installDate.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                  return (
                    <li
                      key={sale.id}
                      className="rounded-lg border border-input p-3 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium truncate">
                          {sale.customerName}
                        </p>
                        <Badge
                          variant={daysUntil <= 1 ? "default" : "outline"}
                          className="shrink-0"
                        >
                          {daysUntil === 0
                            ? "Today"
                            : daysUntil === 1
                              ? "Tomorrow"
                              : `In ${daysUntil}d`}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {sale.customerAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Install:{" "}
                        {format(sale.installDate, "MMM d, yyyy")}
                      </p>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {daysUntil <= 2 && (
                          <span className="text-xs text-amber-600 font-medium">
                            48hr reminder due
                          </span>
                        )}
                        {daysUntil <= 1 && (
                          <span className="text-xs text-orange-600 font-medium">
                            24hr confirmation due
                          </span>
                        )}
                        {daysUntil === 0 && (
                          <span className="text-xs text-red-600 font-medium">
                            Verify with customer today
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
