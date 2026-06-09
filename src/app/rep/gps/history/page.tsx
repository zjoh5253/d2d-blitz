"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clock, MapPin, Pause as PauseIcon, Pencil, X } from "lucide-react";

interface SessionEdit {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
}
interface GpsSessionRow {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pausedSeconds: number;
  knockCount: number;
  routeMiles: number;
  edits?: SessionEdit[];
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
function pad(n: number): string { return n.toString().padStart(2, "0"); }
// ISO -> "YYYY-MM-DDTHH:MM" in the rep's local time for datetime-local inputs.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function groupByDay(sessions: GpsSessionRow[]): Map<string, GpsSessionRow[]> {
  const out = new Map<string, GpsSessionRow[]>();
  for (const s of sessions) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(s);
  }
  return out;
}
function formatDayHeader(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function RepGpsHistoryPage() {
  const [sessions, setSessions] = useState<GpsSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GpsSessionRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/gps-sessions");
      if (!res.ok) { setError("Couldn't load session history."); setSessions([]); return; }
      setSessions(await res.json());
    } catch { setError("Network error."); setSessions([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = sessions ? groupByDay(sessions) : new Map<string, GpsSessionRow[]>();
  const dayKeys = [...grouped.keys()].sort().reverse();
  const totalSeconds = sessions?.reduce((sum, s) => sum + s.durationSeconds, 0) ?? 0;
  const totalKnocks = sessions?.reduce((sum, s) => sum + s.knockCount, 0) ?? 0;
  const totalMiles = sessions?.reduce((sum, s) => sum + s.routeMiles, 0) ?? 0;

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link href="/rep/gps" className="text-gray-500 hover:text-gray-700">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Session History</h1>
          {sessions != null && (
            <p className="text-xs text-gray-500">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} · {formatHM(totalSeconds)} · {totalKnocks} knock{totalKnocks === 1 ? "" : "s"} · {totalMiles.toFixed(1)} mi
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sessions == null && <p className="text-center text-sm text-gray-500 py-8">Loading…</p>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">{error}</div>}
        {sessions != null && sessions.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <Clock className="size-12 mx-auto text-gray-300" />
            <p className="text-gray-500">No sessions logged yet.</p>
            <Link href="/rep/gps" className="inline-block text-sm text-blue-600 hover:underline">Start your first one →</Link>
          </div>
        )}
        {dayKeys.map((day) => {
          const daySessions = grouped.get(day)!;
          const daySeconds = daySessions.reduce((sum, s) => sum + s.durationSeconds, 0);
          return (
            <section key={day} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-gray-700">{formatDayHeader(day)}</h2>
                <p className="text-xs text-gray-500">{formatHM(daySeconds)}</p>
              </div>
              {daySessions.map((s) => (
                <SessionRow key={s.id} s={s} onEdit={() => setEditing(s)} />
              ))}
            </section>
          );
        })}
      </div>

      {editing && (
        <EditSheet
          session={editing}
          onClose={() => setEditing(null)}
          onSubmitted={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function SessionRow({ s, onEdit }: { s: GpsSessionRow; onEdit: () => void }) {
  const start = new Date(s.startedAt);
  const end = new Date(s.endedAt);
  const latest = s.edits?.[0];
  const pending = latest?.status === "PENDING";
  return (
    <div className="bg-white rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">
            {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {" – "}
            {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{s.knockCount} knock{s.knockCount === 1 ? "" : "s"}</span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{s.routeMiles.toFixed(2)} mi</span>
            {s.pausedSeconds > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-0.5"><PauseIcon className="size-3" />{Math.round(s.pausedSeconds / 60)}m paused</span>
              </>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-lg text-gray-900">{formatHM(s.durationSeconds)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t">
        {pending ? (
          <span className="text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Edit pending review</span>
        ) : latest?.status === "REJECTED" ? (
          <span className="text-xs text-red-600" title={latest.reviewNote ?? undefined}>Last edit rejected{latest.reviewNote ? ` — ${latest.reviewNote}` : ""}</span>
        ) : (
          <span className="text-xs text-gray-400">Net of breaks</span>
        )}
        <button
          onClick={onEdit}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 disabled:text-gray-300"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>
    </div>
  );
}

function EditSheet({ session, onClose, onSubmitted }: { session: GpsSessionRow; onClose: () => void; onSubmitted: () => void }) {
  const initStart = toLocalInput(session.startedAt);
  const initEnd = toLocalInput(session.endedAt);
  const initPaused = Math.round(session.pausedSeconds / 60).toString();
  const initKnocks = session.knockCount.toString();

  const [start, setStart] = useState(initStart);
  const [end, setEnd] = useState(initEnd);
  const [pausedMin, setPausedMin] = useState(initPaused);
  const [knocks, setKnocks] = useState(initKnocks);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = start !== initStart || end !== initEnd || pausedMin !== initPaused || knocks !== initKnocks;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (start !== initStart) body.proposedStartedAt = new Date(start).toISOString();
      if (end !== initEnd) body.proposedEndedAt = new Date(end).toISOString();
      if (pausedMin !== initPaused) body.proposedPausedSeconds = Math.max(0, parseInt(pausedMin || "0", 10)) * 60;
      if (knocks !== initKnocks) body.proposedKnockCount = Math.max(0, parseInt(knocks || "0", 10));
      if (reason) body.reason = reason;
      const res = await fetch(`/api/gps-sessions/${session.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
          <h2 className="font-semibold">Request time-log edit</h2>
          <button onClick={onClose}><X className="size-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">A manager reviews and approves your changes before they apply.</p>
          <Field label="Start"><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full h-11 px-3 rounded-lg border" /></Field>
          <Field label="End"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full h-11 px-3 rounded-lg border" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Break (minutes)"><input type="number" min={0} inputMode="numeric" value={pausedMin} onChange={(e) => setPausedMin(e.target.value)} className="w-full h-11 px-3 rounded-lg border" /></Field>
            <Field label="Knocks"><input type="number" min={0} inputMode="numeric" value={knocks} onChange={(e) => setKnocks(e.target.value)} className="w-full h-11 px-3 rounded-lg border" /></Field>
          </div>
          <p className="text-xs text-gray-400">Total hours recalculates from start, end, and break.</p>
          <Field label="Reason (optional)"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border" placeholder="e.g. forgot to clock out" /></Field>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
          <button onClick={submit} disabled={submitting || !changed} className="w-full bg-blue-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg">
            {submitting ? "Submitting…" : changed ? "Submit for approval" : "No changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}
