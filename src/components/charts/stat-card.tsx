"use client"

import * as React from "react"
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  change?: number // positive = up, negative = down (percentage points)
  changeLabel?: string // e.g. "vs last month"
  className?: string
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel = "vs last period",
  className,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0
  const hasChange = change !== undefined

  return (
    <Card
      className={cn(
        "group relative overflow-hidden hover:shadow-md hover:-translate-y-px transition-all duration-300",
        className
      )}
    >
      {/* Subtle top-border accent */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1.5 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {label}
            </p>
            <p className="font-heading text-2xl font-bold tracking-tight text-foreground animate-count-up">
              {value}
            </p>
            {hasChange && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    isPositive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {isPositive ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {changeLabel}
                </span>
              </div>
            )}
          </div>

          {/* Icon in colored circle */}
          <div className="shrink-0 rounded-xl bg-primary/10 p-3 ring-1 ring-primary/10 group-hover:bg-primary/15 transition-colors duration-200">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
