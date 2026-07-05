"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  chargebackSchema,
  type ChargebackFormValues,
} from "@/lib/validators/common";

export function RecordChargebackForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ChargebackFormValues, any, ChargebackFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(chargebackSchema) as any,
    defaultValues: {
      saleId: "",
      amount: undefined,
      reason: "",
    },
  });

  async function onSubmit(data: ChargebackFormValues) {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/chargebacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      reset();
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record Chargeback</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="saleId">Sale ID</Label>
            <Input
              id="saleId"
              type="text"
              placeholder="e.g. clxyz123..."
              {...register("saleId")}
            />
            <p className="text-xs text-muted-foreground">
              Find the sale ID on the sale detail page.
            </p>
            {errors.saleId && (
              <p className="text-xs text-destructive">{errors.saleId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 250.00"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              rows={3}
              placeholder="Describe why this chargeback is being issued..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2">
              <p className="text-sm text-green-700">Chargeback recorded successfully.</p>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Recording..." : "Record Chargeback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
