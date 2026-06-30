"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, MapPin, Calendar, Users, Loader2, CheckCircle2, Clock, Mail, X } from "lucide-react";
import Link from "next/link";
import { BoardNotifyBanner } from "./notify-banner";

type SignupStatus = "CLAIMED" | "WAITLISTED" | "ACTIVE" | "DECLINED" | "WITHDRAWN";
type InviteStatus = "pending" | "viewed" | "accepted" | "declined" | "expired";

interface Invite {
  id: string;
  status: InviteStatus;
  expiresAt: string | null;
  blitz: { id: string; name: string; carrier: string; market: string; startDate: string; endDate: string };
}

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
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "invites" | "mine">("board");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [boardRes, invRes] = await Promise.all([
        fetch("/api/blitz-board"),
        fetch("/api/blitz-invites"),
      ]);
      if (boardRes.ok) setBlitzes(await boardRes.json());
      if (invRes.ok) setInvites(await invRes.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const mine = useMemo(() => blitzes.filter((b) => activeSignup(b)), [blitzes]);
  // Invites still awaiting a decision drive the tab badge.
  const openInvites = useMemo(() => invites.filter((i) => i.status === "pending" || i.status === "viewed"), [invites]);
  const shown = view === "mine" ? mine : blitzes;

  const respondInvite = async (inviteId: string, action: "accept" | "decline") => {
    setBusy(inviteId);
    try {
      const res = await fetch(`/api/blitz-invites/${inviteId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Couldn't respond to this invite.");
      }
      await load();
    } finally { setBusy(null); }
  };

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
        {(["board", "invites", "mine"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-full py-1.5 ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {v === "board" ? "Open" : v === "invites" ? (
              <span className="inline-flex items-center justify-center gap-1">
                Invites
                {openInvites.length > 0 && (
                  <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">{openInvites.length}</span>
                )}
              </span>
            ) : `Mine${mine.length ? ` (${mine.length})` : ""}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : view === "invites" ? (
        invites.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
            No invites yet. A manager can invite you straight to a blitz.
          </div>
        ) : (
          invites.map((inv) => <InviteCard key={inv.id} inv={inv} busy={busy === inv.id} onRespond={respondInvite} />)
        )
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

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `Expires in ${h}h` : "Expires soon";
}

function InviteCard({
  inv,
  busy,
  onRespond,
}: {
  inv: Invite;
  busy: boolean;
  onRespond: (id: string, action: "accept" | "decline") => void;
}) {
  const open = inv.status === "pending" || inv.status === "viewed";
  const exp = expiryLabel(inv.expiresAt);
  return (
    <div className={`bg-white rounded-lg border p-3 space-y-2.5 ${open ? "border-blue-200" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{inv.blitz.name}</div>
          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{inv.blitz.market} · {inv.blitz.carrier}</span>
            <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{dateRange(inv.blitz.startDate, inv.blitz.endDate)}</span>
          </div>
        </div>
        {inv.status === "accepted" && <Pill className="bg-green-100 text-green-700"><CheckCircle2 className="size-3" />Accepted</Pill>}
        {inv.status === "declined" && <Pill className="bg-gray-100 text-gray-500">Declined</Pill>}
        {inv.status === "expired" && <Pill className="bg-gray-100 text-gray-500">Expired</Pill>}
      </div>

      {open ? (
        <>
          <div className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
            <Mail className="size-3.5" /> You're invited{exp ? ` · ${exp}` : ""}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onRespond(inv.id, "accept")}
              disabled={busy}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? "…" : "Accept"}
            </button>
            <button
              onClick={() => onRespond(inv.id, "decline")}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60"
            >
              <X className="size-4" /> Decline
            </button>
          </div>
        </>
      ) : inv.status === "accepted" ? (
        <Link href="/rep/board" className="block text-xs text-gray-500">Spot reserved — see “Mine”.</Link>
      ) : null}
    </div>
  );
}
