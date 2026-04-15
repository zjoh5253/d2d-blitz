"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { DataTable } from "@/components/tables/data-table"

interface Rep {
  id: string
  name: string | null
  email: string
}

interface Touchpoint {
  id: string
  repId: string
  blitzId: string
  address: string
  outcome: string
  notes: string | null
  latitude: number | null
  longitude: number | null
  timestamp: string
  rep: { id: string; name: string | null; email: string }
}

interface TouchpointsTabProps {
  blitzId: string
  initialTouchpoints: Touchpoint[]
  reps: Rep[]
}

const OUTCOME_LABELS: Record<string, string> = {
  NO_ANSWER: "No Answer",
  NOT_INTERESTED: "Not Interested",
  CALLBACK: "Callback",
  PITCHED: "Pitched",
  SOLD: "Sold",
  DO_NOT_KNOCK: "Do Not Knock",
}

function formatDateTime(val: string) {
  return new Date(val).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function TouchpointsTab({
  blitzId,
  initialTouchpoints,
  reps,
}: TouchpointsTabProps) {
  const [touchpoints, setTouchpoints] =
    React.useState<Touchpoint[]>(initialTouchpoints)
  const [filterRep, setFilterRep] = React.useState<string>("")
  const [filterOutcome, setFilterOutcome] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)

  const filtered = React.useMemo(() => {
    return touchpoints.filter((t) => {
      if (filterRep && t.repId !== filterRep) return false
      if (filterOutcome && t.outcome !== filterOutcome) return false
      return true
    })
  }, [touchpoints, filterRep, filterOutcome])

  async function refresh() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ blitzId })
      const res = await fetch(`/api/touchpoints?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTouchpoints(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const outcomeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of touchpoints) {
      counts[t.outcome] = (counts[t.outcome] ?? 0) + 1
    }
    return counts
  }, [touchpoints])

  const columns = [
    {
      key: "timestamp",
      label: "Time",
      sortable: true,
      render: (val: unknown) => formatDateTime(val as string),
    },
    {
      key: "rep",
      label: "Rep",
      render: (_: unknown, row: Record<string, unknown>) => {
        const rep = row.rep as { name: string | null; email: string }
        return rep.name ?? rep.email
      },
    },
    { key: "address", label: "Address", sortable: true },
    {
      key: "outcome",
      label: "Outcome",
      sortable: true,
      render: (val: unknown) => <StatusBadge status={val as string} />,
    },
    {
      key: "notes",
      label: "Notes",
      render: (val: unknown) =>
        val ? (
          <span className="text-sm text-muted-foreground">{val as string}</span>
        ) : (
          <span className="text-sm text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "latitude",
      label: "GPS",
      render: (_: unknown, row: Record<string, unknown>) => {
        const lat = row.latitude as number | null
        const lng = row.longitude as number | null
        if (!lat || !lng) return <span className="text-muted-foreground/50">—</span>
        return (
          <a
            href={`https://maps.google.com/?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs hover:underline"
          >
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </a>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all ${filterOutcome === key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterOutcome(filterOutcome === key ? "" : key)}
          >
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <p className="text-2xl font-bold">{outcomeCounts[key] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={filterRep}
          onChange={(e) => setFilterRep(e.target.value)}
        >
          <option value="">All Reps</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ?? r.email}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
        >
          <option value="">All Outcomes</option>
          {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Table */}
      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as Parameters<typeof DataTable>[0]["columns"]}
        searchable
        pagination
        pageSize={25}
        emptyMessage="No touchpoints recorded yet."
      />

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {touchpoints.length} touchpoints
      </p>
    </div>
  )
}
