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
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {hasChange && (
              <div className="flex items-center gap-1 text-xs">
                {isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "font-medium",
                    isPositive ? "text-emerald-500" : "text-destructive"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
