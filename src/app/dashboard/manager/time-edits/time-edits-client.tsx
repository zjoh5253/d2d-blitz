"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Clock } from "lucide-react";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Edit {
  id: string;
  proposedStartedAt: string | null;
  proposedEndedAt: string | null;
  proposedPausedSeconds: number | null;
  proposedKnockCount: number | null;
  reason: string | null;
  status: Status;
  reviewNote: string | null;
  createdAt: string;
  rep: { id: string; name: string | null; email: string };
  reviewer: { id: string; name: string | null } | null;
  session: {
    id: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    pausedSeconds: number;
    knockCount: number;
    blitz: { name: string } | null;
  };
}

const TABS: Status[] = ["PENDING", "APPROVED", "REJECTED"];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${m.toString().padStart(2, "0")}m`;
}
// Total after the proposed edit applies (mirrors the API's recompute).
function projectedDuration(e: Edit): number {
  const start = new Date(e.proposedStartedAt ?? e.session.startedAt).getTime();
  const end = new Date(e.proposedEndedAt ?? e.session.endedAt).getTime();
  const paused = e.proposedPausedSeconds ?? e.session.pausedSeconds;
  return Math.max(0, Math.floor((end - start) / 1000) - paused);
}

function DiffRow({ label, from, to }: { label: string; from: string; to: string }) {
  const changed = from !== to;
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>
        {changed ? (
          <>
            <span className="text-muted-foreground line-through mr-2">{from}</span>
            <span className="font-medium text-blue-700">{to}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{from}</span>
        )}
      </span>
    </div>
  );
}

export function TimeEditsClient() {
  const [tab, setTab] = useState<Status>("PENDING");
  const [edits, setEdits] = useState<Edit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/time-log-edits?status=${tab}`);
      if (r.ok) setEdits(await r.json());
      else setEdits([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    try {
      const reviewNote = action === "reject" ? (window.prompt("Reason for rejecting (optional):") ?? undefined) : undefined;
      const r = await fetch(`/api/time-log-edits/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote }),
      });
      if (r.ok) load();
      else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Failed"); }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium border ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : edits.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Clock className="size-8 text-gray-300" />
            No {tab.toLowerCase()} time-log edits.
          </CardContent>
        </Card>
      ) : (
        edits.map((e) => {
          const s = e.session;
          return (
            <Card key={e.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{e.rep.name ?? e.rep.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Requested {fmtDateTime(e.createdAt)}
                      {s.blitz ? ` · ${s.blitz.name}` : ""}
                    </div>
                  </div>
                  {e.status !== "PENDING" && (
                    <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${e.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {e.status.charAt(0) + e.status.slice(1).toLowerCase()}
                      {e.reviewer?.name ? ` by ${e.reviewer.name}` : ""}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border bg-gray-50 p-3">
                  <DiffRow label="Start" from={fmtDateTime(s.startedAt)} to={fmtDateTime(e.proposedStartedAt ?? s.startedAt)} />
                  <DiffRow label="End" from={fmtDateTime(s.endedAt)} to={fmtDateTime(e.proposedEndedAt ?? s.endedAt)} />
                  <DiffRow label="Break" from={`${Math.round(s.pausedSeconds / 60)}m`} to={`${Math.round((e.proposedPausedSeconds ?? s.pausedSeconds) / 60)}m`} />
                  <DiffRow label="Knocks" from={`${s.knockCount}`} to={`${e.proposedKnockCount ?? s.knockCount}`} />
                  <DiffRow label="Total hours" from={fmtHM(s.durationSeconds)} to={fmtHM(projectedDuration(e))} />
                </div>

                {e.reason && <p className="text-sm"><span className="text-muted-foreground">Reason: </span>{e.reason}</p>}
                {e.reviewNote && <p className="text-sm"><span className="text-muted-foreground">Review note: </span>{e.reviewNote}</p>}

                {e.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => review(e.id, "approve")}
                      disabled={busy === e.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 disabled:bg-gray-300 text-white text-sm font-medium py-2"
                    >
                      <Check className="size-4" /> Approve
                    </button>
                    <button
                      onClick={() => review(e.id, "reject")}
                      disabled={busy === e.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white border border-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium py-2"
                    >
                      <X className="size-4" /> Reject
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
