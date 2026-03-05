"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const leadSchema = z.object({
  source: z.string().min(1, "Source is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerEmail: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  qualificationNotes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

const SOURCE_OPTIONS = [
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "PAID_AD", label: "Paid Ad" },
  { value: "COLD_CALL", label: "Cold Call" },
  { value: "OTHER", label: "Other" },
];

interface LeadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function LeadForm({ onSuccess, onCancel }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  });

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/inbound-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to create lead");
      }

      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="source">Source</Label>
        <Select
          id="source"
          {...register("source")}
          options={SOURCE_OPTIONS}
          placeholder="Select source..."
        />
        {errors.source && (
          <p className="text-xs text-destructive">{errors.source.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerName">Customer Name</Label>
        <Input
          id="customerName"
          placeholder="John Smith"
          {...register("customerName")}
        />
        {errors.customerName && (
          <p className="text-xs text-destructive">
            {errors.customerName.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerPhone">Phone</Label>
        <Input
          id="customerPhone"
          type="tel"
          placeholder="(555) 000-0000"
          {...register("customerPhone")}
        />
        {errors.customerPhone && (
          <p className="text-xs text-destructive">
            {errors.customerPhone.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerEmail">Email (optional)</Label>
        <Input
          id="customerEmail"
          type="email"
          placeholder="john@example.com"
          {...register("customerEmail")}
        />
        {errors.customerEmail && (
          <p className="text-xs text-destructive">
            {errors.customerEmail.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qualificationNotes">Qualification Notes (optional)</Label>
        <Textarea
          id="qualificationNotes"
          placeholder="Any relevant details about the lead..."
          rows={3}
          {...register("qualificationNotes")}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Lead"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
