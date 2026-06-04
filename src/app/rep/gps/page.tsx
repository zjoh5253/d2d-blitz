"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Square, Plus, X, CheckCircle2, ThumbsUp, Home, ThumbsDown, Calendar } from "lucide-react";
import { RepGpsMap, type GpsKnock, type GpsRoutePoint, type KnockResult } from "./rep-gps-map";

// Foreground browser GPS tracking. Best-effort — when the browser tab
// backgrounds (rep locks phone), the watchPosition stream pauses and
// resumes when foregrounded. Native app stays running in the background.

const STORAGE_KEY = "rep-gps-session-v1";

interface PauseInterval {
  pausedAt: number;
  resumedAt: number | null;
}

interface SessionState {
  startedAt: number;
  route: GpsRoutePoint[];
  knocks: GpsKnock[];
  pauses?: PauseInterval[];
}

interface PastSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  pausedSeconds: number;
  knockCount: number;
  routeMiles: number;
}

// Aligned disposition palette (rep-requested 2026-06-04): green = sale,
// teal = interested, yellow = no answer, blue = follow up, red = no sale.
const KNOCK_OPTIONS: Array<{ result: KnockResult; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { result: "sale",           label: "Sale",          icon: CheckCircle2, color: "bg-green-600" },
  { result: "interested",     label: "Interested",    icon: ThumbsUp,     color: "bg-teal-500" },
  { result: "not_home",       label: "Not Home",      icon: Home,         color: "bg-yellow-500" },
  { result: "follow_up",      label: "Follow Up",     icon: Calendar,     color: "bg-blue-600" },
  { result: "not_interested", label: "No Interest",   icon: ThumbsDown,   color: "bg-red-600" },
];

function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

