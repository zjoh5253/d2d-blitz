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
import { carrierSchema, type CarrierFormValues } from "@/lib/validators/common";

interface CarrierRow {
  id: string;
  name: string;
  revenuePerInstall: number;
  portalUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
}

interface CarrierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier?: CarrierRow | null;
}

export function CarrierForm({ open, onOpenChange, carrier }: CarrierFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!carrier;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<CarrierFormValues, any, CarrierFormValues>({
    resolver: zodResolver(carrierSchema) as any,
    defaultValues: {
      name: carrier?.name ?? "",
      revenuePerInstall: carrier?.revenuePerInstall ?? 0,
      portalUrl: carrier?.portalUrl ?? "",
      status: carrier?.status ?? "ACTIVE",
    },
  });

  async function onSubmit(data: CarrierFormValues) {
    setServerError(null);
    try {
      const url = isEdit ? `/api/carriers/${carrier!.id}` : "/api/carriers";
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
          <DialogTitle>{isEdit ? "Edit Carrier" : "Add Carrier"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Carrier Name</Label>
            <Input
              id="name"
              placeholder="e.g. Spectrum, DirecTV"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="revenuePerInstall">Revenue per Install ($)</Label>
            <Input
              id="revenuePerInstall"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 150.00"
              {...register("revenuePerInstall")}
            />
            {errors.revenuePerInstall && (
              <p className="text-xs text-destructive">
                {errors.revenuePerInstall.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portalUrl">Portal URL (optional)</Label>
            <Input
              id="portalUrl"
              type="url"
              placeholder="https://portal.example.com"
              {...register("portalUrl")}
            />
            {errors.portalUrl && (
              <p className="text-xs text-destructive">
                {errors.portalUrl.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              {...register("status")}
            />
            {errors.status && (
              <p className="text-xs text-destructive">
                {errors.status.message}
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
                  : "Create Carrier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
