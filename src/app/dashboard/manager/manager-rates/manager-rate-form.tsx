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
  rateSheetSchema,
  type RateSheetFormValues,
} from "@/lib/validators/common";

interface PrincipalOption {
  id: string;
  name: string | null;
  role: string;
}

interface CarrierOption {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
}

interface RateSheetRow {
  id: string;
  level: "OWNER" | "MANAGER";
  principalId: string;
  carrierId: string | null;
  productId: string | null;
  availableRevenue: number;
  effectiveDate: Date | string;
  active: boolean;
  overrideMinMargin?: boolean;
}

interface ManagerRateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet?: RateSheetRow | null;
  principals: PrincipalOption[];
  carriers: CarrierOption[];
}

function toDateString(val: Date | string | null | undefined): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function ManagerRateForm({
  open,
  onOpenChange,
  sheet,
  principals,
  carriers,
}: ManagerRateFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const isEdit = !!sheet;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<RateSheetFormValues, any, RateSheetFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(rateSheetSchema) as any,
    defaultValues: {
      level: "MANAGER",
      principalId: sheet?.principalId ?? "",
      carrierId: sheet?.carrierId ?? "",
      productId: sheet?.productId ?? "",
      availableRevenue: sheet?.availableRevenue ?? 0,
      effectiveDate: toDateString(sheet?.effectiveDate),
      active: sheet?.active ?? true,
      overrideMinMargin: sheet?.overrideMinMargin ?? false,
    },
  });

  const watchedCarrierId = watch("carrierId");

  // When carrier changes, fetch products and reset product
  useEffect(() => {
    if (!watchedCarrierId) {
      setProducts([]);
      setValue("productId", "");
      return;
    }

    setLoadingProducts(true);
    setValue("productId", "");

    fetch(`/api/products?carrierId=${watchedCarrierId}&active=true`)
      .then((res) => res.json())
      .then((data: ProductOption[]) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [watchedCarrierId, setValue]);

  // When dialog opens for edit, pre-load products for the saved carrier
  useEffect(() => {
    if (open && sheet?.carrierId) {
      setLoadingProducts(true);
      fetch(`/api/products?carrierId=${sheet.carrierId}&active=true`)
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
  }, [open, sheet?.carrierId]);

  // Re-populate form when sheet prop changes (switching edit targets)
  useEffect(() => {
    reset({
      level: "MANAGER",
      principalId: sheet?.principalId ?? "",
      carrierId: sheet?.carrierId ?? "",
      productId: sheet?.productId ?? "",
      availableRevenue: sheet?.availableRevenue ?? 0,
      effectiveDate: toDateString(sheet?.effectiveDate),
      active: sheet?.active ?? true,
      overrideMinMargin: sheet?.overrideMinMargin ?? false,
    });
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, open]);

  async function onSubmit(data: RateSheetFormValues) {
    setServerError(null);
    try {
      const url = isEdit ? `/api/rate-sheets/${sheet!.id}` : "/api/rate-sheets";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 422 = min-margin block — surface the API error message directly
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

  const principalOptions = [
    { value: "", label: "Select manager...", disabled: true },
    ...principals.map((p) => ({ value: p.id, label: p.name ?? p.id })),
  ];

  const carrierOptions = [
    { value: "", label: "Any carrier" },
    ...carriers.map((c) => ({ value: c.id, label: c.name })),
  ];

  const productOptions = [
    {
      value: "",
      label: watchedCarrierId ? "Any product" : "Select a carrier first",
    },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Manager Rate" : "Add Manager Rate"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Manager */}
          <div className="space-y-1.5">
            <Label htmlFor="principalId">Manager</Label>
            <Controller
              control={control}
              name="principalId"
              render={({ field }) => (
                <Select
                  id="principalId"
                  options={principalOptions}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                />
              )}
            />
            {errors.principalId && (
              <p className="text-xs text-destructive">
                {errors.principalId.message}
              </p>
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

          {/* Available Revenue */}
          <div className="space-y-1.5">
            <Label htmlFor="availableRevenue">Available Revenue ($)</Label>
            <Input
              id="availableRevenue"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 250.00"
              {...register("availableRevenue")}
            />
            {errors.availableRevenue && (
              <p className="text-xs text-destructive">
                {errors.availableRevenue.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Flat dollar amount granted to this manager per install.
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
              defaultChecked={sheet?.active ?? true}
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
                — grant this manager more than your own available revenue.
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
                  : "Create Manager Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
