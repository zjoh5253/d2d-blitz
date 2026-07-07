"use client"

import * as React from "react"
import { QRCodeSVG } from "qrcode.react"
import { Share2, Copy, Check, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Manager-facing "Share card" action: surfaces the blitz's public /b/{token}
// link with copy-to-clipboard + a QR code so reps can actually reach the card
// (spec §7). If the blitz has no token yet, one click enables + mints it.

export function ShareCardButton({
  blitzId, initialToken, initialEnabled,
}: {
  blitzId: string
  initialToken: string | null
  initialEnabled: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [token, setToken] = React.useState<string | null>(initialEnabled ? initialToken : null)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Absolute link — origin resolves correctly on localhost and prod.
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/b/${token}` : ""

  async function enable() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/public-card`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.token) setToken(d.token)
      else setError(d.error ?? "Couldn't enable the card.")
    } finally { setBusy(false) }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { setError("Couldn't copy — select the link and copy manually.") }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="mr-1.5 h-4 w-4" />
        Share card
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} className="max-w-sm">
          <DialogHeader><DialogTitle>Share this blitz</DialogTitle></DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view the blitz and claim a spot — no login needed. New reps can sign up straight from it.
            </p>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            {!token ? (
              <Button className="w-full" disabled={busy} onClick={enable}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Share2 className="mr-1.5 h-4 w-4" />}
                Enable public card
              </Button>
            ) : (
              <>
                <div className="flex justify-center rounded-lg border bg-white p-4">
                  <QRCodeSVG value={url} size={168} marginSize={2} />
                </div>

                <div className="flex items-center gap-2">
                  <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
                  <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />Open card in new tab
                </a>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
