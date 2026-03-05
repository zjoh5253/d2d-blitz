"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle } from "lucide-react"

const dailyReportSchema = z.object({
  date: z.string().min(1, "Date is required"),
  blitzId: z.string().min(1, "Blitz is required"),
  doorsKnocked: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
  conversations: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
  goBacksRecorded: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
  appointmentsScheduled: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
  salesCount: z.coerce.number().int("Must be a whole number").min(0, "Cannot be negative"),
})

type DailyReportFormValues = z.infer<typeof dailyReportSchema>

interface BlitzOption {
  id: string
  name: string
  market: { name: string }
}

interface SubmitState {
  status: "idle" | "loading" | "success" | "error" | "duplicate"
  message?: string
}

export default function DailyReportPage() {
  const [blitzes, setBlitzes] = React.useState<BlitzOption[]>([])
  const [loadingBlitzes, setLoadingBlitzes] = React.useState(true)
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
  })

  const todayStr = format(new Date(), "yyyy-MM-dd")

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<DailyReportFormValues>({
    resolver: zodResolver(dailyReportSchema) as any,
    defaultValues: {
      date: todayStr,
      doorsKnocked: 0,
      conversations: 0,
      goBacksRecorded: 0,
      appointmentsScheduled: 0,
      salesCount: 0,
    },
  })

  const selectedDate = watch("date")
  const selectedBlitzId = watch("blitzId")

  // Load active blitz assignments
  React.useEffect(() => {
    async function fetchBlitzes() {
      try {
        const res = await fetch("/api/blitz-assignments/active")
        if (res.ok) {
          const data = await res.json()
          setBlitzes(data)
          if (data.length === 1) {
            reset((prev) => ({ ...prev, blitzId: data[0].id }))
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingBlitzes(false)
      }
    }
    fetchBlitzes()
  }, [reset])

  // Check for duplicate report when date or blitz changes
  React.useEffect(() => {
    if (!selectedDate || !selectedBlitzId) return
    if (submitState.status === "success") return

    async function checkDuplicate() {
      try {
        const res = await fetch(
          `/api/daily-reports?date=${selectedDate}&blitzId=${selectedBlitzId}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.length > 0) {
            setSubmitState({
              status: "duplicate",
              message:
                "A report already exists for this date and blitz. Submitting will overwrite it.",
            })
          } else if (submitState.status === "duplicate") {
            setSubmitState({ status: "idle" })
          }
        }
      } catch {
        // ignore
      }
    }
    checkDuplicate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedBlitzId])

  async function onSubmit(data: DailyReportFormValues) {
    setSubmitState({ status: "loading" })
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        setSubmitState({
          status: "error",
          message: err.error ?? "Failed to submit report.",
        })
        return
      }

      setSubmitState({
        status: "success",
        message: "Daily report submitted successfully!",
      })
      reset({
        date: todayStr,
        blitzId: data.blitzId,
        doorsKnocked: 0,
        conversations: 0,
        goBacksRecorded: 0,
        appointmentsScheduled: 0,
        salesCount: 0,
      })
    } catch {
      setSubmitState({
        status: "error",
        message: "An unexpected error occurred. Please try again.",
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Report</h1>
        <p className="text-muted-foreground">
          Submit your daily field activity report.
        </p>
      </div>

      {submitState.status === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{submitState.message}</p>
        </div>
      )}

      {submitState.status === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{submitState.message}</p>
        </div>
      )}

      {submitState.status === "duplicate" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{submitState.message}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report Details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-5">
            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>

            {/* Blitz selector */}
            <div className="space-y-1.5">
              <Label htmlFor="blitzId">Blitz</Label>
              {loadingBlitzes ? (
                <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
              ) : blitzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active blitz assignments found.
                </p>
              ) : (
                <select
                  id="blitzId"
                  {...register("blitzId")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a blitz</option>
                  {blitzes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} &mdash; {b.market.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.blitzId && (
                <p className="text-xs text-destructive">
                  {errors.blitzId.message}
                </p>
              )}
            </div>

            {/* Metric fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="doorsKnocked">Doors Knocked</Label>
                <Input
                  id="doorsKnocked"
                  type="number"
                  min={0}
                  {...register("doorsKnocked")}
                />
                {errors.doorsKnocked && (
                  <p className="text-xs text-destructive">
                    {errors.doorsKnocked.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conversations">Conversations</Label>
                <Input
                  id="conversations"
                  type="number"
                  min={0}
                  {...register("conversations")}
                />
                {errors.conversations && (
                  <p className="text-xs text-destructive">
                    {errors.conversations.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goBacksRecorded">Go-Backs Recorded</Label>
                <Input
                  id="goBacksRecorded"
                  type="number"
                  min={0}
                  {...register("goBacksRecorded")}
                />
                {errors.goBacksRecorded && (
                  <p className="text-xs text-destructive">
                    {errors.goBacksRecorded.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="appointmentsScheduled">
                  Appointments Scheduled
                </Label>
                <Input
                  id="appointmentsScheduled"
                  type="number"
                  min={0}
                  {...register("appointmentsScheduled")}
                />
                {errors.appointmentsScheduled && (
                  <p className="text-xs text-destructive">
                    {errors.appointmentsScheduled.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="salesCount">
                  Sales{" "}
                  <Badge variant="secondary" className="ml-1">
                    count
                  </Badge>
                </Label>
                <Input
                  id="salesCount"
                  type="number"
                  min={0}
                  {...register("salesCount")}
                />
                {errors.salesCount && (
                  <p className="text-xs text-destructive">
                    {errors.salesCount.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || loadingBlitzes}
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : "Submit Daily Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
