"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const marketSchema = z.object({
  name: z.string().min(1, "Name is required"),
  carrierId: z.string().min(1, "Carrier is required"),
  ownerId: z.string().min(1, "Owner is required"),
  coverageArea: z.string().optional().or(z.literal("")),
  competitionNotes: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "PLANNING"]),
})

type MarketFormValues = z.infer<typeof marketSchema>

interface Carrier {
  id: string
  name: string
}

interface MarketOwner {
  id: string
  name: string | null
  email: string
}

export interface Market {
  id: string
  name: string
  carrierId: string
  ownerId: string
  coverageArea: string | null
  competitionNotes: string | null
  status: "ACTIVE" | "INACTIVE" | "PLANNING"
  [key: string]: unknown
}

interface MarketFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  carriers: Carrier[]
  marketOwners: MarketOwner[]
  market?: Market
  onSuccess?: () => void
}

export function MarketForm({
  open,
  onOpenChange,
  carriers,
  marketOwners,
  market,
  onSuccess,
}: MarketFormProps) {
  const isEdit = !!market

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MarketFormValues>({
    resolver: zodResolver(marketSchema),
    defaultValues: {
      name: market?.name ?? "",
      carrierId: market?.carrierId ?? "",
      ownerId: market?.ownerId ?? "",
      coverageArea: market?.coverageArea ?? "",
      competitionNotes: market?.competitionNotes ?? "",
      status: market?.status ?? "ACTIVE",
    },
  })

  React.useEffect(() => {
    if (open) {
      reset({
        name: market?.name ?? "",
        carrierId: market?.carrierId ?? "",
        ownerId: market?.ownerId ?? "",
        coverageArea: market?.coverageArea ?? "",
        competitionNotes: market?.competitionNotes ?? "",
        status: market?.status ?? "ACTIVE",
      })
    }
  }, [open, market, reset])

  async function onSubmit(values: MarketFormValues) {
    const url = isEdit ? `/api/markets/${market!.id}` : "/api/markets"
    const method = isEdit ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json()
      console.error("Market save error:", data)
      return
    }

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Market" : "Add Market"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} placeholder="Market name" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="carrierId">Carrier</Label>
            <Select
              id="carrierId"
              {...register("carrierId")}
              placeholder="Select carrier"
              options={carriers.map((c) => ({ value: c.id, label: c.name }))}
            />
            {errors.carrierId && (
              <p className="text-xs text-destructive">{errors.carrierId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ownerId">Market Owner</Label>
            <Select
              id="ownerId"
              {...register("ownerId")}
              placeholder="Select owner"
              options={marketOwners.map((u) => ({
                value: u.id,
                label: u.name ?? u.email,
              }))}
            />
            {errors.ownerId && (
              <p className="text-xs text-destructive">{errors.ownerId.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="coverageArea">Coverage Area</Label>
            <Input
              id="coverageArea"
              {...register("coverageArea")}
              placeholder="e.g. Phoenix Metro, AZ"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="competitionNotes">Competition Notes</Label>
            <Textarea
              id="competitionNotes"
              {...register("competitionNotes")}
              placeholder="Notes about competition in this market..."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              {...register("status")}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "PLANNING", label: "Planning" },
              ]}
            />
            {errors.status && (
              <p className="text-xs text-destructive">{errors.status.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Create Market"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
