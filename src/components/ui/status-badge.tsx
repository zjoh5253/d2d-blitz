"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Maps status strings to Tailwind color classes (bg + text)
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  // Green - active / success states
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUCCESS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  HIRED: "bg-emerald-100 text-emerald-700 border-emerald-200",

  // Gray - inactive / closed states
  INACTIVE: "bg-gray-100 text-gray-600 border-gray-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  ARCHIVED: "bg-gray-100 text-gray-600 border-gray-200",
  REJECTED: "bg-gray-100 text-gray-600 border-gray-200",

  // Yellow - pending / in-progress states
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-200",
  REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
  INTERVIEWING: "bg-amber-100 text-amber-700 border-amber-200",

  // Blue - informational states
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  INVITED: "bg-blue-100 text-blue-700 border-blue-200",

  // Red - error / cancelled states
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  DENIED: "bg-red-100 text-red-700 border-red-200",
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
    "bg-gray-100 text-gray-600 border-gray-200"

  // Display label: replace underscores with spaces, title case
  const label = status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Badge
      className={cn(
        "font-medium border",
        colorClass,
        // Override default Badge bg since we supply our own
        "hover:opacity-90",
        className
      )}
    >
      {label}
    </Badge>
  )
}
