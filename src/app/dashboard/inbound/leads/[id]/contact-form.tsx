"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  outcome: z.enum([
    "NO_ANSWER",
    "VOICEMAIL",
    "SPOKE",
    "QUALIFIED",
    "NOT_INTERESTED",
  ]),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

const OUTCOME_OPTIONS = [
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "SPOKE", label: "Spoke with Customer" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
];

interface ContactFormProps {
  leadId: string;
  onSuccess?: () => void;
}

export function ContactForm({ leadId, onSuccess }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { outcome: "NO_ANSWER" },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/inbound-contact-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, leadId }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to log contact attempt");
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
        <Label htmlFor="outcome">Outcome</Label>
        <Select
          id="outcome"
          {...register("outcome")}
          options={OUTCOME_OPTIONS}
        />
        {errors.outcome && (
          <p className="text-xs text-destructive">{errors.outcome.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Details about the contact attempt..."
          rows={3}
          {...register("notes")}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Logging..." : "Log Contact Attempt"}
      </Button>
    </form>
  );
}
