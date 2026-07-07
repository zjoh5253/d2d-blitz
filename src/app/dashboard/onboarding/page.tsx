"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, UserPlus } from "lucide-react";

interface Pending {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  referralSource: string | null;
  onboardingData: {
    homeMarket?: string; experienceMonths?: number; priorCarriers?: string;
    peakMonthlyDeals?: number; references?: string; backgroundCheck?: string;
  } | null;
  blitzSignups: { status: string; blitz: { id: string; name: string } }[];
}

interface Waiver {
  id: string;
  reason: string;
  rep: { name: string | null; email: string };
  blitz: { id: string; name: string };
}

export default function OnboardingApprovalsPage() {
  const [reps, setReps] = useState<Pending[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, wRes] = await Promise.all([fetch("/api/onboarding/pending"), fetch("/api/penalty-waivers")]);
      if (rRes.ok) setReps(await rRes.json());
      if (wRes.ok) setWaivers(await wRes.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decideWaiver = async (id: string, action: "approve" | "deny") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/penalty-waivers/${id}/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Couldn't update."); }
      await load();
    } finally { setBusy(null); }
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm("Reject this applicant and release their held spot?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/onboarding/${id}/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Couldn't update."); }
      await load();
    } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-2">
      <header className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">New rep approvals</h1>
        {reps.length > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{reps.length}</span>}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : reps.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No applicants awaiting approval.</div>
      ) : (
        reps.map((r) => {
          const o = r.onboardingData ?? {};
          const hold = r.blitzSignups[0];
          return (
            <div key={r.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{r.name ?? r.email}</div>
                  <div className="text-xs text-muted-foreground">{r.email} · {r.phone}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decide(r.id, "approve")} disabled={busy === r.id} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                  </button>
                  <button onClick={() => decide(r.id, "reject")} disabled={busy === r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Home: {o.homeMarket ?? "—"}</span>
                <span>Experience: {o.experienceMonths ?? "—"} mo</span>
                <span>Peak deals/mo: {o.peakMonthlyDeals ?? "—"}</span>
                <span>Prior: {o.priorCarriers ?? "—"}</span>
                <span>Bg check: {o.backgroundCheck ?? "—"}</span>
                <span>Applied for: {hold ? `${hold.blitz.name} (${hold.status})` : "—"}</span>
              </div>
            </div>
          );
        })
      )}

      {/* No-penalty requests (Teki #8) */}
      <div className="pt-4">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          Penalty requests
          {waivers.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{waivers.length}</span>}
        </h2>
        {waivers.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">No pending penalty requests.</div>
        ) : (
          <div className="space-y-2">
            {waivers.map((w) => (
              <div key={w.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{w.rep.name ?? w.rep.email} · <span className="text-muted-foreground font-normal">{w.blitz.name}</span></div>
                    <div className="text-sm text-muted-foreground">“{w.reason}”</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => decideWaiver(w.id, "approve")} disabled={busy === w.id} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">
                      {busy === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Waive
                    </button>
                    <button onClick={() => decideWaiver(w.id, "deny")} disabled={busy === w.id} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-60">
                      <X className="h-4 w-4" /> Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
