"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BanknoteArrowUp, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";

type OnboardingStatus = "NOT_STARTED" | "PENDING" | "ACTIVE" | "RESTRICTED";

interface ConnectStatus {
  connected: boolean;
  onboardingStatus: OnboardingStatus;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

const STATUS_META: Record<
  OnboardingStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  NOT_STARTED: { label: "Not started", variant: "outline", icon: <BanknoteArrowUp className="h-4 w-4" /> },
  PENDING: { label: "In progress", variant: "secondary", icon: <Clock className="h-4 w-4" /> },
  RESTRICTED: { label: "Needs attention", variant: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
  ACTIVE: { label: "Ready to get paid", variant: "default", icon: <CheckCircle2 className="h-4 w-4" /> },
};

export default function PaymentsPage() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/connect/status");
      if (!res.ok) throw new Error("Failed to load payout status");
      setStatus((await res.json()) as ConnectStatus);
    } catch {
      setError("Couldn't load your payout status. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function startOnboarding() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start onboarding");
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setError("Couldn't start Stripe setup. Please try again.");
      setStarting(false);
    }
  }

  const meta = status ? STATUS_META[status.onboardingStatus] : null;
  const isActive = status?.payoutsEnabled === true;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Get Paid</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connect a bank account so your commissions can be paid out directly to you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payout account</CardTitle>
            {meta && (
              <Badge variant={meta.variant} className="flex items-center gap-1.5">
                {meta.icon}
                {meta.label}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your payout status…
            </div>
          ) : isActive ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <p className="font-medium">You&apos;re all set.</p>
              <p className="mt-1">
                Your account is connected and payouts are enabled. Approved commissions will be
                deposited to your bank automatically.
              </p>
              <Button variant="outline" className="mt-4" onClick={startOnboarding} disabled={starting}>
                {starting ? "Opening…" : "Update bank details"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {status?.onboardingStatus === "RESTRICTED"
                  ? "Stripe needs a little more information before you can receive payouts. Finish setup to get paid."
                  : status?.onboardingStatus === "PENDING"
                    ? "You've started setup but haven't finished. Pick up where you left off."
                    : "Set up secure payouts through Stripe. It takes about two minutes — you'll add your bank account and verify your identity."}
              </p>
              <Button onClick={startOnboarding} disabled={starting}>
                {starting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Stripe…
                  </>
                ) : status?.connected ? (
                  "Finish payout setup"
                ) : (
                  "Connect bank account"
                )}
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-xs text-slate-400">
            Payouts are powered by Stripe. Your bank details are entered on Stripe&apos;s secure page —
            D2D Blitz never sees or stores them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
