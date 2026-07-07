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

const expenseSchema = z.object({
  category: z.enum(["HOUSING", "TRAVEL", "OPERATIONAL", "OTHER"]),
  amount: z.string().min(1, "Amount is required").transform((val) => {
    const n = Number(val)
    if (isNaN(n) || n <= 0) throw new Error("Amount must be positive")
    return n
  }),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
})

type ExpenseFormInput = { category: "HOUSING" | "TRAVEL" | "OPERATIONAL" | "OTHER"; amount: string; description: string; date: string }
type ExpenseFormValues = z.infer<typeof expenseSchema>

interface ExistingExpense {
  id: string
  category: "HOUSING" | "TRAVEL" | "OPERATIONAL" | "OTHER"
  amount: number
  description: string
  date: string | Date
}

interface ExpenseFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blitzId: string
  onSuccess?: () => void
  expense?: ExistingExpense | null
}

export function ExpenseForm({ open, onOpenChange, blitzId, onSuccess, expense }: ExpenseFormProps) {
  const isEdit = !!expense

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormInput, any, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: "OPERATIONAL",
      date: new Date().toISOString().split("T")[0],
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (expense) {
      const d = typeof expense.date === "string" ? expense.date.slice(0, 10) : expense.date.toISOString().slice(0, 10)
      reset({
        category: expense.category,
        date: d,
        amount: String(expense.amount),
        description: expense.description,
      })
    } else {
      reset({
        category: "OPERATIONAL",
        date: new Date().toISOString().split("T")[0],
        amount: "",
        description: "",
      })
    }
  }, [open, expense, reset])

  async function onSubmit(values: z.infer<typeof expenseSchema>) {
    const url = expense
      ? `/api/blitzes/${blitzId}/expenses/${expense.id}`
      : `/api/blitzes/${blitzId}/expenses`
    const res = await fetch(url, {
      method: expense ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const data = await res.json()
      console.error("Expense save error:", data)
      return
    }

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              {...register("category")}
              options={[
                { value: "HOUSING", label: "Housing" },
                { value: "TRAVEL", label: "Travel" },
                { value: "OPERATIONAL", label: "Operational" },
                { value: "OTHER", label: "Other" },
              ]}
            />
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              {...register("amount")}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Expense description..."
              rows={2}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
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
              {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
