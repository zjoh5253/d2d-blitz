"use client";

import { useEffect, useState } from "react";
import { Share, X, Bell, Smartphone } from "lucide-react";

// In-app "Add to Home Screen" prompt for reps. Shows only when the app isn't
// already installed and the rep hasn't recently dismissed it. iOS Safari has no
// install API → show manual steps; Android/Chrome fire `beforeinstallprompt` →
// offer a real one-tap install.

const DISMISS_KEY = "pwa-install-dismissed-at";
const SNOOZE_DAYS = 21;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 86400_000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const ua = navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua);
    // Avoid showing inside in-app webviews where install isn't possible.
    setIsIOS(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    // Show shortly after load so it doesn't fight the first paint.
    const t = setTimeout(() => setShow(true), 1200);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[5.5rem] z-40 rounded-xl border bg-white shadow-lg">
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Add D2D Blitz to your home screen</div>
          <p className="mt-0.5 text-xs text-gray-500">
            Opens full-screen like a normal app — and it&apos;s required to get
            <span className="inline-flex items-center gap-0.5 font-medium text-gray-700"> <Bell className="size-3" /> follow-up reminders</span> on your phone.
          </p>

          {isIOS ? (
            <p className="mt-2 text-xs text-gray-700">
              Tap the <Share className="inline size-3.5 align-text-bottom" /> <strong>Share</strong> button below, then choose <strong>Add to Home Screen</strong>.
            </p>
          ) : deferred ? (
            <button onClick={install} className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
              Install app
            </button>
          ) : (
            <p className="mt-2 text-xs text-gray-700">
              Open your browser menu (⋮) and tap <strong>Install app</strong> / <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-gray-400">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
