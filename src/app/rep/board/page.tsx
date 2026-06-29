"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, MapPin, Calendar, Users, Loader2, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { BoardNotifyBanner } from "./notify-banner";

type SignupStatus = "CLAIMED" | "WAITLISTED" | "ACTIVE" | "DECLINED" | "WITHDRAWN";

interface BoardBlitz {
  id: string;
  name: string;
  market: string;
  carrier: string;
  startDate: string;
  endDate: string;
  repCap: number;
  knockable: number;
  claimed: number;
  waitlisted: number;
  spotsLeft: number;
  manager: string;
  mySignup: { status: SignupStatus; waitPosition: number | null } | null;
}

// A signup only "counts" (rep is on this blitz) when CLAIMED/WAITLISTED/ACTIVE.
// WITHDRAWN/DECLINED behave like "not signed up" so the rep can re-claim.
function activeSignup(b: BoardBlitz) {
  const s = b.mySignup?.status;
  return s === "CLAIMED" || s === "WAITLISTED" || s === "ACTIVE" ? b.mySignup : null;
}

function dateRange(a: string, b: string) {
  const f = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${f(a)} – ${f(b)}`;
}

export default function RepBoardPage() {
  const [blitzes, setBlitzes] = useState<BoardBlitz[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "mine">("board");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blitz-board");
      if (res.ok) setBlitzes(await res.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const mine = useMemo(() => blitzes.filter((b) => activeSignup(b)), [blitzes]);
  const shown = view === "mine" ? mine : blitzes;

  const claim = async (b: BoardBlitz) => {
    setBusy(b.id);
    try {
      const res = await fetch(`/api/blitz-board/${b.id}/claim`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Couldn't claim this blitz.");
      }
      await load();
    } finally { setBusy(null); }
  };

  const withdraw = async (b: BoardBlitz) => {
    if (!window.confirm(`Withdraw from ${b.name}?`)) return;
    setBusy(b.id);
    try {
      const res = await fetch(`/api/blitz-board/${b.id}/claim`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Couldn't withdraw.");
      }
      await load();
    } finally { setBusy(null); }
  };

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-lg font-bold">Blitz Board</h1>
        <p className="text-xs text-gray-500">Claim a spot on an upcoming blitz</p>
      </header>

      <BoardNotifyBanner />

      <div className="flex rounded-full bg-gray-100 p-1 text-sm font-medium">
        {(["board", "mine"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-full py-1.5 ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {v === "board" ? "Open blitzes" : `My blitzes${mine.length ? ` (${mine.length})` : ""}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          {view === "mine" ? "You haven't claimed any blitzes yet." : "No open blitzes right now. Check back soon."}
        </div>
      ) : (
        shown.map((b) => {
          const sig = activeSignup(b);
          const full = b.spotsLeft <= 0;
          const pct = b.repCap > 0 ? Math.min(100, Math.round((b.claimed / b.repCap) * 100)) : 0;
          return (
            <div key={b.id} className="bg-white rounded-lg border p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold leading-tight">{b.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{b.market} · {b.carrier}</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{dateRange(b.startDate, b.endDate)}</span>
                  </div>
                </div>
                {sig && <StatusPill sig={sig} />}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                  <Briefcase className="size-3.5" />{b.knockable.toLocaleString()} knockable
                </span>
                <span className="text-gray-400">·</span>
                <span>Mgr {b.manager}</span>
              </div>

              {/* Capacity */}
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full ${full ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Users className="size-3" />
                    {full ? `Full · ${b.waitlisted} on waitlist` : `${b.claimed} / ${b.repCap} spots`}
                  </span>
                </div>
              </div>

              {/* Action */}
              {!sig ? (
                <button
                  onClick={() => claim(b)}
                  disabled={busy === b.id}
                  className={`w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60 ${full ? "bg-amber-600" : "bg-blue-600"}`}
                >
                  {busy === b.id ? "…" : full ? "Join waitlist" : "Claim spot"}
                </button>
              ) : sig.status === "ACTIVE" ? (
                <Link href="/rep/leads" className="block w-full rounded-lg bg-green-600 py-2.5 text-center text-sm font-medium text-white">
                  Go to my leads
                </Link>
              ) : (
                <button
                  onClick={() => withdraw(b)}
                  disabled={busy === b.id}
                  className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60"
                >
                  {busy === b.id ? "…" : "Withdraw"}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function StatusPill({ sig }: { sig: { status: SignupStatus; waitPosition: number | null } }) {
  if (sig.status === "ACTIVE")
    return <Pill className="bg-green-100 text-green-700"><CheckCircle2 className="size-3" />Active</Pill>;
  if (sig.status === "WAITLISTED")
    return <Pill className="bg-amber-100 text-amber-700"><Clock className="size-3" />Waitlist #{sig.waitPosition ?? "?"}</Pill>;
  return <Pill className="bg-blue-100 text-blue-700"><CheckCircle2 className="size-3" />Reserved</Pill>;
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
