"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { pushSupported, isSubscribed, enablePushReminders, disablePushReminders } from "@/lib/push-client";

type State = "loading" | "on" | "off" | "unsupported" | "denied";

// A toggle reps tap to receive follow-up push reminders. Hidden where push
// isn't available (e.g. iOS Safari before the PWA is installed).
export function EnableRemindersButton() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) { setState("unsupported"); return; }
      if (Notification.permission === "denied") { setState("denied"); return; }
      setState((await isSubscribed()) ? "on" : "off");
    })();
  }, []);

  if (state === "loading" || state === "unsupported") return null;
  if (state === "denied") {
    return <span className="text-xs text-gray-400">Reminders blocked in settings</span>;
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePushReminders();
        setState("off");
      } else {
        const r = await enablePushReminders();
        setState(r.ok ? "on" : r.reason === "denied" ? "denied" : "off");
      }
    } finally {
      setBusy(false);
    }
  };

  const on = state === "on";
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"} disabled:opacity-50`}
    >
      {on ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      {on ? "Reminders on" : "Enable reminders"}
    </button>
  );
}
