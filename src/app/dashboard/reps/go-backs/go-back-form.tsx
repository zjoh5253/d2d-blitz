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
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"

const goBackSchema = z.object({
  prospectName: z.string().min(1, "Prospect name is required"),
  prospectPhone: z.string().optional().or(z.literal("")),
  prospectAddress: z.string().min(1, "Address is required"),
  followUpDate: z.string().min(1, "Follow-up date is required"),
  notes: z.string().optional().or(z.literal("")),
  blitzId: z.string().min(1, "Blitz is required"),
})

type GoBackFormValues = z.infer<typeof goBackSchema>

interface BlitzOption {
  id: string
  name: string
  market: { name: string }
}

interface GoBackFormProps {
  mode: "add" | "edit"
  goBackId?: string
  defaultValues?: Partial<GoBackFormValues>
  blitzes?: BlitzOption[]
}

export function GoBackForm({
  mode,
  goBackId,
  defaultValues,
  blitzes = [],
}: GoBackFormProps) {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [loadingBlitzes, setLoadingBlitzes] = React.useState(
    blitzes.length === 0
  )
  const [availableBlitzes, setAvailableBlitzes] =
    React.useState<BlitzOption[]>(blitzes)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoBackFormValues>({
    resolver: zodResolver(goBackSchema),
    defaultValues: {
      prospectName: "",
      prospectPhone: "",
      prospectAddress: "",
      followUpDate: "",
      notes: "",
      blitzId: "",
      ...defaultValues,
    },
  })

  React.useEffect(() => {
    if (blitzes.length > 0) {
      setLoadingBlitzes(false)
      return
    }
    async function fetchBlitzes() {
      try {
        const res = await fetch("/api/blitz-assignments/active")
        if (res.ok) {
          const data = await res.json()
          setAvailableBlitzes(data)
          if (data.length === 1 && !defaultValues?.blitzId) {
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
  }, [blitzes.length, defaultValues?.blitzId, reset])

  async function onSubmit(data: GoBackFormValues) {
    setError(null)
    try {
      const url =
        mode === "edit" && goBackId
          ? `/api/go-backs/${goBackId}`
          : "/api/go-backs"
      const method = mode === "edit" ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? "Failed to save go-back.")
        return
      }

      router.push("/dashboard/reps/go-backs")
      router.refresh()
    } catch {
      setError("An unexpected error occurred. Please try again.")
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{mode === "edit" ? "Edit Go-Back" : "Add Go-Back"}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Blitz */}
          <div className="space-y-1.5">
            <Label htmlFor="blitzId">Blitz</Label>
            {loadingBlitzes ? (
              <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
            ) : (
              <select
                id="blitzId"
                {...register("blitzId")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a blitz</option>
                {availableBlitzes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} &mdash; {b.market.name}
                  </option>
                ))}
              </select>
            )}
            {errors.blitzId && (
              <p className="text-xs text-destructive">{errors.blitzId.message}</p>
            )}
          </div>

          {/* Prospect Name */}
          <div className="space-y-1.5">
            <Label htmlFor="prospectName">Prospect Name</Label>
            <Input
              id="prospectName"
              placeholder="John Smith"
              {...register("prospectName")}
            />
            {errors.prospectName && (
              <p className="text-xs text-destructive">
                {errors.prospectName.message}
              </p>
            )}
          </div>

          {/* Prospect Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="prospectPhone">Phone (optional)</Label>
            <Input
              id="prospectPhone"
              type="tel"
              placeholder="(555) 555-5555"
              {...register("prospectPhone")}
            />
            {errors.prospectPhone && (
              <p className="text-xs text-destructive">
                {errors.prospectPhone.message}
              </p>
            )}
          </div>

          {/* Prospect Address */}
          <div className="space-y-1.5">
            <Label htmlFor="prospectAddress">Address</Label>
            <Input
              id="prospectAddress"
              placeholder="123 Main St, City, ST 12345"
              {...register("prospectAddress")}
            />
            {errors.prospectAddress && (
              <p className="text-xs text-destructive">
                {errors.prospectAddress.message}
              </p>
            )}
          </div>

          {/* Follow-Up Date */}
          <div className="space-y-1.5">
            <Label htmlFor="followUpDate">Follow-Up Date</Label>
            <Input
              id="followUpDate"
              type="date"
              {...register("followUpDate")}
            />
            {errors.followUpDate && (
              <p className="text-xs text-destructive">
                {errors.followUpDate.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Interested but needs to discuss with spouse..."
              rows={3}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || loadingBlitzes}>
              {isSubmitting
                ? "Saving..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Add Go-Back"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
