"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Maps status strings to Tailwind color classes (bg + text + border)
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  // Emerald — active / success / verified states
  ACTIVE:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  VERIFIED:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  APPROVED:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PAID:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  SUCCESS:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  HIRED:     "bg-emerald-50 text-emerald-700 border border-emerald-200",

  // Amber — pending / in-progress / draft states
  PENDING:   "bg-amber-50 text-amber-700 border border-amber-200",
  DRAFT:     "bg-amber-50 text-amber-700 border border-amber-200",
  SCREENING: "bg-amber-50 text-amber-700 border border-amber-200",
  STAFFING:  "bg-amber-50 text-amber-700 border border-amber-200",
  IN_PROGRESS:    "bg-amber-50 text-amber-700 border border-amber-200",
  INTERVIEWING:   "bg-amber-50 text-amber-700 border border-amber-200",

  // Gray — inactive / closed / cancelled / rejected states
  INACTIVE:   "bg-gray-50 text-gray-600 border border-gray-200",
  CANCELLED:  "bg-gray-50 text-gray-600 border border-gray-200",
  REJECTED:   "bg-gray-50 text-gray-600 border border-gray-200",
  CLOSED:     "bg-gray-50 text-gray-600 border border-gray-200",
  ARCHIVED:   "bg-gray-50 text-gray-600 border border-gray-200",
  DENIED:     "bg-gray-50 text-gray-600 border border-gray-200",
  FAILED:     "bg-gray-50 text-gray-600 border border-gray-200",

  // Blue — review / disputed / on-hold / informational states
  REVIEW:     "bg-blue-50 text-blue-700 border border-blue-200",
  DISPUTED:   "bg-blue-50 text-blue-700 border border-blue-200",
  ON_HOLD:    "bg-blue-50 text-blue-700 border border-blue-200",
  SCHEDULED:  "bg-blue-50 text-blue-700 border border-blue-200",
  INVITED:    "bg-blue-50 text-blue-700 border border-blue-200",
}

interface StatusBadgeProps {
  status: string
  variantMap?: Record<string, string>
  className?: string
}

export function StatusBadge({ status, variantMap, className }: StatusBadgeProps) {
  const map = variantMap ?? DEFAULT_STATUS_COLORS
  const colorClass =
    map[status.toUpperCase()] ??
    map[status] ??
    "bg-gray-50 text-gray-600 border border-gray-200"

  // Display label: replace underscores with spaces, title case
  const label = status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Badge
      className={cn(
        "rounded-full font-medium text-xs hover:opacity-90",
        colorClass,
        className
      )}
    >
      {label}
    </Badge>
  )
}
