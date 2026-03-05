"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { DataTable } from "@/components/tables/data-table"
import { StaffingTab } from "./staffing-tab"
import { ExpenseForm } from "./expense-form"

// Status transition map
const STATUS_TRANSITIONS: Record<string, { next: string; label: string } | null> = {
  PLANNING: { next: "STAFFING", label: "Move to Staffing" },
  STAFFING: { next: "READY", label: "Mark Ready" },
  READY: { next: "ACTIVE", label: "Activate Blitz" },
  ACTIVE: { next: "REVIEW", label: "Move to Review" },
  REVIEW: { next: "CLOSED", label: "Close Blitz" },
  CLOSED: null,
}

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
  housingAssignment: string | null
  travelCoordination: string | null
  arrivalConfirmed: boolean
  rep: Rep
}

interface Expense {
  id: string
  category: string
  amount: number
  description: string
  date: string
}

interface Sale {
  id: string
  repId: string
  status: string
  rep: { id: string; name: string | null }
  commissionRecord: { repPay: number } | null
}

interface BlitzTabsProps {
  blitz: {
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    repCap: number
    housingPlan: string | null
    market: { name: string; carrier: { name: string; revenuePerInstall: number } }
    manager: { name: string | null; email: string }
    assignments: Assignment[]
    expenses: Expense[]
    sales: Sale[]
  }
  availableReps: Rep[]
}

function formatCurrency(val: number) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function formatDate(val: string) {
  return new Date(val).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function BlitzTabs({ blitz, availableReps }: BlitzTabsProps) {
  const router = useRouter()
  const [expenseOpen, setExpenseOpen] = React.useState(false)
  const [transitioning, setTransitioning] = React.useState(false)

  const transition = STATUS_TRANSITIONS[blitz.status]

  async function handleStatusTransition() {
    if (!transition) return
    setTransitioning(true)
    await fetch(`/api/blitzes/${blitz.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: transition.next }),
    })
    setTransitioning(false)
    router.refresh()
  }

  // Derived stats
  const totalSales = blitz.sales.length
  const verifiedInstalls = blitz.sales.filter((s) => s.status === "VERIFIED").length
  const cancelledSales = blitz.sales.filter((s) => s.status === "CANCELLED").length
  const cancelRate =
    totalSales > 0 ? ((cancelledSales / totalSales) * 100).toFixed(1) : "0.0"

  const totalExpenses = blitz.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalRevenue = verifiedInstalls * blitz.market.carrier.revenuePerInstall
  const netProfit = totalRevenue - totalExpenses

  const expensesByCategory = blitz.expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  // Per-rep performance
  const repStats = blitz.assignments.map((a) => {
    const repSales = blitz.sales.filter((s) => s.repId === a.repId)
    const repVerified = repSales.filter((s) => s.status === "VERIFIED").length
    const repRevenue = repVerified * blitz.market.carrier.revenuePerInstall
    const repPay = repSales.reduce(
      (sum, s) => sum + (s.commissionRecord?.repPay ?? 0),
      0
    )
    return {
      id: a.repId,
      name: a.rep.name ?? a.rep.email,
      totalSales: repSales.length,
      verifiedInstalls: repVerified,
      revenue: repRevenue,
      repPay,
    }
  })

  const expenseColumns = [
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (val: unknown) =>
        new Date(val as string).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "category",
      label: "Category",
      render: (val: unknown) => <StatusBadge status={val as string} />,
    },
    { key: "description", label: "Description" },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (val: unknown) => formatCurrency(val as number),
    },
  ]

  const repPerfColumns = [
    { key: "name", label: "Rep", sortable: true },
    { key: "totalSales", label: "Sales", sortable: true },
    { key: "verifiedInstalls", label: "Verified Installs", sortable: true },
    {
      key: "revenue",
      label: "Revenue",
      sortable: true,
      render: (val: unknown) => formatCurrency(val as number),
    },
    {
      key: "repPay",
      label: "Rep Pay",
      sortable: true,
      render: (val: unknown) => formatCurrency(val as number),
    },
  ]

  return (
    <>
      {/* Status transition */}
      {transition && (
        <div className="flex justify-end">
          <Button onClick={handleStatusTransition} disabled={transitioning}>
            {transitioning ? "Updating..." : transition.label}
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="staffing">
            Staffing ({blitz.assignments.length})
          </TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses ({blitz.expenses.length})
          </TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Market</p>
                <p className="font-medium">{blitz.market.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Carrier</p>
                <p className="font-medium">{blitz.market.carrier.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Manager</p>
                <p className="font-medium">{blitz.manager.name ?? blitz.manager.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <StatusBadge status={blitz.status} />
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Start Date</p>
                <p className="font-medium">{formatDate(blitz.startDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">End Date</p>
                <p className="font-medium">{formatDate(blitz.endDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Rep Cap</p>
                <p className="font-medium">{blitz.repCap}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Assigned Reps</p>
                <p className="font-medium">{blitz.assignments.length} / {blitz.repCap}</p>
              </div>
              {blitz.housingPlan && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">Housing Plan</p>
                  <p className="font-medium whitespace-pre-line">{blitz.housingPlan}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staffing */}
        <TabsContent value="staffing">
          <StaffingTab
            blitzId={blitz.id}
            assignments={blitz.assignments}
            availableReps={availableReps}
          />
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatCurrency(totalExpenses)}</span>
              </p>
              <Button size="sm" onClick={() => setExpenseOpen(true)}>
                Add Expense
              </Button>
            </div>
            <DataTable
              data={blitz.expenses as unknown as Record<string, unknown>[]}
              columns={expenseColumns as Parameters<typeof DataTable>[0]["columns"]}
              searchable
              pagination
              pageSize={10}
              emptyMessage="No expenses recorded yet."
            />
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalSales}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Verified Installs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{verifiedInstalls}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cancel Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{cancelRate}%</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Rep Performance</h3>
              <DataTable
                data={repStats as unknown as Record<string, unknown>[]}
                columns={repPerfColumns as Parameters<typeof DataTable>[0]["columns"]}
                pagination
                pageSize={10}
                emptyMessage="No rep performance data yet."
              />
            </div>
          </div>
        </TabsContent>

        {/* P&L */}
        <TabsContent value="pnl">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {verifiedInstalls} installs × {formatCurrency(blitz.market.carrier.revenuePerInstall)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(totalExpenses)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Net Profit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}
                  >
                    {formatCurrency(netProfit)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Expense breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(expensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {cat.toLowerCase()}
                      </span>
                      <span className="font-medium">{formatCurrency(amt)}</span>
                    </div>
                  ))}
                  {Object.keys(expensesByCategory).length === 0 && (
                    <p className="text-sm text-muted-foreground">No expenses recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Per-rep P&L */}
            {repStats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Per-Rep Metrics</h3>
                <DataTable
                  data={repStats as unknown as Record<string, unknown>[]}
                  columns={repPerfColumns as Parameters<typeof DataTable>[0]["columns"]}
                  pageSize={20}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ExpenseForm
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        blitzId={blitz.id}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
