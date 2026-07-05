"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  holdbackPolicySchema,
  type HoldbackPolicyFormValues,
} from "@/lib/validators/common";
import { format } from "date-fns";

interface CarrierOption {
  id: string;
  name: string;
}

interface HoldbackPolicyRow {
  id: string;
  carrierId: string | null;
  holdbackPercent: number;
  holdbackDays: number;
  effectiveDate: Date | string;
}

interface HoldbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: HoldbackPolicyRow | null;
  carriers: CarrierOption[];
}

export function HoldbackForm({
  open,
  onOpenChange,
  policy,
  carriers,
}: HoldbackFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!policy;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<HoldbackPolicyFormValues, any, HoldbackPolicyFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(holdbackPolicySchema) as any,
    defaultValues: {
      carrierId: policy?.carrierId ?? "",
      holdbackPercent: policy?.holdbackPercent ?? 10,
      holdbackDays: policy?.holdbackDays ?? 180,
      effectiveDate: policy?.effectiveDate
        ? format(new Date(policy.effectiveDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
    },
  });

  async function onSubmit(data: HoldbackPolicyFormValues) {
    setServerError(null);
    try {
      const url = isEdit
        ? `/api/holdback-policies/${policy!.id}`
        : "/api/holdback-policies";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onOpenChange(false);
  }

  const carrierOptions = [
    { value: "", label: "Global default (all carriers)" },
    ...carriers.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Holdback Policy" : "Add Holdback Policy"}
          </DialogTitle>
          <DialogDescription>
            Set the holdback percentage and hold duration. Leave carrier blank to
            create a global default that applies to all carriers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="carrierId">Carrier</Label>
            <Select
              id="carrierId"
              options={carrierOptions}
              {...register("carrierId")}
            />
            {errors.carrierId && (
              <p className="text-xs text-destructive">
                {errors.carrierId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="holdbackPercent">Holdback %</Label>
            <Input
              id="holdbackPercent"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="e.g. 10"
              {...register("holdbackPercent")}
            />
            {errors.holdbackPercent && (
              <p className="text-xs text-destructive">
                {errors.holdbackPercent.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="holdbackDays">Hold Days</Label>
            <Input
              id="holdbackDays"
              type="number"
              step="1"
              min="0"
              max="365"
              placeholder="e.g. 180"
              {...register("holdbackDays")}
            />
            {errors.holdbackDays && (
              <p className="text-xs text-destructive">
                {errors.holdbackDays.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input
              id="effectiveDate"
              type="date"
              {...register("effectiveDate")}
            />
            {errors.effectiveDate && (
              <p className="text-xs text-destructive">
                {errors.effectiveDate.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
