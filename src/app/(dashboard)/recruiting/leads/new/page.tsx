"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  source: z.enum(["COLD", "SOCIAL", "REFERRAL", "PAID"]),
  travelCapable: z.boolean().optional(),
  commitmentLevel: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewLeadPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      source: "COLD",
      travelCapable: false,
    },
  });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setServerError(err.error ?? "Failed to create lead");
      return;
    }

    router.push("/dashboard/recruiting");
    router.refresh();
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/recruiting"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add Lead</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}

            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" type="tel" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="source">Source *</Label>
              <Select
                id="source"
                value={watch("source")}
                onChange={(e) =>
                  setValue("source", e.target.value as FormValues["source"])
                }
              >
                <option value="COLD">Cold</option>
                <option value="SOCIAL">Social</option>
                <option value="REFERRAL">Referral</option>
                <option value="PAID">Paid</option>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="commitmentLevel">Commitment Level</Label>
              <Input
                id="commitmentLevel"
                placeholder="e.g. Full-time, Part-time"
                {...register("commitmentLevel")}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="travelCapable"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...register("travelCapable")}
              />
              <Label htmlFor="travelCapable" className="font-normal">
                Travel Capable
              </Label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Any additional notes..."
                {...register("notes")}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Lead"}
              </Button>
              <Link href="/dashboard/recruiting">
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
