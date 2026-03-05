"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Users,
  CalendarDays,
  DollarSign,
  TrendingUp,
  BarChart3,
  MapPin,
  Home,
  PlusCircle,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/charts/stat-card"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rep {
  id: string
  name: string | null
  email: string
  role: string
}

interface Assignment {
  id: string
  repId: string
  status: string
  rep: Rep
  createdAt: string | Date
}

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  date: string | Date
}

interface CommissionRecord {
  id: string
  repPay: number
  status: string
}

interface Sale {
  id: string
  repId: string
  customerName: string
  customerAddress: string
  status: string
  installDate: string | Date
  submittedAt: string | Date
  rep: { id: string; name: string | null }
  commissionRecord: CommissionRecord | null
}

interface BlitzData {
  id: string
  name: string
  status: string
  startDate: string | Date
  endDate: string | Date
  repCap: number
  housingPlan: string | null
  market: {
    id: string
    name: string
    carrier: { id: string; name: string; revenuePerInstall: number }
  }
  manager: { id: string; name: string | null; email: string }
  assignments: Assignment[]
  expenses: Expense[]
  sales: Sale[]
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-slate-100 text-slate-700",
  STAFFING: "bg-blue-100 text-blue-700",
  READY: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  REVIEW: "bg-orange-100 text-orange-700",
  CLOSED: "bg-gray-100 text-gray-600",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  )
}

// ─── Staffing Tab ─────────────────────────────────────────────────────────────

