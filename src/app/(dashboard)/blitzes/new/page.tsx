"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const blitzSchema = z.object({
  name: z.string().min(1, "Name is required"),
  marketId: z.string().min(1, "Market is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  repCap: z.string().min(1, "Rep cap is required").transform((val) => {
    const n = parseInt(val, 10)
    if (isNaN(n) || n <= 0) throw new Error("Rep cap must be a positive integer")
    return n
  }),
  housingPlan: z.string().optional().or(z.literal("")),
  managerId: z.string().min(1, "Manager is required"),
})

type BlitzFormInput = {
  name: string
  marketId: string
  startDate: string
  endDate: string
  repCap: string
  housingPlan?: string
  managerId: string
}
type BlitzFormValues = z.infer<typeof blitzSchema>

interface Market {
  id: string
  name: string
  carrier: { name: string }
}

interface Manager {
  id: string
  name: string | null
  email: string
}

export default function NewBlitzPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedMarketId = searchParams.get("marketId") ?? ""

  const [markets, setMarkets] = React.useState<Market[]>([])
  const [managers, setManagers] = React.useState<Manager[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [serverError, setServerError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchData() {
      const [marketsRes, managersRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/users?role=FIELD_MANAGER"),
      ])
      if (marketsRes.ok) setMarkets(await marketsRes.json())
      if (managersRes.ok) setManagers(await managersRes.json())
      setLoadingData(false)
    }
    fetchData()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlitzFormInput, any, BlitzFormValues>({
    resolver: zodResolver(blitzSchema),
    defaultValues: {
      marketId: preselectedMarketId,
      repCap: "10",
    },
  })

  async function onSubmit(values: BlitzFormValues) {
    setServerError(null)
    const res = await fetch("/api/blitzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json()
      setServerError(data.error ?? "Failed to create blitz")
      return
    }

    const blitz = await res.json()
    router.push(`/blitzes/${blitz.id}`)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/blitzes" className="hover:underline">
            Blitzes
          </Link>
          <span>/</span>
          <span>New</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Blitz</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Blitz Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Blitz Name</Label>
              <Input id="name" {...register("name")} placeholder="e.g. Phoenix Summer 2025" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="marketId">Market</Label>
              <Select
                id="marketId"
                {...register("marketId")}
                placeholder="Select market"
                options={markets.map((m) => ({
                  value: m.id,
                  label: `${m.name} (${m.carrier.name})`,
                }))}
              />
              {errors.marketId && (
                <p className="text-xs text-destructive">{errors.marketId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="repCap">Rep Cap</Label>
              <Input id="repCap" type="number" min={1} {...register("repCap")} />
              {errors.repCap && (
                <p className="text-xs text-destructive">{errors.repCap.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="managerId">Field Manager</Label>
              <Select
                id="managerId"
                {...register("managerId")}
                placeholder="Select manager"
                options={managers.map((u) => ({
                  value: u.id,
                  label: u.name ?? u.email,
                }))}
              />
              {errors.managerId && (
                <p className="text-xs text-destructive">{errors.managerId.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="housingPlan">Housing Plan</Label>
              <Textarea
                id="housingPlan"
                {...register("housingPlan")}
                placeholder="Housing arrangements, address, details..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Blitz"}
              </Button>
              <Link href="/blitzes">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
