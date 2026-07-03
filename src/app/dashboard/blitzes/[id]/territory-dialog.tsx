"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { ClusterMap, type ClusterMapPoint, CLUSTER_HEX } from "@/app/dashboard/door-knocks/cluster-map"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// In-Staffing territory map (#1, layer 1): reuses the Door-Knocks cluster map so
// a manager carves territory (box-select / click → assign to a rep, which
// activates them) without leaving the Staffing tab. Reps map to cluster indices
// 0..N-1; an extra last cluster is "Unassigned".

interface Rep { repId: string; name: string }
interface Lead { id: string; lat: number; lng: number; street: string; assignedRepId: string | null }

export function TerritoryDialog({
  blitzId, reps, open, onClose, onChanged,
}: {
  blitzId: string
  reps: Rep[]
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [leads, setLeads] = React.useState<Lead[] | null>(null)
  const [busy, setBusy] = React.useState(false)

  const repIdx = React.useMemo(() => new Map(reps.map((r, i) => [r.repId, i])), [reps])
  const unassignedIdx = reps.length // last cluster
  const labels = React.useMemo(() => [...reps.map((r) => r.name), "Unassigned"], [reps])

  const load = React.useCallback(async () => {
    setLeads(null)
    const res = await fetch(`/api/blitzes/${blitzId}/territory?leads=1`)
    if (res.ok) setLeads((await res.json()).leads)
  }, [blitzId])
  React.useEffect(() => { if (open) load() }, [open, load])

  const points: ClusterMapPoint[] = React.useMemo(
    () => (leads ?? []).map((l) => ({
      id: l.id, lat: l.lat, lng: l.lng, street: l.street,
      clusterIdx: l.assignedRepId != null && repIdx.has(l.assignedRepId) ? repIdx.get(l.assignedRepId)! : unassignedIdx,
    })),
    [leads, repIdx, unassignedIdx]
  )

  async function reassign(leadIds: string[], idx: number) {
    const repId = idx < reps.length ? reps[idx].repId : undefined // last idx = unassign
    setBusy(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/territory`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repId ? { repId, leadIds } : { leadIds }),
      })
      if (res.ok) {
        setLeads((prev) => prev ? prev.map((l) => (leadIds.includes(l.id) ? { ...l, assignedRepId: repId ?? null } : l)) : prev)
        onChanged()
      } else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't assign.")
    } finally { setBusy(false) }
  }

  const unassigned = (leads ?? []).filter((l) => l.assignedRepId == null).length

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
            <div className="h-[58vh] overflow-hidden rounded-md border">
              <ClusterMap points={points} numClusters={reps.length + 1} clusterLabels={labels} onReassign={reassign} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">{unassigned} unassigned · {leads.length} total{busy ? " · saving…" : ""}</span>
              {labels.map((lab, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: CLUSTER_HEX[i % CLUSTER_HEX.length] }} />{lab}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Shift+drag to box-select houses, or click a pin — then pick a rep. Assigning activates that rep and starts their check-ins. For fine control, the Door-Knocks map has the full planner.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
