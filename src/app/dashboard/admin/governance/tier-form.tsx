"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  governanceTierSchema,
  type GovernanceTierFormValues,
} from "@/lib/validators/common";

interface GovernanceTierRow {
  id: string;
  name: string;
  rank: number;
  minInstallRate: number;
  commissionMultiplier: number;
  isDefault: boolean;
}

interface TierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier?: GovernanceTierRow | null;
}

export function TierForm({ open, onOpenChange, tier }: TierFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!tier;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<GovernanceTierFormValues, any, GovernanceTierFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(governanceTierSchema) as any,
    defaultValues: {
      name: tier?.name ?? "",
      rank: tier?.rank ?? 1,
      minInstallRate: tier?.minInstallRate ?? 0,
      commissionMultiplier: tier?.commissionMultiplier ?? 1.0,
      isDefault: tier?.isDefault ?? false,
    },
  });

  async function onSubmit(data: GovernanceTierFormValues) {
    setServerError(null);
    try {
      const url = isEdit
        ? `/api/governance-tiers/${tier!.id}`
        : "/api/governance-tiers";
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Governance Tier" : "Add Governance Tier"}
          </DialogTitle>
          <DialogDescription>
            Configure the install rate threshold and commission multiplier for
            this tier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Tier Name</Label>
            <Input
              id="name"
              placeholder="e.g. Gold, Silver, Bronze"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rank">Rank</Label>
            <Input
              id="rank"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 1"
              {...register("rank")}
            />
            {errors.rank && (
              <p className="text-xs text-destructive">{errors.rank.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minInstallRate">
              Min Install Rate (0 – 1, e.g. 0.8 = 80%)
            </Label>
            <Input
              id="minInstallRate"
              type="number"
              step="0.01"
              min="0"
              max="1"
              placeholder="e.g. 0.80"
              {...register("minInstallRate")}
            />
            {errors.minInstallRate && (
              <p className="text-xs text-destructive">
                {errors.minInstallRate.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commissionMultiplier">
              Commission Multiplier (e.g. 1.0 = 100%)
            </Label>
            <Input
              id="commissionMultiplier"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 1.0"
              {...register("commissionMultiplier")}
            />
            {errors.commissionMultiplier && (
              <p className="text-xs text-destructive">
                {errors.commissionMultiplier.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isDefault"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              {...register("isDefault")}
            />
            <Label htmlFor="isDefault" className="cursor-pointer">
              Set as default tier
            </Label>
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
                  : "Create Tier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
