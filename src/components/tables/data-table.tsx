"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
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
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
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
    if (sortKey !== colKey) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
    if (sortDir === "asc") return <ChevronUp className="ml-1 inline h-3 w-3" />
    return <ChevronDown className="ml-1 inline h-3 w-3" />
  }

  // Reset to page 1 on search change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [search, sortKey, sortDir])

  return (
    <div className="space-y-3">
      {searchable && (
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      )}

      <div className="rounded-md border border-input">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.sortable && "cursor-pointer select-none hover:text-foreground")}
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
              Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
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
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} &mdash; {sortedData.length} result{sortedData.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-input px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded border border-input px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
