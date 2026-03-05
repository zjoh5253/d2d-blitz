"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, CalendarClock } from "lucide-react"
import { format, addDays } from "date-fns"

const saleSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerAddress: z.string().min(1, "Customer address is required"),
  customerEmail: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  installDate: z.string().min(1, "Install date is required"),
  orderConfirmation: z.string().optional().or(z.literal("")),
  carrierId: z.string().min(1, "Carrier is required"),
  blitzId: z.string().min(1, "Blitz is required"),
})

type SaleFormValues = z.infer<typeof saleSchema>

interface BlitzOption {
  id: string
  name: string
  market: { name: string; carrier: { id: string; name: string } }
}

interface CarrierOption {
  id: string
  name: string
}

interface SubmitState {
  status: "idle" | "loading" | "success" | "error" | "duplicate"
  message?: string
  saleId?: string
  installDate?: string
}

function InstallTimeline({ installDateStr }: { installDateStr: string }) {
  const installDate = new Date(installDateStr)
  const milestones = [
    {
      label: "48hr Before",
      date: addDays(installDate, -2),
      description: "Call customer to confirm appointment",
    },
    {
      label: "24hr Before",
      date: addDays(installDate, -1),
      description: "Final confirmation check",
    },
    {
      label: "Install Day",
      date: installDate,
      description: "Verify installer arrived and customer is satisfied",
    },
    {
      label: "Post-Install",
      date: addDays(installDate, 1),
      description: "Check-in call to confirm successful installation",
    },
  ]

  return (
    <div className="space-y-3">
      {milestones.map((m, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-primary mt-0.5" />
            {i < milestones.length - 1 && (
              <div className="w-px h-8 bg-border mt-1" />
            )}
          </div>
          <div className="pb-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{m.label}</p>
              <Badge variant="outline" className="text-xs">
                {format(m.date, "MMM d")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{m.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NewSalePage() {
  const router = useRouter()
  const [blitzes, setBlitzes] = React.useState<BlitzOption[]>([])
  const [carriers, setCarriers] = React.useState<CarrierOption[]>([])
  const [loadingData, setLoadingData] = React.useState(true)
  const [submitState, setSubmitState] = React.useState<SubmitState>({
    status: "idle",
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      customerEmail: "",
      installDate: "",
      orderConfirmation: "",
      carrierId: "",
      blitzId: "",
    },
  })

  const selectedAddress = watch("customerAddress")
  const selectedInstallDate = watch("installDate")
  const selectedBlitzId = watch("blitzId")

  // Load blitz assignments and carriers
  React.useEffect(() => {
    async function fetchData() {
      try {
        const [blitzRes, carrierRes] = await Promise.all([
          fetch("/api/blitz-assignments/active"),
          fetch("/api/carriers"),
        ])
        if (blitzRes.ok) {
          const data: BlitzOption[] = await blitzRes.json()
          setBlitzes(data)
          if (data.length === 1) {
            setValue("blitzId", data[0].id)
            setValue("carrierId", data[0].market.carrier.id)
          }
        }
        if (carrierRes.ok) {
          const data: CarrierOption[] = await carrierRes.json()
          setCarriers(data)
        }
      } catch {
        // ignore
      } finally {
        setLoadingData(false)
      }
    }
    fetchData()
  }, [setValue])

  // Auto-populate carrier from selected blitz
  React.useEffect(() => {
    const blitz = blitzes.find((b) => b.id === selectedBlitzId)
    if (blitz) {
      setValue("carrierId", blitz.market.carrier.id)
    }
  }, [selectedBlitzId, blitzes, setValue])

  async function onSubmit(data: SaleFormValues) {
    setSubmitState({ status: "loading" })
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (res.status === 409) {
        setSubmitState({
          status: "duplicate",
          message:
            result.error ??
            "A sale already exists at this address within the last 30 days.",
        })
        return
      }

      if (!res.ok) {
        setSubmitState({
          status: "error",
          message: result.error ?? "Failed to submit sale.",
        })
        return
      }

      setSubmitState({
        status: "success",
        message: "Sale submitted successfully!",
        saleId: result.id,
        installDate: data.installDate,
      })
    } catch {
      setSubmitState({
        status: "error",
        message: "An unexpected error occurred. Please try again.",
      })
    }
  }

  if (submitState.status === "success" && submitState.installDate) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">{submitState.message}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Install Follow-Up Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InstallTimeline installDateStr={submitState.installDate} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => router.push("/dashboard/reps/sales/new")}>
            Submit Another Sale
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/reps/sales")}
          >
            View All Sales
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Sale</h1>
        <p className="text-muted-foreground">Submit a new field sale.</p>
      </div>

      {submitState.status === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{submitState.message}</p>
        </div>
      )}

      {submitState.status === "duplicate" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Duplicate Sale Detected</p>
            <p className="text-sm">{submitState.message}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sale Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Blitz */}
            <div className="space-y-1.5">
              <Label htmlFor="blitzId">Blitz</Label>
              {loadingData ? (
                <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
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

            {/* Carrier */}
            <div className="space-y-1.5">
              <Label htmlFor="carrierId">Carrier</Label>
              {loadingData ? (
                <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
              ) : (
                <select
                  id="carrierId"
                  {...register("carrierId")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a carrier</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.carrierId && (
                <p className="text-xs text-destructive">
                  {errors.carrierId.message}
                </p>
              )}
            </div>

            {/* Customer Name */}
            <div className="space-y-1.5">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                placeholder="Jane Doe"
                {...register("customerName")}
              />
              {errors.customerName && (
                <p className="text-xs text-destructive">
                  {errors.customerName.message}
                </p>
              )}
            </div>

            {/* Customer Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="customerPhone">Customer Phone</Label>
              <Input
                id="customerPhone"
                type="tel"
                placeholder="(555) 555-5555"
                {...register("customerPhone")}
              />
              {errors.customerPhone && (
                <p className="text-xs text-destructive">
                  {errors.customerPhone.message}
                </p>
              )}
            </div>

            {/* Customer Address */}
            <div className="space-y-1.5">
              <Label htmlFor="customerAddress">Customer Address</Label>
              <Input
                id="customerAddress"
                placeholder="123 Main St, City, ST 12345"
                {...register("customerAddress")}
              />
              {errors.customerAddress && (
                <p className="text-xs text-destructive">
                  {errors.customerAddress.message}
                </p>
              )}
              {submitState.status === "duplicate" && selectedAddress && (
                <p className="text-xs text-amber-700">
                  Duplicate detected at: {selectedAddress}
                </p>
              )}
            </div>

            {/* Customer Email */}
            <div className="space-y-1.5">
              <Label htmlFor="customerEmail">Customer Email (optional)</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="jane@example.com"
                {...register("customerEmail")}
              />
              {errors.customerEmail && (
                <p className="text-xs text-destructive">
                  {errors.customerEmail.message}
                </p>
              )}
            </div>

            {/* Install Date */}
            <div className="space-y-1.5">
              <Label htmlFor="installDate">Install Date</Label>
              <Input
                id="installDate"
                type="date"
                {...register("installDate")}
              />
              {errors.installDate && (
                <p className="text-xs text-destructive">
                  {errors.installDate.message}
                </p>
              )}
              {selectedInstallDate && (
                <p className="text-xs text-muted-foreground">
                  Scheduled for{" "}
                  {format(new Date(selectedInstallDate), "EEEE, MMMM d, yyyy")}
                </p>
              )}
            </div>

            {/* Order Confirmation */}
            <div className="space-y-1.5">
              <Label htmlFor="orderConfirmation">
                Order Confirmation # (optional)
              </Label>
              <Input
                id="orderConfirmation"
                placeholder="ORD-123456"
                {...register("orderConfirmation")}
              />
              {errors.orderConfirmation && (
                <p className="text-xs text-destructive">
                  {errors.orderConfirmation.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || loadingData}
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : "Submit Sale"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
