"use client"

import * as React from "react"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const DEFAULT_COLORS = [
  "hsl(var(--primary))",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
]

interface PieChartProps {
  data: Record<string, unknown>[]
  nameKey: string
  valueKey: string
  title?: string
  colors?: string[]
  className?: string
}

export function PieChart({
  data,
  nameKey,
  valueKey,
  title,
  colors = DEFAULT_COLORS,
  className,
}: PieChartProps) {
  const content = (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsPieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="45%"
          outerRadius={100}
          innerRadius={50}
          paddingAngle={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
            color: "hsl(var(--foreground))",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  )

  if (title) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    )
  }

  return <div className={className}>{content}</div>
}
