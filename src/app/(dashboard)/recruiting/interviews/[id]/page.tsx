"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ArrowLeft, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  cultureFit: z.number().int().min(1).max(5),
  workEthic: z.number().int().min(1).max(5),
  travelReadiness: z.number().int().min(1).max(5),
  performanceExpectations: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  result: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  date: z.string().min(1, "Date is required"),
});

type FormValues = z.infer<typeof schema>;

function RatingField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={cn(
              "p-1 rounded transition-colors",
              star <= value
                ? "text-amber-400 hover:text-amber-500"
                : "text-muted-foreground hover:text-amber-300"
            )}
          >
            <Star
              className="h-5 w-5"
              fill={star <= value ? "currentColor" : "none"}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground self-center">
          {value}/5
        </span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface InterviewData {
  id: string;
  leadId: string;
  cultureFit: number;
  workEthic: number;
  travelReadiness: number;
  performanceExpectations: number;
  notes: string | null;
  result: "PENDING" | "APPROVED" | "REJECTED";
  date: string;
  lead: { id: string; name: string };
}

function InterviewForm({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = interviewId === "new";
  const leadIdFromQuery = searchParams.get("leadId") ?? "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<InterviewData | null>(null);
  const [leadName, setLeadName] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leadId: leadIdFromQuery,
      cultureFit: 3,
      workEthic: 3,
      travelReadiness: 3,
      performanceExpectations: 3,
      result: "PENDING",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  // Load existing interview data if editing
  useEffect(() => {
    if (!isNew) {
      fetch(`/api/interviews/${interviewId}`)
        .then((r) => r.json())
        .then((data: InterviewData) => {
          setInitialData(data);
          setLeadName(data.lead?.name ?? "");
          setValue("leadId", data.leadId);
          setValue("cultureFit", data.cultureFit);
          setValue("workEthic", data.workEthic);
          setValue("travelReadiness", data.travelReadiness);
          setValue("performanceExpectations", data.performanceExpectations);
          setValue("notes", data.notes ?? "");
          setValue("result", data.result);
          setValue("date", new Date(data.date).toISOString().slice(0, 10));
        })
        .catch(console.error);
    } else if (leadIdFromQuery) {
      fetch(`/api/leads/${leadIdFromQuery}`)
        .then((r) => r.json())
        .then((d: { name: string }) => setLeadName(d.name))
        .catch(console.error);
    }
  }, [interviewId, isNew, leadIdFromQuery, setValue]);

  async function onSubmit(data: FormValues) {
    setServerError(null);

    const url = isNew
      ? "/api/interviews"
      : `/api/interviews/${interviewId}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setServerError(err.error ?? "Failed to save interview");
      return;
    }

    const saved = await res.json() as { leadId: string };
    router.push(`/dashboard/recruiting/leads/${data.leadId ?? saved.leadId}`);
    router.refresh();
  }

  const backHref =
    watch("leadId") || initialData?.leadId
      ? `/dashboard/recruiting/leads/${watch("leadId") || initialData?.leadId}`
      : "/dashboard/recruiting";

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Schedule Interview" : "Edit Interview"}
          </h1>
          {leadName && (
            <p className="text-sm text-muted-foreground">for {leadName}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interview Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}

            <div className="space-y-1">
              <Label htmlFor="date">Interview Date *</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>

            <RatingField
              label="Culture Fit *"
              name="cultureFit"
              value={watch("cultureFit")}
              onChange={(v) => setValue("cultureFit", v)}
              error={errors.cultureFit?.message}
            />

            <RatingField
              label="Work Ethic *"
              name="workEthic"
              value={watch("workEthic")}
              onChange={(v) => setValue("workEthic", v)}
              error={errors.workEthic?.message}
            />

            <RatingField
              label="Travel Readiness *"
              name="travelReadiness"
              value={watch("travelReadiness")}
              onChange={(v) => setValue("travelReadiness", v)}
              error={errors.travelReadiness?.message}
            />

            <RatingField
              label="Performance Expectations *"
              name="performanceExpectations"
              value={watch("performanceExpectations")}
              onChange={(v) => setValue("performanceExpectations", v)}
              error={errors.performanceExpectations?.message}
            />

            <div className="space-y-1">
              <Label htmlFor="result">Result</Label>
              <Select
                id="result"
                value={watch("result")}
                onChange={(e) =>
                  setValue("result", e.target.value as FormValues["result"])
                }
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Interview notes..."
                {...register("notes")}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : isNew
                    ? "Create Interview"
                    : "Save Changes"}
              </Button>
              <Link href={backHref}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InterviewPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
      <InterviewForm interviewId={params.id} />
    </Suspense>
  );
}
