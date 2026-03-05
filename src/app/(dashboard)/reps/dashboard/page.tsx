export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DoorOpen,
  MessageSquare,
  TrendingUp,
  RotateCcw,
  CalendarCheck,
  MapPin,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { format, startOfDay, endOfDay, addDays } from "date-fns"
import { cn } from "@/lib/utils"

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

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function getSaleStatusStyle(status: string): { label: string; className: string } {
  switch (status) {
    case "VERIFIED":
      return { label: "Verified", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "INSTALLED":
      return { label: "Installed", className: "bg-blue-50 text-blue-700 border-blue-200" }
    case "CANCELLED":
      return { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" }
    case "DISPUTED":
      return { label: "Disputed", className: "bg-orange-50 text-orange-700 border-orange-200" }
    default:
      return { label: status, className: "bg-slate-50 text-slate-600 border-slate-200" }
  }
}

interface StatCardEnhancedProps {
  icon: React.ElementType
  label: string
  value: number | string
  iconBg: string
  iconColor: string
  delay?: string
}

function StatCardEnhanced({ icon: Icon, label, value, iconBg, iconColor, delay }: StatCardEnhancedProps) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-5 animate-fade-in"
      style={{ animationDelay: delay ?? "0ms" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground animate-count-up">
            {value}
          </p>
        </div>
        <div className={cn("rounded-xl p-3 shrink-0", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  )
}

export default async function RepDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const repId = session.user.id
  const firstName = session.user.name?.split(" ")[0] ?? "Rep"
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
    <div className="space-y-8 max-w-6xl">

      {/* Welcome header */}
      <div className="animate-fade-in">
        <p className="text-sm font-medium text-muted-foreground mb-0.5">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
        <h1 className="text-3xl font-bold tracking-tight font-heading text-foreground">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your command center for today.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardEnhanced
          icon={DoorOpen}
          label="Doors Knocked"
          value={todayReport?.doorsKnocked ?? 0}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          delay="0ms"
        />
        <StatCardEnhanced
          icon={MessageSquare}
          label="Conversations"
          value={todayReport?.conversations ?? 0}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
          delay="60ms"
        />
        <StatCardEnhanced
          icon={TrendingUp}
          label="Sales Today"
          value={todayReport?.salesCount ?? 0}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          delay="120ms"
        />
        <StatCardEnhanced
          icon={RotateCcw}
          label="Go-Backs Pending"
          value={pendingGoBacksCount}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          delay="180ms"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Blitz */}
        <Card className="animate-fade-in border-l-4 border-l-primary overflow-hidden" style={{ animationDelay: "80ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              Active Blitz
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAssignment ? (
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-xl font-heading tracking-tight text-foreground">
                    {activeAssignment.blitz.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      {activeAssignment.blitz.market.name} &mdash;{" "}
                      {activeAssignment.blitz.market.carrier.name}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      Start
                    </p>
                    <p className="font-semibold text-sm text-foreground">
                      {format(activeAssignment.blitz.startDate, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      End
                    </p>
                    <p className="font-semibold text-sm text-foreground">
                      {format(activeAssignment.blitz.endDate, "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
                    {activeAssignment.status}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {activeAssignment.blitz.status}
                  </span>
                </div>
                {activeAssignment.housingAssignment && (
                  <p className="text-sm text-muted-foreground">
                    Housing: {activeAssignment.housingAssignment}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No active blitz</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You&apos;ll appear here once assigned to a blitz.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Go-Backs Due Soon */}
        <Card className="animate-fade-in" style={{ animationDelay: "120ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="h-6 w-6 rounded-md bg-amber-50 flex items-center justify-center">
                <CalendarCheck className="h-3.5 w-3.5 text-amber-600" />
              </div>
              Go-Backs Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goBacksDueSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">All clear</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No go-backs due today or tomorrow.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {(goBacksDueSoon as GoBackItem[]).map((gb) => {
                  const isToday = gb.followUpDate <= todayEnd
                  return (
                    <li
                      key={gb.id}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-xl p-3 border transition-colors",
                        isToday
                          ? "border-amber-200 bg-amber-50/50"
                          : "border-border bg-background hover:bg-muted/30"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {gb.prospectName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {gb.prospectAddress}
                        </p>
                        {gb.prospectPhone && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {gb.prospectPhone}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                          isToday
                            ? "bg-amber-500 text-white"
                            : "border border-border text-muted-foreground"
                        )}
                      >
                        {isToday && <AlertTriangle className="h-3 w-3" />}
                        {isToday ? "Today" : "Tomorrow"}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card className="animate-fade-in" style={{ animationDelay: "160ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No sales yet.</p>
            ) : (
              <ul className="space-y-2">
                {(recentSales as SaleItem[]).map((sale) => {
                  const { label, className } = getSaleStatusStyle(sale.status)
                  return (
                    <li
                      key={sale.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {sale.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {sale.customerAddress}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {sale.carrier.name} &middot;{" "}
                          {format(sale.submittedAt, "MMM d")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          className
                        )}
                      >
                        {label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Installs — timeline style */}
        <Card className="animate-fade-in" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Upcoming Installs</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInstalls.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No installs scheduled in the next 7 days.
              </p>
            ) : (
              <ul className="relative space-y-0">
                {/* Timeline vertical line */}
                <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />

                {(upcomingInstalls as unknown as SaleItem[]).map((sale, idx) => {
                  const daysUntil = Math.ceil(
                    (sale.installDate.getTime() - today.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                  const isUrgent = daysUntil <= 1

                  return (
                    <li key={sale.id} className="relative flex gap-4 pb-4 last:pb-0">
                      {/* Timeline dot */}
                      <div className={cn(
                        "relative z-10 shrink-0 h-9 w-9 rounded-full flex items-center justify-center border-2 bg-background",
                        isUrgent
                          ? "border-amber-400"
                          : "border-border"
                      )}>
                        <Clock className={cn(
                          "h-3.5 w-3.5",
                          isUrgent ? "text-amber-500" : "text-muted-foreground"
                        )} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {sale.customerName}
                          </p>
                          <span className={cn(
                            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                            daysUntil === 0
                              ? "bg-red-100 text-red-700"
                              : daysUntil === 1
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          )}>
                            {daysUntil === 0
                              ? "Today"
                              : daysUntil === 1
                                ? "Tomorrow"
                                : `In ${daysUntil}d`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {sale.customerAddress}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Install: {format(sale.installDate, "MMM d, yyyy")}
                        </p>
                        <div className="flex gap-2 flex-wrap mt-1.5">
                          {daysUntil <= 2 && (
                            <span className="text-xs text-amber-600 font-semibold">
                              48hr reminder due
                            </span>
                          )}
                          {daysUntil <= 1 && (
                            <span className="text-xs text-orange-600 font-semibold">
                              24hr confirmation due
                            </span>
                          )}
                          {daysUntil === 0 && (
                            <span className="text-xs text-red-600 font-semibold">
                              Verify with customer today
                            </span>
                          )}
                        </div>
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
