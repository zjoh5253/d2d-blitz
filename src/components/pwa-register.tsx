"use client";

import { useEffect } from "react";

// Registers the service worker app-wide so the PWA is installable and can
// receive push notifications. Safe no-op where service workers aren't
// supported (older browsers, non-secure contexts).
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration failures are non-fatal */
    });
  }, []);
  return null;
}
