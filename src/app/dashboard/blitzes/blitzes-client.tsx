"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { DataTable } from "@/components/tables/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const STATUS_TABS = ["ALL", "PLANNING", "STAFFING", "READY", "ACTIVE", "REVIEW", "CLOSED"] as const

interface Blitz {
  id: string
  name: string
  status: string
  startDate: Date | string
  endDate: Date | string
  repCap: number
  managerId: string
  leadPrepStatus: string
  leadPrepTotal: number
  leadPrepChecked: number
  leadPrepSource: string | null
  market: {
    id: string
    name: string
    carrier: { id: string; name: string }
  }
  manager: { id: string; name: string | null; email: string }
  _count: { assignments: number; sales: number }
}

interface BlitzesClientProps {
  blitzes: Blitz[]
}

// Live filtering progress for one blitz, tracked client-side while this tab
// drives its scan. baseChecked = how many were already cached when we started,
// so rate/ETA reflect only this session's throughput.
interface Prog {
  status: "FILTERING" | "READY"
  total: number
  checked: number
  customers: number
  stalled: boolean
  startedAt: number
  baseChecked: number
  source: string | null
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—"
  const s = Math.round(totalSeconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function FilteringCell({ prog, fallback, now }: { prog: Prog | undefined; fallback: Blitz; now: number }) {
  const total = prog?.total ?? fallback.leadPrepTotal
  const checked = prog?.checked ?? fallback.leadPrepChecked
  const source = prog?.source ?? fallback.leadPrepSource
  const osmBadge =
    source === "osm" ? (
      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">partial (OSM)</span>
    ) : null

  // total === 0 while FILTERING means addresses haven't been pulled yet.
  if (total === 0) {
    return (
      <div className="min-w-[160px]">
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pulling addresses…
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" />
        </div>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((checked / total) * 100))
  const remaining = Math.max(0, total - checked)
  const elapsed = prog ? Math.max(0, (now - prog.startedAt) / 1000) : 0
  const sessionDone = prog ? checked - prog.baseChecked : 0
  const rate = sessionDone > 0 && elapsed > 0 ? sessionDone / elapsed : 0
  const eta = rate > 0 ? remaining / rate : Infinity
  const etaLabel = prog?.stalled
    ? "paused — finishing in background"
    : sessionDone < 5
      ? "estimating…"
      : `~${formatDuration(eta)} left`

  return (
    <div className="min-w-[160px]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Filtering · {pct}%{osmBadge}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
        {checked.toLocaleString()}/{total.toLocaleString()} · {etaLabel}
      </div>
    </div>
  )
}

export function BlitzesClient({ blitzes }: BlitzesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState("ALL")
  const [prog, setProg] = React.useState<Record<string, Prog>>({})
  const [now, setNow] = React.useState(() => Date.now())
  const drivenRef = React.useRef<Set<string>>(new Set())
  const stopRef = React.useRef(false)

  // Drive the provider scan for any blitz still FILTERING: each prepare call
  // scans a batch through IP Royal and persists progress. Whoever has this list
  // open keeps it moving; the cron backstop covers when nobody does.
  React.useEffect(() => {
    stopRef.current = false
    const driven = drivenRef.current

    async function drive(id: string) {
      while (!stopRef.current) {
        let d: {
          leadPrepStatus: "FILTERING" | "READY"
          leadPrepTotal: number
          leadPrepChecked: number
          leadPrepSource: string | null
          providerScanRequired: boolean
          pulledThisCall: boolean
          scannedThisCall: number
          customersThisCall: number
        }
        try {
          const res = await fetch(`/api/blitzes/${id}/prepare`, { method: "POST" })
          if (!res.ok) return
          d = await res.json()
        } catch {
          return
        }
        if (stopRef.current) return
        setProg((prev) => {
          const cur = prev[id]
          return {
            ...prev,
            [id]: {
              status: d.leadPrepStatus,
              total: d.leadPrepTotal,
              checked: d.leadPrepChecked,
              customers: (cur?.customers ?? 0) + (d.customersThisCall ?? 0),
              stalled: false,
              startedAt: cur?.startedAt ?? Date.now(),
              baseChecked: cur?.baseChecked ?? d.leadPrepChecked - (d.scannedThisCall ?? 0),
              source: d.leadPrepSource ?? cur?.source ?? null,
            },
          }
        })
        if (d.leadPrepStatus === "READY" || !d.providerScanRequired) {
          router.refresh() // pull fresh server status so the row flips to its real badge
          return
        }
        // No scan progress AND nothing pulled this tick = throttle stall; hand
        // off to the cron backstop. (A pull tick scans 0 but made progress.)
        if ((d.scannedThisCall ?? 0) === 0 && !d.pulledThisCall) {
          setProg((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], stalled: true } } : prev))
          return
        }
      }
    }

    for (const b of blitzes) {
      if (b.leadPrepStatus === "FILTERING" && !driven.has(b.id)) {
        driven.add(b.id)
        setProg((prev) =>
          prev[b.id]
            ? prev
            : {
                ...prev,
                [b.id]: {
                  status: "FILTERING",
                  total: b.leadPrepTotal,
                  checked: b.leadPrepChecked,
                  customers: 0,
                  stalled: false,
                  startedAt: Date.now(),
                  baseChecked: b.leadPrepChecked,
                  source: b.leadPrepSource,
                },
              }
        )
        drive(b.id)
      }
    }

    return () => { stopRef.current = true }
  }, [blitzes, router])

