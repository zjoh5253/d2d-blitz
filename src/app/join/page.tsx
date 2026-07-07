"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { BLITZ_TERMS } from "@/lib/onboarding";

interface Ctx { name: string; carrier: string }

export default function OnboardingPage() {
  const [ref, setRef] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [f, setF] = useState({
    name: "", email: "", phone: "", password: "",
    homeMarket: "", experienceMonths: "", priorCarriers: "", peakMonthlyDeals: "", references: "", carrierCredential: "",
    backgroundCheckAuthorized: false, w9Acknowledged: false, termsAccepted: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    setRef(r);
    if (r) fetch(`/api/onboarding/context?token=${encodeURIComponent(r)}`).then((res) => res.json()).then((d) => d.blitz && setCtx(d.blitz)).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.backgroundCheckAuthorized || !f.w9Acknowledged || !f.termsAccepted) {
      setError("Please authorize the background check, acknowledge the W-9/1099, and accept the blitz terms.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, ref: ref ?? undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Couldn't submit your application."); return; }
      setDone(true);
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <CheckCircle2 className="mx-auto size-12 text-green-600" />
          <h1 className="text-xl font-bold">Application submitted</h1>
          <p className="text-sm text-gray-600">Thanks! A manager will review your application and approve you shortly. You&apos;ll be able to sign in once you&apos;re approved.</p>
          <Link href="/login" className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 flex justify-center">
      <form onSubmit={submit} className="w-full max-w-lg space-y-5">
        <header>
          <h1 className="text-2xl font-bold">Join Fiber Blitz</h1>
          <p className="text-sm text-gray-500">{ctx ? `Applying via ${ctx.name} (${ctx.carrier})` : "New rep application"}</p>
        </header>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">Identity</h2>
          <div><label className={label}>Full name</label><input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Email</label><input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} required /></div>
            <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Home market</label><input className={input} value={f.homeMarket} onChange={(e) => set("homeMarket", e.target.value)} placeholder="City, ST" /></div>
            <div><label className={label}>Set a password</label><input type="password" className={input} value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={8} /></div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">Experience</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>D2D experience (months)</label><input type="number" min={0} className={input} value={f.experienceMonths} onChange={(e) => set("experienceMonths", e.target.value)} /></div>
            <div><label className={label}>Peak monthly deals</label><input type="number" min={0} className={input} value={f.peakMonthlyDeals} onChange={(e) => set("peakMonthlyDeals", e.target.value)} /></div>
          </div>
          <div><label className={label}>Prior carriers</label><input className={input} value={f.priorCarriers} onChange={(e) => set("priorCarriers", e.target.value)} placeholder="e.g. Kinetic, AT&T" /></div>
          <div><label className={label}>Required credential (if any)</label><input className={input} value={f.carrierCredential} onChange={(e) => set("carrierCredential", e.target.value)} placeholder="e.g. Kinetic certified" /></div>
          <div><label className={label}>References (optional)</label><input className={input} value={f.references} onChange={(e) => set("references", e.target.value)} /></div>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">Credentials &amp; terms</h2>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={f.backgroundCheckAuthorized} onChange={(e) => set("backgroundCheckAuthorized", e.target.checked)} /> I authorize a background check.</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={f.w9Acknowledged} onChange={(e) => set("w9Acknowledged", e.target.checked)} /> I acknowledge the W-9 / 1099 contractor status.</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
            {BLITZ_TERMS.map((t) => <div key={t}>• {t}</div>)}
          </div>
          <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-0.5" checked={f.termsAccepted} onChange={(e) => set("termsAccepted", e.target.checked)} /> I accept the blitz terms above.</label>
        </section>

        <button type="submit" disabled={submitting} className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Submitting…</span> : "Submit application"}
        </button>
      </form>
    </div>
  );
}
