"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Clock, MapPin, Pause as PauseIcon } from "lucide-react";

interface GpsSessionRow {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pausedSeconds: number;
  knockCount: number;
  routeMiles: number;
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
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
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export default function RepGpsHistoryPage() {
  const [sessions, setSessions] = useState<GpsSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // The /api/gps-sessions GET defaults to current rep, returns up
        // to 100 most recent sessions. Sufficient for foreseeable
        // history view; switch to paged if reps log >100 sessions.
        const res = await fetch("/api/gps-sessions");
        if (!res.ok) {
          setError("Couldn't load session history.");
          setSessions([]);
          return;
        }
        const data: GpsSessionRow[] = await res.json();
        setSessions(data);
      } catch {
        setError("Network error.");
        setSessions([]);
      }
    })();
  }, []);

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
        {sessions == null && (
          <p className="text-center text-sm text-gray-500 py-8">Loading…</p>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">
            {error}
          </div>
        )}
        {sessions != null && sessions.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <Clock className="size-12 mx-auto text-gray-300" />
            <p className="text-gray-500">No sessions logged yet.</p>
            <Link
              href="/rep/gps"
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Start your first one →
            </Link>
          </div>
        )}
        {dayKeys.map((day) => {
          const daySessions = grouped.get(day)!;
          const daySeconds = daySessions.reduce((sum, s) => sum + s.durationSeconds, 0);
          return (
            <section key={day} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-gray-700">
                  {formatDayHeader(day)}
                </h2>
                <p className="text-xs text-gray-500">{formatHM(daySeconds)}</p>
              </div>
              {daySessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SessionRow({ s }: { s: GpsSessionRow }) {
  const start = new Date(s.startedAt);
  const end = new Date(s.endedAt);
  return (
    <div className="bg-white rounded-lg border p-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">
          {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {" – "}
          {end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{s.knockCount} knock{s.knockCount === 1 ? "" : "s"}</span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-3" />
            {s.routeMiles.toFixed(2)} mi
          </span>
          {s.pausedSeconds > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="inline-flex items-center gap-0.5">
                <PauseIcon className="size-3" />
                {Math.round(s.pausedSeconds / 60)}m paused
              </span>
            </>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-lg text-gray-900">{formatHM(s.durationSeconds)}</p>
      </div>
    </div>
  );
}
