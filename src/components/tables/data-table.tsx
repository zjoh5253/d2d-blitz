"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchKeys?: string[]
  pagination?: boolean
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  loading?: boolean
}

type SortDirection = "asc" | "desc" | null

function getNestedValue<T>(obj: T, key: string): unknown {
  return key.split(".").reduce((acc: unknown, part) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div
            className="h-4 rounded-md"
            style={{
              width: `${60 + (i % 3) * 15}%`,
              background:
                "linear-gradient(90deg, #F1F5F9 0px, #E2E8F0 40px, #F1F5F9 80px)",
              backgroundSize: "400px 100%",
              animation: "shimmer 1.4s ease-in-out infinite",
            }}
          />
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchKeys = [],
  pagination = false,
  pageSize = 10,
  onRowClick,
  emptyMessage = "No results found.",
  loading = false,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = React.useState(1)

  const filteredData = React.useMemo(() => {
    if (!searchable || !search.trim()) return data
    const query = search.toLowerCase()
    const keys = searchKeys.length > 0 ? searchKeys : columns.map((c) => c.key)
    return data.filter((row) =>
      keys.some((key) => {
        const val = getNestedValue(row, key)
        return String(val ?? "").toLowerCase().includes(query)
      })
    )
  }, [data, search, searchable, searchKeys, columns])

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return filteredData
    return [...filteredData].sort((a, b) => {
      const aVal = getNestedValue(a, sortKey)
      const bVal = getNestedValue(b, sortKey)
      const aStr = String(aVal ?? "")
      const bStr = String(bVal ?? "")
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true })
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filteredData, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const paginatedData = pagination
    ? sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedData

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
    } else if (sortDir === "asc") {
      setSortDir("desc")
    } else if (sortDir === "desc") {
      setSortKey(null)
      setSortDir(null)
    }
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey)
      return <ChevronsUpDown className="ml-1.5 inline h-3.5 w-3.5 text-muted-foreground/60" />
    if (sortDir === "asc")
      return <ChevronUp className="ml-1.5 inline h-3.5 w-3.5 text-primary" />
    return <ChevronDown className="ml-1.5 inline h-3.5 w-3.5 text-primary" />
  }

  // Reset to page 1 on search / sort change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [search, sortKey, sortDir])

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.sortable &&
                      "cursor-pointer select-none hover:text-foreground"
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map(
                (_, i) => <SkeletonRow key={i} cols={columns.length} />
              )
            ) : paginatedData.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-36 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <div className="rounded-full bg-secondary p-3">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground/60">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <TableRow
                  key={rowIdx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => {
                    const value = getNestedValue(row, col.key)
                    return (
                      <TableCell key={col.key}>
                        {col.render ? col.render(value, row) : String(value ?? "")}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}{" "}
            <span className="text-muted-foreground/60">&mdash;</span>{" "}
            {sortedData.length} result{sortedData.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors",
                    page === currentPage
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  {page}
                </button>
              )
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