  // 1s ticker for live ETA while any blitz is actively filtering.
  React.useEffect(() => {
    const active =
      Object.values(prog).some((p) => p.status === "FILTERING" && !p.stalled) ||
      blitzes.some((b) => b.leadPrepStatus === "FILTERING" && !prog[b.id])
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [prog, blitzes])

  const filtering = React.useMemo(
    () => blitzes.filter((b) => (prog[b.id]?.status ?? b.leadPrepStatus) === "FILTERING"),
    [blitzes, prog]
  )
  const justCreated = searchParams.get("filtering") === "1"

  const filtered = React.useMemo(
    () =>
      activeTab === "ALL"
        ? blitzes
        : blitzes.filter((b) => b.status === activeTab),
    [blitzes, activeTab]
  )

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (_: unknown, row: Blitz) => (
        <Link
          href={`/dashboard/blitzes/${row.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "market.name",
      label: "Market",
      sortable: true,
      render: (_: unknown, row: Blitz) => row.market.name,
    },
    {
      key: "market.carrier.name",
      label: "Carrier",
      sortable: true,
      render: (_: unknown, row: Blitz) => row.market.carrier.name,
    },
    {
      key: "startDate",
      label: "Start",
      sortable: true,
      render: (val: unknown) =>
        new Date(val as string).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "endDate",
      label: "End",
      render: (val: unknown) =>
        new Date(val as string).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
    {
      key: "repCap",
      label: "Rep Cap",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: unknown, row: Blitz) => {
        const prepStatus = prog[row.id]?.status ?? row.leadPrepStatus
        if (prepStatus === "FILTERING") {
          return <FilteringCell prog={prog[row.id]} fallback={row} now={now} />
        }
        return <StatusBadge status={val as string} />
      },
    },
    {
      key: "manager.name",
      label: "Manager",
      render: (_: unknown, row: Blitz) => row.manager.name ?? row.manager.email,
    },
    {
      key: "id",
      label: "Actions",
      render: (_: unknown, row: Blitz) => (
        <Link href={`/dashboard/blitzes/${row.id}`}>
          <Button variant="ghost" size="sm">View</Button>
        </Link>
      ),
    },
  ]

  return (
    <>
      {(justCreated || filtering.length > 0) && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-600" />
          <div>
            <div className="font-medium">
              {filtering.length > 0
                ? `${filtering.length} blitz${filtering.length > 1 ? "es are" : " is"} still filtering out current customers`
                : "Your blitz is being prepared"}
            </div>
            <div className="text-amber-800">
              Staffing stays locked until filtering finishes. You can leave this page — it keeps filtering in the background.
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap gap-1 mb-4">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="text-xs">
              {tab === "ALL"
                ? `All (${blitzes.length})`
                : `${tab.charAt(0) + tab.slice(1).toLowerCase()} (${blitzes.filter((b) => b.status === tab).length})`}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab} value={tab}>
            <DataTable
              data={
                filtered.map((b) => ({
                  ...b,
                  startDate:
                    b.startDate instanceof Date
                      ? b.startDate.toISOString()
                      : b.startDate,
                  endDate:
                    b.endDate instanceof Date ? b.endDate.toISOString() : b.endDate,
                })) as Record<string, unknown>[]
              }
              columns={columns as Parameters<typeof DataTable>[0]["columns"]}
              searchable
              searchKeys={["name", "market.name", "market.carrier.name"]}
              pagination
              pageSize={15}
              emptyMessage={`No ${tab === "ALL" ? "" : tab.toLowerCase() + " "}blitzes found.`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}
