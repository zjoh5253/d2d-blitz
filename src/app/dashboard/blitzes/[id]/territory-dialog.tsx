"use client"

import * as React from "react"
import { Loader2, Wand2, Hand, Eraser, RotateCcw } from "lucide-react"
import { CLUSTER_HEX } from "@/app/dashboard/door-knocks/cluster-map"
import { HexMap, type HexLead } from "./hex-map"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// In-Staffing territory tool: an H3 hex-grid map. Auto-plan splits the town into
// equal contiguous shares per rep; then pick a rep "brush" and drag across hexes
// to customize — all without leaving the Staffing tab.

interface Rep { repId: string; name: string }

export function TerritoryDialog({
  blitzId, reps, open, onClose, onChanged,
}: {
  blitzId: string
  reps: Rep[]
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [leads, setLeads] = React.useState<HexLead[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  // brush: undefined = pan/move · null = erase (unassign) · string = paint that rep
  const [brush, setBrush] = React.useState<string | null | undefined>(undefined)

  const load = React.useCallback(async () => {
    setLeads(null)
    const res = await fetch(`/api/blitzes/${blitzId}/territory?leads=1`)
    if (res.ok) setLeads((await res.json()).leads)
  }, [blitzId])
  React.useEffect(() => { if (open) { setBrush(undefined); load() } }, [open, load])

  // Paint: assign the given leads to a rep (or unassign when repId is null).
  const paint = React.useCallback(async (leadIds: string[], repId: string | null) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/territory`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repId ? { repId, leadIds } : { leadIds }),
      })
      if (res.ok) {
        setLeads((prev) => prev ? prev.map((l) => (leadIds.includes(l.id) ? { ...l, assignedRepId: repId } : l)) : prev)
        onChanged()
      } else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't assign.")
    } finally { setBusy(false) }
  }, [blitzId, onChanged])

  async function autoPlan() {
    if (reps.length === 0) return
    if (!window.confirm(`Auto-split the unassigned leads into equal shares across ${reps.length} rep${reps.length === 1 ? "" : "s"} and activate them?`)) return
    setBusy(true)
    try {
      const planRes = await fetch("/api/door-knock-leads/cluster-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blitzId, numReps: reps.length }),
      })
      const plan = await planRes.json().catch(() => ({}))
      if (!planRes.ok) { window.alert(plan.error ?? "Couldn't compute a plan."); return }
      const clusters: { leadIds?: string[] }[] = plan.clusters ?? []
      if (!clusters.some((c) => c.leadIds?.length)) { window.alert(plan.warning ?? "No unassigned leads to plan."); return }
      for (let i = 0; i < clusters.length && i < reps.length; i++) {
        const ids = clusters[i].leadIds ?? []
        if (ids.length) {
          await fetch(`/api/blitzes/${blitzId}/territory`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repId: reps[i].repId, leadIds: ids }),
          })
        }
      }
      await load()
      onChanged()
    } finally { setBusy(false) }
  }

  async function reset() {
    if (!window.confirm("Reset all territory? This unassigns every lead and sends any activated reps back to “reserved,” clearing check-ins that already started. Claims and the waitlist are kept.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/territory/reset`, { method: "POST" })
      if (res.ok) { setBrush(undefined); await load(); onChanged() }
      else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't reset.")
    } finally { setBusy(false) }
  }

  const unassigned = (leads ?? []).filter((l) => l.assignedRepId == null).length
  const anyAssigned = (leads ?? []).some((l) => l.assignedRepId != null)

  const brushBtn = (label: string, value: string | null | undefined, color?: string, icon?: React.ReactNode) => (
    <button
      onClick={() => setBrush(value)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${brush === value ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
    >
      {color && <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />}
      {icon}
      {label}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClose={onClose} className="max-w-4xl">
        <DialogHeader><DialogTitle>Assign territory</DialogTitle></DialogHeader>
        {leads === null ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">No mappable leads for this blitz yet. Pull addresses on the blitz first.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{unassigned} unassigned · {leads.length} total{busy ? " · working…" : ""}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy || !anyAssigned} onClick={reset}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset
                </Button>
                <Button size="sm" variant="outline" disabled={busy || reps.length === 0 || unassigned === 0} onClick={autoPlan}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />Auto-plan across {reps.length} rep{reps.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>

            {/* Brush picker: pick a rep, then drag across hexes to paint */}
            <div className="flex flex-wrap items-center gap-1.5">
              {brushBtn("Move", undefined, undefined, <Hand className="size-3" />)}
              {reps.map((r, i) => brushBtn(r.name, r.repId, CLUSTER_HEX[i % CLUSTER_HEX.length]))}
              {brushBtn("Erase", null, undefined, <Eraser className="size-3" />)}
            </div>

            <div className="h-[52vh] overflow-hidden rounded-md border">
              <HexMap leads={leads} reps={reps} brush={brush} onPaint={paint} />
            </div>
            <p className="text-xs text-muted-foreground">
              {brush === undefined ? "Pick a rep above to start painting, or drag to pan the map." : brush === null ? "Drag across hexes to unassign them." : "Drag across hexes to give them to this rep — that activates them and starts their check-ins."}
              {" "}Auto-plan splits it evenly first; then tweak by hand.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