function StaffingTab({
  blitzId,
  assignments,
  repCap,
}: {
  blitzId: string
  assignments: Assignment[]
  repCap: number
}) {
  const router = useRouter()
  const [repEmail, setRepEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repEmail }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to assign rep")
      } else {
        setRepEmail("")
        router.refresh()
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    if (!confirm("Remove this rep from the blitz?")) return
    await fetch(`/api/blitzes/${blitzId}/assignments/${assignmentId}`, {
      method: "DELETE",
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} / {repCap} reps assigned
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Rep</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Assigned</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No reps assigned yet.
                </td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{a.rep.name ?? a.rep.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.rep.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(a.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(a.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assign Rep</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssign} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Rep email address"
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
                type="email"
              />
            </div>
            <Button type="submit" disabled={loading || !repEmail}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({
  blitzId,
  expenses,
}: {
  blitzId: string
  expenses: Expense[]
}) {
  const router = useRouter()
  const [form, setForm] = React.useState({
    category: "HOUSING",
    amount: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to add expense")
      } else {
        setForm({ category: "HOUSING", amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") })
        router.refresh()
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total expenses:{" "}
          <span className="font-semibold text-foreground">
            ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </p>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No expenses recorded.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Badge variant="outline">{e.category}</Badge>
                  </td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(e.date), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {["HOUSING", "TRAVEL", "OPERATIONAL", "OTHER"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  placeholder="Describe the expense"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !form.amount || !form.description}>
              {loading ? "Adding..." : "Add Expense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab({ sales }: { sales: Sale[] }) {
  const total = sales.length
  const verified = sales.filter((s) => s.status === "VERIFIED").length
  const cancelled = sales.filter((s) => s.status === "CANCELLED").length
  const cancelRate = total > 0 ? (cancelled / total) * 100 : 0

  // Group by rep
  const byRep: Record<string, { name: string; total: number; verified: number; cancelled: number }> = {}
  for (const sale of sales) {
    const repId = sale.rep.id
    if (!byRep[repId]) {
      byRep[repId] = { name: sale.rep.name ?? "Unknown", total: 0, verified: 0, cancelled: 0 }
    }
    byRep[repId].total++
    if (sale.status === "VERIFIED") byRep[repId].verified++
    if (sale.status === "CANCELLED") byRep[repId].cancelled++
  }

  const repRows = Object.entries(byRep).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={BarChart3} label="Total Sales" value={total} />
        <StatCard icon={TrendingUp} label="Verified" value={verified} />
        <StatCard icon={TrendingUp} label="Cancel Rate" value={`${cancelRate.toFixed(1)}%`} />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Rep</th>
              <th className="px-4 py-3 text-center font-medium">Sales</th>
              <th className="px-4 py-3 text-center font-medium">Verified</th>
              <th className="px-4 py-3 text-center font-medium">Cancelled</th>
              <th className="px-4 py-3 text-center font-medium">Cancel Rate</th>
            </tr>
          </thead>
          <tbody>
            {repRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No sales data yet.
                </td>
              </tr>
            ) : (
              repRows.map(([repId, data]) => (
                <tr key={repId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{data.name}</td>
                  <td className="px-4 py-3 text-center">{data.total}</td>
                  <td className="px-4 py-3 text-center text-emerald-600">{data.verified}</td>
                  <td className="px-4 py-3 text-center text-destructive">{data.cancelled}</td>
                  <td className="px-4 py-3 text-center">
                    {data.total > 0 ? ((data.cancelled / data.total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── P&L Tab ──────────────────────────────────────────────────────────────────

function PandLTab({
  sales,
  expenses,
  revenuePerInstall,
}: {
  sales: Sale[]
  expenses: Expense[]
  revenuePerInstall: number
}) {
  const verifiedSales = sales.filter((s) => s.status === "VERIFIED").length
  const totalRevenue = verifiedSales * revenuePerInstall
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalRepPay = sales
    .filter((s) => s.commissionRecord)
    .reduce((sum, s) => sum + (s.commissionRecord?.repPay ?? 0), 0)
  const netProfit = totalRevenue - totalExpenses - totalRepPay

  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified installs</span>
              <span>{verifiedSales}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenue per install</span>
              <span>${revenuePerInstall.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total Revenue</span>
              <span className="text-emerald-600">
                ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(byCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-muted-foreground">{cat}</span>
                <span>${amt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rep commissions</span>
              <span>${totalRepPay.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total Costs</span>
              <span className="text-destructive">
                ${(totalExpenses + totalRepPay).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p
                className={`text-3xl font-bold tracking-tight ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {netProfit < 0 ? "-" : ""}$
                {Math.abs(netProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BlitzDetail({ blitz }: { blitz: BlitzData }) {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/blitzes" className="hover:underline">
            Blitzes
          </Link>
          <span>/</span>
          <span>{blitz.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{blitz.name}</h1>
          <StatusBadge status={blitz.status} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="staffing">
            Staffing ({blitz.assignments.length}/{blitz.repCap})
          </TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="pl">P&amp;L</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Blitz Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={blitz.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span>{format(new Date(blitz.startDate), "MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End Date</span>
                  <span>{format(new Date(blitz.endDate), "MMM d, yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rep Cap</span>
                  <span>{blitz.repCap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manager</span>
                  <span>{blitz.manager.name ?? blitz.manager.email}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Market Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Market</span>
                  <span>{blitz.market.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carrier</span>
                  <span>{blitz.market.carrier.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue/Install</span>
                  <span>${blitz.market.carrier.revenuePerInstall.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {blitz.housingPlan && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Housing Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{blitz.housingPlan}</p>
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Staffing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Assigned Reps</span>
                  <span className="font-semibold">{blitz.assignments.length} / {blitz.repCap}</span>
                  <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (blitz.assignments.length / blitz.repCap) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staffing */}
        <TabsContent value="staffing">
          <StaffingTab
            blitzId={blitz.id}
            assignments={blitz.assignments}
            repCap={blitz.repCap}
          />
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses">
          <ExpensesTab blitzId={blitz.id} expenses={blitz.expenses} />
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <PerformanceTab sales={blitz.sales} />
        </TabsContent>

        {/* P&L */}
        <TabsContent value="pl">
          <PandLTab
            sales={blitz.sales}
            expenses={blitz.expenses}
            revenuePerInstall={blitz.market.carrier.revenuePerInstall}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
