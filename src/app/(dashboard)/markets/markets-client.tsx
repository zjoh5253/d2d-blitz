"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { DataTable } from "@/components/tables/data-table"
import { MarketForm } from "./market-form"
import type { Market as MarketFormType } from "./market-form"

interface Carrier {
  id: string
  name: string
}

interface MarketOwner {
  id: string
  name: string | null
  email: string
}

interface Market extends MarketFormType {
  carrier: { id: string; name: string }
  owner: { id: string; name: string | null; email: string }
  _count: { blitzes: number }
}

interface MarketsClientProps {
  markets: Market[]
  carriers: Carrier[]
  marketOwners: MarketOwner[]
}

export function MarketsClient({ markets, carriers, marketOwners }: MarketsClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingMarket, setEditingMarket] = React.useState<Market | undefined>()

  const filtered = React.useMemo(
    () =>
      statusFilter === "ALL"
        ? markets
        : markets.filter((m) => m.status === statusFilter),
    [markets, statusFilter]
  )

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (_: unknown, row: Market) => (
        <Link
          href={`/markets/${row.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "carrier.name",
      label: "Carrier",
      sortable: true,
      render: (_: unknown, row: Market) => row.carrier.name,
    },
    {
      key: "owner.name",
      label: "Owner",
      sortable: true,
      render: (_: unknown, row: Market) => row.owner.name ?? row.owner.email,
    },
    {
      key: "coverageArea",
      label: "Coverage Area",
      render: (val: unknown) => (val as string | null) ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val: unknown) => <StatusBadge status={val as string} />,
    },
    {
      key: "_count.blitzes",
      label: "Blitzes",
      render: (_: unknown, row: Market) => row._count.blitzes,
    },
    {
      key: "id",
      label: "Actions",
      render: (_: unknown, row: Market) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setEditingMarket(row)
              setDialogOpen(true)
            }}
          >
            Edit
          </Button>
          <Link href={`/markets/${row.id}`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "ALL", label: "All Statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "PLANNING", label: "Planning" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
          className="w-44"
        />
        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditingMarket(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Market
          </Button>
        </div>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as Parameters<typeof DataTable>[0]["columns"]}
        searchable
        searchKeys={["name", "carrier.name", "owner.name"]}
        pagination
        pageSize={15}
        emptyMessage="No markets found."
      />

      <MarketForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        carriers={carriers}
        marketOwners={marketOwners}
        market={editingMarket}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
