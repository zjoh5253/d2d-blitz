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
  stackConfigSchema,
  type StackConfigFormValues,
} from "@/lib/validators/common";
import { format } from "date-fns";

interface CarrierOption {
  id: string;
  name: string;
}

interface MarketOption {
  id: string;
  name: string;
}

interface StackConfigRow {
  id: string;
  carrierId: string;
  marketId: string | null;
  companyFloorPercent: number;
  managerOverridePercent: number;
  marketOwnerSpreadPercent: number;
  effectiveDate: Date | string;
}

interface StackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: StackConfigRow | null;
  carriers: CarrierOption[];
  markets: MarketOption[];
}

export function StackForm({
  open,
  onOpenChange,
  config,
  carriers,
  markets,
}: StackFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!config;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<StackConfigFormValues, any, StackConfigFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(stackConfigSchema) as any,
    defaultValues: {
      carrierId: config?.carrierId ?? "",
      marketId: config?.marketId ?? "",
      companyFloorPercent: config?.companyFloorPercent ?? 0,
      managerOverridePercent: config?.managerOverridePercent ?? 0,
      marketOwnerSpreadPercent: config?.marketOwnerSpreadPercent ?? 0,
      effectiveDate: config?.effectiveDate
        ? format(new Date(config.effectiveDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
    },
  });

  const company = watch("companyFloorPercent") ?? 0;
  const manager = watch("managerOverridePercent") ?? 0;
  const marketOwner = watch("marketOwnerSpreadPercent") ?? 0;
  const total = Number(company) + Number(manager) + Number(marketOwner);

  async function onSubmit(data: StackConfigFormValues) {
    setServerError(null);
    try {
      const url = isEdit
        ? `/api/stack-configs/${config!.id}`
        : "/api/stack-configs";
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
    { value: "", label: "Select carrier...", disabled: true },
    ...carriers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const marketOptions = [
    { value: "", label: "All markets (global)" },
    ...markets.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Stack Config" : "Add Stack Config"}
          </DialogTitle>
          <DialogDescription>
            Configure the revenue split percentages for a carrier and optional
            market. Total must not exceed 100%.
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
            <Label htmlFor="marketId">Market (optional)</Label>
            <Select
              id="marketId"
              options={marketOptions}
              {...register("marketId")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyFloorPercent">Company Floor %</Label>
              <Input
                id="companyFloorPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 30"
                {...register("companyFloorPercent")}
              />
              {errors.companyFloorPercent && (
                <p className="text-xs text-destructive">
                  {errors.companyFloorPercent.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="managerOverridePercent">
                Manager Override %
              </Label>
              <Input
                id="managerOverridePercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 10"
                {...register("managerOverridePercent")}
              />
              {errors.managerOverridePercent && (
                <p className="text-xs text-destructive">
                  {errors.managerOverridePercent.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="marketOwnerSpreadPercent">
                Market Owner Spread %
              </Label>
              <Input
                id="marketOwnerSpreadPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="e.g. 5"
                {...register("marketOwnerSpreadPercent")}
              />
              {errors.marketOwnerSpreadPercent && (
                <p className="text-xs text-destructive">
                  {errors.marketOwnerSpreadPercent.message}
                </p>
              )}
            </div>
          </div>

          <div
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              total > 100
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Total allocated: {total.toFixed(2)}%
            {total > 100 && " — exceeds 100%"}
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
            <Button type="submit" disabled={isSubmitting || total > 100}>
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Config"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
