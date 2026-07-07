"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { agreementSchema, type AgreementFormValues } from "@/lib/validators/common";

interface AgreementRow {
  id: string;
  type: "REP_AGREEMENT" | "GPS_CONSENT" | "TAX_W9" | "BACKGROUND_CHECK";
  title: string;
  body: string;
  version: number;
  required: boolean;
  blocking: boolean;
  requiresUpload: boolean;
  isActive: boolean;
}

interface AgreementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreement?: AgreementRow | null;
}

export function AgreementForm({ open, onOpenChange, agreement }: AgreementFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!agreement;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<AgreementFormValues, any, AgreementFormValues>({
    resolver: zodResolver(agreementSchema) as any,
    defaultValues: {
      type: agreement?.type ?? "REP_AGREEMENT",
      title: agreement?.title ?? "",
      body: agreement?.body ?? "",
      version: agreement?.version ?? 1,
      required: agreement?.required ?? true,
      blocking: agreement?.blocking ?? true,
      requiresUpload: agreement?.requiresUpload ?? false,
      isActive: agreement?.isActive ?? true,
    },
  });

  async function onSubmit(data: AgreementFormValues) {
    setServerError(null);
    try {
      const url = isEdit ? `/api/agreements/${agreement!.id}` : "/api/agreements";
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
      <DialogContent onClose={handleClose} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agreement" : "Add Agreement"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              options={[
                { value: "REP_AGREEMENT", label: "Rep Agreement" },
                { value: "GPS_CONSENT", label: "GPS Consent" },
                { value: "TAX_W9", label: "Tax W-9" },
                { value: "BACKGROUND_CHECK", label: "Background Check" },
              ]}
              {...register("type")}
            />
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Rep Agreement v1"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">Body (Markdown)</Label>
            <Textarea
              id="body"
              placeholder="Enter agreement content in Markdown..."
              className="min-h-[160px]"
              {...register("body")}
            />
            {errors.body && (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              {...register("version")}
            />
            {errors.version && (
              <p className="text-xs text-destructive">{errors.version.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                id="required"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("required")}
              />
              <Label htmlFor="required" className="cursor-pointer">
                Required
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="blocking"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("blocking")}
              />
              <Label htmlFor="blocking" className="cursor-pointer">
                Blocking (gates app access)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="requiresUpload"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("requiresUpload")}
              />
              <Label htmlFor="requiresUpload" className="cursor-pointer">
                Requires Upload (e.g. W-9)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("isActive")}
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active
              </Label>
            </div>
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
                  : "Create Agreement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