function saveSession(s: SessionState | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

function haversineMiles(a: GpsRoutePoint, b: GpsRoutePoint): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isCurrentlyPaused(session: SessionState | null): boolean {
  if (!session?.pauses?.length) return false;
  const last = session.pauses[session.pauses.length - 1];
  return last.resumedAt === null;
}

function pausedMsTotal(session: SessionState, asOf: number): number {
  return (session.pauses ?? []).reduce(
    (sum, p) => sum + ((p.resumedAt ?? asOf) - p.pausedAt),
    0
  );
}

function activeSeconds(session: SessionState, asOf: number): number {
  const elapsed = asOf - session.startedAt;
  const paused = pausedMsTotal(session, asOf);
  return Math.max(0, Math.floor((elapsed - paused) / 1000));
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
  const [session, setSession] = useState<SessionState | null>(() => loadSession());
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [knockSheetOpen, setKnockSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const paused = isCurrentlyPaused(session);

  // Re-render every second for the timer — pause the interval when paused
  // so we don't burn cycles updating a frozen display.
  useEffect(() => {
    if (!session || paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session, paused]);

  // GPS watcher — runs only while a session is active AND not paused.
  // When paused we keep `current` as last known location for the map.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    if (!session || paused) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setPermissionState("denied"),
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrent(p);
        setSession((prev) => {
          if (!prev) return prev;
          const last = prev.route[prev.route.length - 1];
          if (last && haversineMiles(last, p) < 0.003) return prev;
          const next = { ...prev, route: [...prev.route, p] };
          saveSession(next);
          return next;
        });
        setPermissionState("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermissionState("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [!!session, paused]);

  const fetchToday = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/gps-sessions?date=${today}`);
      if (res.ok) setPastSessions(await res.json());
    } catch {
      // Non-fatal — likely the gps_sessions table isn't migrated yet.
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const start = () => {
    const fresh: SessionState = { startedAt: Date.now(), route: [], knocks: [], pauses: [] };
    setSession(fresh);
    saveSession(fresh);
  };

  const togglePause = () => {
    if (!session) return;
    setSession((prev) => {
      if (!prev) return prev;
      const pauses = [...(prev.pauses ?? [])];
      const last = pauses[pauses.length - 1];
      if (last && last.resumedAt === null) {
        // Currently paused — resume
        pauses[pauses.length - 1] = { ...last, resumedAt: Date.now() };
      } else {
        // Running — pause
        pauses.push({ pausedAt: Date.now(), resumedAt: null });
      }
      const next = { ...prev, pauses };
      saveSession(next);
      return next;
    });
  };

  const finish = async () => {
    if (!session) return;
    if (!window.confirm("End this tracking session and save the record?")) return;

    const endedAt = Date.now();
    const closedPauses = (session.pauses ?? []).map((p) => ({
      pausedAt: p.pausedAt,
      resumedAt: p.resumedAt ?? endedAt,
    }));
    const pausedMs = closedPauses.reduce((sum, p) => sum + (p.resumedAt - p.pausedAt), 0);
    const durationSeconds = Math.max(0, Math.floor((endedAt - session.startedAt - pausedMs) / 1000));
    const routeMiles = session.route.reduce(
      (sum, p, i) => (i === 0 ? 0 : sum + haversineMiles(session.route[i - 1], p)),
      0
    );

    let saved = false;
    try {
      const res = await fetch("/api/gps-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: new Date(session.startedAt).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          durationSeconds,
          pausedSeconds: Math.floor(pausedMs / 1000),
          knockCount: session.knocks.length,
          routeMiles,
        }),
      });
      saved = res.ok;
    } catch (err) {
      console.error("Failed to save GPS session", err);
    }

    if (!saved) {
      window.alert(
        "Couldn't save the session record. Your data is still here — try Finish again in a moment."
      );
      return;
    }

    setSession(null);
    saveSession(null);
    fetchToday();
  };

  const logKnock = (result: KnockResult) => {
    if (!current) {
      window.alert("Waiting for a GPS fix — try again in a moment.");
      return;
    }
    setSession((prev) => {
      if (!prev) return prev;
      const k: GpsKnock = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lat: current.lat,
        lng: current.lng,
        result,
        timestamp: Date.now(),
      };
      const next = { ...prev, knocks: [...prev.knocks, k] };
      saveSession(next);
      return next;
    });
    setKnockSheetOpen(false);
    // Sale knocks jump straight to the New Sale form so the rep can
    // capture customer details without leaving GPS for the Sales tab.
    // Pass the current GPS fix so the form can reverse-geocode it into
    // a street address.
    if (result === "sale") {
      const params = new URLSearchParams({
        lat: String(current.lat),
        lng: String(current.lng),
      });
      router.push(`/rep/sales/new?${params}`);
    }
  };

  const liveSeconds = session ? activeSeconds(session, now) : 0;
  const timerLabel = formatHMS(liveSeconds);

  const miles = session
    ? session.route.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineMiles(session.route[i - 1], p)), 0)
    : 0;

  const totalSecondsToday =
    pastSessions.reduce((sum, s) => sum + s.durationSeconds, 0) + liveSeconds;

  return (
    <div className="flex h-screen flex-col">
      {/* Header bar */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold">GPS Tracking</h1>
          {session ? (
            <p className="text-xs text-gray-500 truncate">
              {timerLabel} · {miles.toFixed(2)} mi · {session.knocks.length} knocks
              {paused && <span className="text-blue-600 font-medium"> · Paused</span>}
            </p>
          ) : (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
            >
              Today: {formatHM(totalSecondsToday)} · {pastSessions.length} session{pastSessions.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {session ? (
            <>
              <button
                onClick={togglePause}
                className={`flex items-center gap-1.5 rounded-full text-white px-3 py-2 text-sm font-medium ${
                  paused ? "bg-emerald-600" : "bg-amber-500"
                }`}
              >
                {paused ? (
                  <>
                    <Play className="size-4" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="size-4" /> Pause
                  </>
                )}
              </button>
              <button
                onClick={finish}
                className="flex items-center gap-1.5 rounded-full bg-red-600 text-white px-3 py-2 text-sm font-medium"
              >
                <Square className="size-4" /> Finish
              </button>
            </>
          ) : (
            <button
              onClick={start}
              disabled={permissionState === "denied" || permissionState === "unsupported"}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 disabled:bg-gray-300 text-white px-4 py-2 text-sm font-medium"
            >
              <Play className="size-4" /> Start
            </button>
          )}
        </div>
      </div>

      {/* Caveat banner */}
      {session && !paused && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-[11px] text-amber-900">
          Keep this tab open while walking. Browser GPS pauses if you lock your screen.
        </div>
      )}
      {paused && (
        <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 text-xs text-blue-900 text-center">
          Paused — tap Resume to continue logging hours.
        </div>
      )}
      {permissionState === "denied" && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-2 text-xs text-red-700">
          Location permission denied. Enable it in your browser settings to track routes.
        </div>
      )}
      {permissionState === "unsupported" && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-2 text-xs text-red-700">
          Your browser doesn&apos;t support geolocation.
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative">
        <RepGpsMap
          route={session?.route ?? []}
          knocks={session?.knocks ?? []}
          current={current}
        />

        {/* Log-a-knock FAB — only shown while actively tracking (not paused). */}
        {session && !paused && (
          <button
            onClick={() => setKnockSheetOpen(true)}
            className="fixed right-4 bottom-24 z-30 flex items-center gap-2 rounded-full bg-blue-600 text-white px-5 py-3 font-medium shadow-lg"
          >
            <Plus className="size-5" />
            Log knock
          </button>
        )}
      </div>

      {/* Knock sheet */}
      {knockSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setKnockSheetOpen(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-t-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Log a knock at your location</h2>
              <button onClick={() => setKnockSheetOpen(false)}>
                <X className="size-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {KNOCK_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.result}
                    onClick={() => logKnock(opt.result)}
                    className={`flex flex-col items-center justify-center gap-1.5 ${opt.color} text-white py-4 rounded-lg font-medium`}
                  >
                    <Icon className="size-6" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* History sheet — today's logged sessions */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
              <div>
                <h2 className="font-semibold">Today&apos;s Sessions</h2>
                <p className="text-xs text-gray-500 mt-0.5">Total: {formatHM(totalSecondsToday)}</p>
              </div>
              <button onClick={() => setHistoryOpen(false)}>
                <X className="size-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {pastSessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No sessions logged today yet.
                </p>
              ) : (
                pastSessions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border rounded-lg p-3 flex items-center justify-between gap-3"
                  >
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
                    <div className="font-bold text-lg text-gray-900 shrink-0">
                      {formatHM(s.durationSeconds)}
                    </div>
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
