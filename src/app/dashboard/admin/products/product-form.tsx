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
  DialogFooter,
} from "@/components/ui/dialog";
import { productSchema, type ProductFormValues } from "@/lib/validators/common";

interface CarrierOption {
  id: string;
  name: string;
}

interface ProductRow {
  id: string;
  carrierId: string;
  name: string;
  revenue: number;
  minMarginPercent: number | null;
  active: boolean;
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductRow | null;
  carriers: CarrierOption[];
}

export function ProductForm({
  open,
  onOpenChange,
  product,
  carriers,
}: ProductFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ProductFormValues, any, ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      carrierId: product?.carrierId ?? "",
      name: product?.name ?? "",
      revenue: product?.revenue ?? 0,
      minMarginPercent: product?.minMarginPercent ?? undefined,
      active: product?.active ?? true,
    },
  });

  async function onSubmit(data: ProductFormValues) {
    setServerError(null);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Product" : "Add Product"}
          </DialogTitle>
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
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              placeholder="e.g. Internet 500, TV Select"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="revenue">Revenue per Install ($)</Label>
            <Input
              id="revenue"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 150.00"
              {...register("revenue")}
            />
            {errors.revenue && (
              <p className="text-xs text-destructive">
                {errors.revenue.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="minMarginPercent">Min Margin % (optional)</Label>
            <Input
              id="minMarginPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="carrier default"
              {...register("minMarginPercent")}
            />
            {errors.minMarginPercent && (
              <p className="text-xs text-destructive">
                {errors.minMarginPercent.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave blank to use the carrier-level minimum.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              {...register("active")}
              defaultChecked={product?.active ?? true}
            />
            <Label htmlFor="active" className="cursor-pointer">
              Active
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
                  : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
