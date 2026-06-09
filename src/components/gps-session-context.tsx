"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { GpsKnock, GpsRoutePoint, KnockResult } from "@/app/rep/gps/rep-gps-map";

// One GPS tracking session shared across the whole rep app (provider lives in
// the rep layout). This lets the Leads map show live location + session
// controls AND the GPS tab drive the same session — no duplicate watchers, no
// conflicting localStorage. Foreground browser GPS: the watch pauses when the
// tab backgrounds and resumes on foreground.

const STORAGE_KEY = "rep-gps-session-v1";

interface PauseInterval { pausedAt: number; resumedAt: number | null }
interface SessionState {
  startedAt: number;
  route: GpsRoutePoint[];
  knocks: GpsKnock[];
  pauses?: PauseInterval[];
}
type PermissionState = "prompt" | "granted" | "denied" | "unsupported";

function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
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
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function isCurrentlyPaused(s: SessionState | null): boolean {
  if (!s?.pauses?.length) return false;
  return s.pauses[s.pauses.length - 1].resumedAt === null;
}
function pausedMsTotal(s: SessionState, asOf: number): number {
  return (s.pauses ?? []).reduce((sum, p) => sum + ((p.resumedAt ?? asOf) - p.pausedAt), 0);
}
function activeSeconds(s: SessionState, asOf: number): number {
  return Math.max(0, Math.floor((asOf - s.startedAt - pausedMsTotal(s, asOf)) / 1000));
}
function routeMiles(route: GpsRoutePoint[]): number {
  return route.reduce((sum, p, i) => (i === 0 ? 0 : sum + haversineMiles(route[i - 1], p)), 0);
}

export interface GpsSessionValue {
  active: boolean;
  paused: boolean;
  current: { lat: number; lng: number } | null;
  seconds: number;
  miles: number;
  knockCount: number;
  permissionState: PermissionState;
  route: GpsRoutePoint[];
  knocks: GpsKnock[];
  start: () => void;
  togglePause: () => void;
  finish: () => Promise<boolean>;
  /** Record a knock at an explicit location (a lead pin) or the current fix. */
  logKnock: (result: KnockResult, at?: { lat: number; lng: number }) => void;
}

const Ctx = createContext<GpsSessionValue | null>(null);

export function useGpsSession(): GpsSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGpsSession must be used within <GpsSessionProvider>");
  return v;
}

export function GpsSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(() => loadSession());
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [permissionState, setPermissionState] = useState<PermissionState>("prompt");
  const watchIdRef = useRef<number | null>(null);

  const paused = isCurrentlyPaused(session);
  const active = !!session;

  // Timer tick — paused when no active session or the session is paused.
  useEffect(() => {
    if (!session || paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session, paused]);

  // Geolocation: watch while tracking, single-shot otherwise (for the dot).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermissionState("unsupported");
      return;
    }
    if (!session || paused) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
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
      (err) => { if (err.code === err.PERMISSION_DENIED) setPermissionState("denied"); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [active, paused]);

  const start = useCallback(() => {
    const fresh: SessionState = { startedAt: Date.now(), route: [], knocks: [], pauses: [] };
    setSession(fresh);
    saveSession(fresh);
  }, []);

  const togglePause = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const pauses = [...(prev.pauses ?? [])];
      const last = pauses[pauses.length - 1];
      if (last && last.resumedAt === null) pauses[pauses.length - 1] = { ...last, resumedAt: Date.now() };
      else pauses.push({ pausedAt: Date.now(), resumedAt: null });
      const next = { ...prev, pauses };
      saveSession(next);
      return next;
    });
  }, []);

  const finish = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    if (typeof window !== "undefined" && !window.confirm("End this tracking session and save the record?")) return false;
    const endedAt = Date.now();
    const closed = (session.pauses ?? []).map((p) => ({ pausedAt: p.pausedAt, resumedAt: p.resumedAt ?? endedAt }));
    const pausedMs = closed.reduce((sum, p) => sum + (p.resumedAt - p.pausedAt), 0);
    const durationSeconds = Math.max(0, Math.floor((endedAt - session.startedAt - pausedMs) / 1000));
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
          routeMiles: routeMiles(session.route),
        }),
      });
      saved = res.ok;
    } catch { saved = false; }
    if (!saved) {
      if (typeof window !== "undefined") window.alert("Couldn't save the session — your data is still here, try Finish again in a moment.");
      return false;
    }
    setSession(null);
    saveSession(null);
    return true;
  }, [session]);

  const logKnock = useCallback((result: KnockResult, at?: { lat: number; lng: number }) => {
    const loc = at ?? current;
    if (!loc) return;
    setSession((prev) => {
      if (!prev) return prev;
      const k: GpsKnock = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lat: loc.lat, lng: loc.lng, result, timestamp: Date.now(),
      };
      const next = { ...prev, knocks: [...prev.knocks, k] };
      saveSession(next);
      return next;
    });
  }, [current]);

  const value: GpsSessionValue = {
    active,
    paused,
    current,
    seconds: session ? activeSeconds(session, now) : 0,
    miles: session ? routeMiles(session.route) : 0,
    knockCount: session?.knocks.length ?? 0,
    permissionState,
    route: session?.route ?? [],
    knocks: session?.knocks ?? [],
    start,
    togglePause,
    finish,
    logKnock,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
