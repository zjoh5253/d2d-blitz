// Client helpers for PWA push reminders. iOS only exposes PushManager inside an
// installed PWA (Add to Home Screen, iOS 16.4+); in a plain tab these degrade
// to "unsupported".

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(normalized)
  // Back it with a concrete ArrayBuffer so it satisfies BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export type EnableResult = { ok: boolean; reason?: "unsupported" | "not-configured" | "denied" | "failed" }

export async function enablePushReminders(): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) return { ok: false, reason: "not-configured" }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: "denied" }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    })
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  })
  return res.ok ? { ok: true } : { ok: false, reason: "failed" }
}

export async function disablePushReminders(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  if (!reg) return false
  return !!(await reg.pushManager.getSubscription())
}
