"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Square, Plus, X, CheckCircle2, ThumbsUp, Home, ThumbsDown, Calendar } from "lucide-react";
import { RepGpsMap, type KnockResult } from "./rep-gps-map";
import { useGpsSession } from "@/components/gps-session-context";

// The standalone GPS tab. Drives the SAME session as the Leads-map status bar
// (both read the shared GpsSessionProvider), so a session started anywhere
// keeps running everywhere.

const KNOCK_OPTIONS: Array<{ result: KnockResult; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { result: "sale",           label: "Sale",        icon: CheckCircle2, color: "bg-green-600" },
  { result: "interested",     label: "Interested",  icon: ThumbsUp,     color: "bg-teal-500" },
  { result: "not_home",       label: "Not Home",    icon: Home,         color: "bg-yellow-500" },
  { result: "follow_up",      label: "Follow Up",   icon: Calendar,     color: "bg-blue-600" },
  { result: "not_interested", label: "No Interest", icon: ThumbsDown,   color: "bg-red-600" },
];

interface PastSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pausedSeconds: number;
  knockCount: number;
  routeMiles: number;
}

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export default function RepGpsPage() {
  const router = useRouter();
  const gps = useGpsSession();
  const [knockSheetOpen, setKnockSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);

  const fetchToday = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/gps-sessions?date=${today}`);
      if (res.ok) setPastSessions(await res.json());
    } catch {
      // Non-fatal.
    }
  }, []);
  useEffect(() => { fetchToday(); }, [fetchToday]);

  const onFinish = async () => {
    const ok = await gps.finish();
    if (ok) fetchToday();
  };

  const onLogKnock = (result: KnockResult) => {
    if (!gps.current) { window.alert("Waiting for a GPS fix — try again in a moment."); return; }
    gps.logKnock(result);
    setKnockSheetOpen(false);
    if (result === "sale") {
      const params = new URLSearchParams({ lat: String(gps.current.lat), lng: String(gps.current.lng) });
      router.push(`/rep/sales/new?${params}`);
    }
  };

  const totalSecondsToday = pastSessions.reduce((sum, s) => sum + s.durationSeconds, 0) + gps.seconds;

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">GPS Tracking</h1>
          {gps.active ? (
            <p className="text-xs text-gray-500 truncate">
              {formatHMS(gps.seconds)} · {gps.miles.toFixed(2)} mi · {gps.knockCount} knocks
              {gps.paused && <span className="text-blue-600 font-medium"> · Paused</span>}
            </p>
          ) : (
            <button onClick={() => setHistoryOpen(true)} className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline">
              Today: {formatHM(totalSecondsToday)} · {pastSessions.length} session{pastSessions.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {gps.active ? (
            <>
              <button onClick={gps.togglePause} className={`flex items-center gap-1.5 rounded-full text-white px-3 py-2 text-sm font-medium ${gps.paused ? "bg-emerald-600" : "bg-amber-500"}`}>
                {gps.paused ? <><Play className="size-4" /> Resume</> : <><Pause className="size-4" /> Pause</>}
              </button>
              <button onClick={onFinish} className="flex items-center gap-1.5 rounded-full bg-red-600 text-white px-3 py-2 text-sm font-medium">
                <Square className="size-4" /> Finish
              </button>
            </>
          ) : (
            <button onClick={gps.start} disabled={gps.permissionState === "denied" || gps.permissionState === "unsupported"} className="flex items-center gap-1.5 rounded-full bg-emerald-600 disabled:bg-gray-300 text-white px-4 py-2 text-sm font-medium">
              <Play className="size-4" /> Start
            </button>
          )}
        </div>
      </div>

      {gps.active && !gps.paused && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-[11px] text-amber-900">
          Keep this tab open while walking. Browser GPS pauses if you lock your screen.
        </div>
      )}
      {gps.paused && (
        <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 text-xs text-blue-900 text-center">
          Paused — tap Resume to continue logging hours.
        </div>
      )}
      {gps.permissionState === "denied" && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-2 text-xs text-red-700">
          Location permission denied. Enable it in your browser settings to track routes.
        </div>
      )}
      {gps.permissionState === "unsupported" && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-2 text-xs text-red-700">
          Your browser doesn&apos;t support geolocation.
        </div>
      )}

      <div className="flex-1 relative">
        <RepGpsMap route={gps.route} knocks={gps.knocks} current={gps.current} />
        {gps.active && !gps.paused && (
          <button onClick={() => setKnockSheetOpen(true)} className="fixed right-4 bottom-24 z-30 flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3 font-medium shadow-lg">
            <Plus className="size-5" /> Log knock
          </button>
        )}
      </div>

      {knockSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setKnockSheetOpen(false); }}>
          <div className="w-full max-w-md bg-white rounded-t-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Log a knock at your location</h2>
              <button onClick={() => setKnockSheetOpen(false)}><X className="size-5 text-gray-500" /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {KNOCK_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button key={opt.result} onClick={() => onLogKnock(opt.result)} className={`flex flex-col items-center justify-center gap-1.5 ${opt.color} text-white py-4 rounded-lg font-medium`}>
                    <Icon className="size-6" /> {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}>
          <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
              <div>
                <h2 className="font-semibold">Today&apos;s Sessions</h2>
                <p className="text-xs text-gray-500 mt-0.5">Total: {formatHM(totalSecondsToday)}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)}><X className="size-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-2">
              {pastSessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No sessions logged today yet.</p>
              ) : (
                pastSessions.map((s) => (
                  <div key={s.id} className="bg-white border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">
                        {new Date(s.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {" – "}
                        {new Date(s.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.knockCount} knock{s.knockCount === 1 ? "" : "s"} · {s.routeMiles.toFixed(2)} mi
                        {s.pausedSeconds > 0 && ` · ${Math.round(s.pausedSeconds / 60)}m paused`}
                      </div>
                    </div>
                    <div className="font-bold text-lg text-gray-900 shrink-0">{formatHM(s.durationSeconds)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
