"use client";

import { Play, Pause, Square } from "lucide-react";
import { useGpsSession } from "@/components/gps-session-context";

// Slim top status bar for the unified Leads-map screen: shows the live GPS
// session (timer / knocks / miles) and its controls, driven by the shared
// session context. When idle it's a one-tap "Start tracking" strip.

function hms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function GpsStatusBar() {
  const gps = useGpsSession();

  if (!gps.active) {
    const blocked = gps.permissionState === "denied" || gps.permissionState === "unsupported";
    return (
      <button
        onClick={gps.start}
        disabled={blocked}
        className="flex w-full items-center justify-center gap-1.5 bg-emerald-600 disabled:bg-gray-300 text-white text-sm font-medium py-2"
      >
        <Play className="size-4" /> {blocked ? "Location unavailable" : "Start tracking"}
      </button>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-white ${gps.paused ? "bg-blue-600" : "bg-emerald-600"}`}>
      <div className="flex items-center gap-2 text-sm font-medium min-w-0">
        <span className={`size-2 rounded-full bg-white ${gps.paused ? "opacity-60" : "animate-pulse"}`} />
        <span className="tabular-nums">{hms(gps.seconds)}</span>
        <span className="opacity-80 truncate">· {gps.knockCount} knocks · {gps.miles.toFixed(1)} mi{gps.paused ? " · Paused" : ""}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={gps.togglePause} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
          {gps.paused ? <><Play className="size-3.5" />Resume</> : <><Pause className="size-3.5" />Pause</>}
        </button>
        <button onClick={() => { void gps.finish(); }} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
          <Square className="size-3.5" />Finish
        </button>
      </div>
    </div>
  );
}
