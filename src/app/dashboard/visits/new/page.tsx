"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Outcome = "NOT_HOME" | "NOT_INTERESTED" | "CALLBACK" | "SALE";

const OUTCOMES: { value: Outcome; label: string; color: string }[] = [
  { value: "NOT_HOME", label: "Not Home", color: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200" },
  { value: "NOT_INTERESTED", label: "Not Interested", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
  { value: "CALLBACK", label: "Callback", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { value: "SALE", label: "Sale!", color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
];

const SELECTED_COLORS: Record<Outcome, string> = {
  NOT_HOME: "bg-slate-600 text-white border-slate-600",
  NOT_INTERESTED: "bg-red-600 text-white border-red-600",
  CALLBACK: "bg-amber-500 text-white border-amber-500",
  SALE: "bg-green-600 text-white border-green-600",
};

type PageState = "idle" | "submitting" | "success" | "error";

export default function LogVisitPage() {
  const router = useRouter();
  const [address, setAddress] = React.useState("");
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [notes, setNotes] = React.useState("");
  const [pageState, setPageState] = React.useState<PageState>("idle");
  const [errorMsg, setErrorMsg] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || !outcome) return;

    setPageState("submitting");
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), outcome, notes: notes.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed to log visit.");
        setPageState("error");
        return;
      }

      setPageState("success");
    } catch {
      setErrorMsg("An unexpected error occurred.");
      setPageState("error");
    }
  }

  function handleReset() {
    setAddress("");
    setOutcome(null);
    setNotes("");
    setPageState("idle");
    setErrorMsg("");
  }

  if (pageState === "success") {
    return (
      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Visit Logged!</h2>
            <p className="text-muted-foreground text-sm mt-1">Keep knocking — every door counts.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={handleReset} className="w-full">
            Log Another Visit
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/visits")} className="w-full">
            View My Visits
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Log a Visit</h1>
          <p className="text-xs text-muted-foreground">Record your door knock quickly.</p>
        </div>
      </div>

      {pageState === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm">{errorMsg}</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Visit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-sm font-semibold">
                Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder="123 Main St, City, ST"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                inputMode="text"
                className="text-base"
                required
              />
            </div>

            {/* Outcome */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Outcome <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(({ value, label, color }) => {
                  const isSelected = outcome === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOutcome(value)}
                      className={[
                        "rounded-lg border px-3 py-3 text-sm font-semibold transition-all",
                        isSelected ? SELECTED_COLORS[value] : color,
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="notes"
                placeholder="Best time to call back, interest level, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={!address.trim() || !outcome || pageState === "submitting"}
            >
              {pageState === "submitting" ? "Logging..." : "Log Visit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
