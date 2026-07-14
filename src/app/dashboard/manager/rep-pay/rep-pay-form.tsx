"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  repCommissionOverrideSchema,
  type RepCommissionOverrideFormValues,
} from "@/lib/validators/common";

interface RepOption {
  id: string;
  name: string | null;
}

interface CarrierOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
}

interface OverrideRow {
  id: string;
  repId: string;
  carrierId: string | null;
  productId: string | null;
  amount: number;
  effectiveDate: Date | string;
  active: boolean;
  overrideMinMargin?: boolean;
}

interface RepPayFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  override?: OverrideRow | null;
  reps: RepOption[];
  carriers: CarrierOption[];
}

export function RepPayForm({
  open,
  onOpenChange,
  override,
  reps,
  carriers,
}: RepPayFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const isEdit = !!override;

  // Normalise effectiveDate to "YYYY-MM-DD" string for the date input
  function toDateString(val: Date | string | null | undefined): string {
    if (!val) return "";
    try {
      const d = new Date(val);
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<RepCommissionOverrideFormValues, any, RepCommissionOverrideFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(repCommissionOverrideSchema) as any,
    defaultValues: {
      repId: override?.repId ?? "",
      carrierId: override?.carrierId ?? "",
      productId: override?.productId ?? "",
      amount: override?.amount ?? 0,
      effectiveDate: toDateString(override?.effectiveDate),
      active: override?.active ?? true,
      overrideMinMargin: override?.overrideMinMargin ?? false,
    },
  });

  const watchedCarrierId = watch("carrierId");

  // When carrier changes, fetch its products. Preserve the selected product if
  // it belongs to the new carrier (so an edit keeps its saved product-scope);
  // clear it only when it's stale for the newly chosen carrier.
  useEffect(() => {
    if (!watchedCarrierId) {
      setProducts([]);
      setValue("productId", "");
      return;
    }

    setLoadingProducts(true);

    fetch(`/api/products?carrierId=${watchedCarrierId}&active=true`)
      .then((res) => res.json())
      .then((data: ProductOption[]) => {
        const list = Array.isArray(data) ? data : [];
        setProducts(list);
        const current = getValues("productId");
        if (current && !list.some((p) => p.id === current)) {
          setValue("productId", "");
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [watchedCarrierId, setValue, getValues]);

  // When the dialog opens for edit, pre-load products for the saved carrier
  useEffect(() => {
    if (open && override?.carrierId) {
      setLoadingProducts(true);
      fetch(`/api/products?carrierId=${override.carrierId}&active=true`)
        .then((res) => res.json())
        .then((data: ProductOption[]) => {
          setProducts(Array.isArray(data) ? data : []);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));
    }
    if (!open) {
      setProducts([]);
    }
  }, [open, override?.carrierId]);

  // Re-populate form when override prop changes (switching edit targets)
  useEffect(() => {
    reset({
      repId: override?.repId ?? "",
      carrierId: override?.carrierId ?? "",
      productId: override?.productId ?? "",
      amount: override?.amount ?? 0,
      effectiveDate: toDateString(override?.effectiveDate),
      active: override?.active ?? true,
      overrideMinMargin: override?.overrideMinMargin ?? false,
    });
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, open]);

  async function onSubmit(data: RepCommissionOverrideFormValues) {
    setServerError(null);
    try {
      const url = isEdit
        ? `/api/rep-commissions/${override!.id}`
        : "/api/rep-commissions";
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
    setProducts([]);
    onOpenChange(false);
  }

  const repOptions = [
    { value: "", label: "Select rep...", disabled: true },
    ...reps.map((r) => ({ value: r.id, label: r.name ?? r.id })),
  ];

  const carrierOptions = [
    { value: "", label: "Any carrier" },
    ...carriers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const productOptions = [
    { value: "", label: watchedCarrierId ? "Any product" : "Select a carrier first" },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Rep Pay" : "Add Rep Pay"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Rep */}
          <div className="space-y-1.5">
            <Label htmlFor="repId">Rep</Label>
            <Select
              id="repId"
              options={repOptions}
              {...register("repId")}
            />
            {errors.repId && (
              <p className="text-xs text-destructive">{errors.repId.message}</p>
            )}
          </div>

          {/* Carrier (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="carrierId">Carrier (optional)</Label>
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
            <p className="text-xs text-muted-foreground">
              Leave as &ldquo;Any carrier&rdquo; to apply across all carriers.
            </p>
          </div>

          {/* Product (optional, filtered by carrier) */}
          <div className="space-y-1.5">
            <Label htmlFor="productId">Product (optional)</Label>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select
                  id="productId"
                  options={productOptions}
                  disabled={!watchedCarrierId || loadingProducts}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
            {errors.productId && (
              <p className="text-xs text-destructive">
                {errors.productId.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave as &ldquo;Any product&rdquo; to apply to all products for
              the selected carrier.
            </p>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount per Install ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 125.00"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">
                {errors.amount.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Flat dollar amount paid per verified install. Bypasses tier
              multiplier.
            </p>
          </div>

          {/* Effective Date */}
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

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register("active")}
              defaultChecked={override?.active ?? true}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Active
            </Label>
          </div>

          {/* Override minimum margin */}
          <div className="flex items-center gap-2">
            <input
              id="overrideMinMargin"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register("overrideMinMargin")}
            />
            <Label
              htmlFor="overrideMinMargin"
              className="cursor-pointer font-normal"
            >
              Override{" "}
              <span className="text-muted-foreground">
                — pay this rep more than your own available revenue.
              </span>
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
                  : "Create Rep Pay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
