"use client"

import * as React from "react"
import Link from "next/link"
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

export function BlitzesClient({ blitzes }: BlitzesClientProps) {
  const [activeTab, setActiveTab] = React.useState("ALL")

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
          href={`/blitzes/${row.id}`}
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
      render: (val: unknown) => <StatusBadge status={val as string} />,
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
        <Link href={`/blitzes/${row.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      ),
    },
  ]

  return (
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
  )
}
