"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Plus, X, CheckCircle2, ThumbsUp, Home, ThumbsDown, Calendar } from "lucide-react";
import { RepGpsMap, type GpsKnock, type GpsRoutePoint, type KnockResult } from "./rep-gps-map";

// Foreground browser GPS tracking. Best-effort — when the browser tab
// backgrounds (rep locks phone), the watchPosition stream pauses and
// resumes when foregrounded. Native app stays running in the background.

const STORAGE_KEY = "rep-gps-session-v1";

interface SessionState {
  startedAt: number;
  route: GpsRoutePoint[];
  knocks: GpsKnock[];
}

const KNOCK_OPTIONS: Array<{ result: KnockResult; label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { result: "sale",           label: "Sale",          icon: CheckCircle2, color: "bg-emerald-600" },
  { result: "interested",     label: "Interested",    icon: ThumbsUp,     color: "bg-blue-600" },
  { result: "not_home",       label: "Not Home",      icon: Home,         color: "bg-orange-500" },
  { result: "follow_up",      label: "Follow Up",     icon: Calendar,     color: "bg-yellow-500" },
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
  const R = 3958.8; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function RepGpsPage() {
  const [session, setSession] = useState<SessionState | null>(() => loadSession());
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [knockSheetOpen, setKnockSheetOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const watchIdRef = useRef<number | null>(null);

  // Re-render every second for the timer.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  // Manage geolocation watcher.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    if (!session) {
      // Not tracking — just grab a one-shot fix for the map.
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
          // Skip near-duplicate points to keep the route trim.
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
  }, [!!session]);

  const start = () => {
    const fresh: SessionState = { startedAt: Date.now(), route: [], knocks: [] };
    setSession(fresh);
    saveSession(fresh);
  };

  const stop = () => {
    if (!session) return;
    if (!window.confirm("End this tracking session? Your route + knocks will be cleared.")) return;
    setSession(null);
    saveSession(null);
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
  };

  const duration = session ? Math.floor((now - session.startedAt) / 1000) : 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  const timerLabel = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const miles = session
    ? session.route.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineMiles(session.route[i - 1], p)), 0)
    : 0;

  return (
    <div className="flex h-screen flex-col">
      {/* Header bar */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">GPS Tracking</h1>
          {session && (
            <p className="text-xs text-gray-500">
              {timerLabel} · {miles.toFixed(2)} mi · {session.knocks.length} knocks
            </p>
          )}
        </div>
        {session ? (
          <button
            onClick={stop}
            className="flex items-center gap-1.5 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-medium"
          >
            <Square className="size-4" /> Stop
          </button>
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

      {/* Caveat banner */}
      {session && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-[11px] text-amber-900">
          Keep this tab open while walking. Browser GPS pauses if you lock your screen.
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

        {/* Log-a-knock FAB (only shown while tracking). Positioned above
            the rep layout's fixed bottom tab nav (h ~5rem) so it doesn't
            hide behind Home/Leads/GPS/Sales/Profile on mobile. */}
        {session && (
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
    </div>
  );
}
