import webpush from "web-push"

// Lazily configures web-push from VAPID env. Returns null when keys aren't set
// (so callers can degrade gracefully — e.g. before VAPID is added in Vercel).
let configured = false
export function getWebPush(): typeof webpush | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@d2dblitz.com", publicKey, privateKey)
    configured = true
  }
  return webpush
}
