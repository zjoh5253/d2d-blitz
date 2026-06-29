"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { pushSupported, isSubscribed, enablePushReminders } from "@/lib/push-client";

// Board-top nudge to enable push so reps actually receive the "new blitz"
// announcements. Reuses the same one-tap subscription that powers go-back
// reminders (one opt-in covers both). Auto-hides once subscribed; dismissible.

type State = "loading" | "on" | "off" | "denied" | "unsupported";
const DISMISS_KEY = "board-notify-dismissed-v1";

export function BoardNotifyBanner() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    (async () => {
      if (!pushSupported()) { setState("unsupported"); return; }
      if (Notification.permission === "denied") { setState("denied"); return; }
      setState((await isSubscribed()) ? "on" : "off");
    })();
  }, []);

  // Already subscribed (or still checking) → nothing to nudge.
  if (state === "loading" || state === "on" || dismissed) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); };

  const enable = async () => {
    setBusy(true);
    try {
      const r = await enablePushReminders();
      if (r.ok) setState("on");
      else if (r.reason === "denied") setState("denied");
    } finally { setBusy(false); }
  };

  return (
    <div className="relative rounded-lg border border-blue-200 bg-blue-50 p-3 pr-8 text-sm">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 text-blue-400 hover:text-blue-600">
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 size-4 shrink-0 text-blue-600" />
        <div className="min-w-0">
          {state === "off" && (
            <>
              <div className="font-medium text-blue-900">Get first dibs on new blitzes</div>
              <div className="mt-0.5 text-xs text-blue-700">Turn on notifications — we&apos;ll ping you the moment a new blitz opens so you can claim a spot before it fills.</div>
              <button
                onClick={enable}
                disabled={busy}
                className="mt-2 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                {busy ? "Turning on…" : "Turn on notifications"}
              </button>
            </>
          )}
          {state === "denied" && (
            <>
              <div className="font-medium text-blue-900">Notifications are blocked</div>
              <div className="mt-0.5 text-xs text-blue-700">You&apos;ll miss new-blitz alerts. Re-enable notifications for this site in your browser settings.</div>
            </>
          )}
          {state === "unsupported" && (
            <>
              <div className="font-medium text-blue-900">Add this app to your home screen</div>
              <div className="mt-0.5 text-xs text-blue-700">On iPhone, install the app (Share → Add to Home Screen) to get notified when new blitzes open.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
