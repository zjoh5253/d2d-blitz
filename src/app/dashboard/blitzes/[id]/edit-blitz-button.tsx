"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// Edit a blitz's core details (name, dates, seat cap, housing) via the existing
// PUT /api/blitzes/[id]. Lives in the blitz header so a manager can fix dates
// after creation without leaving the page.

// Format a stored date for a <input type="date"> (YYYY-MM-DD, UTC day).
const toDateInput = (d: string | Date): string => new Date(d).toISOString().slice(0, 10)

export function EditBlitzButton({
  blitzId, name, startDate, endDate, repCap, housingPlan,
}: {
  blitzId: string
  name: string
  startDate: string | Date
  endDate: string | Date
  repCap: number
  housingPlan: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({
    name,
    startDate: toDateInput(startDate),
    endDate: toDateInput(endDate),
    repCap: String(repCap),
    housingPlan: housingPlan ?? "",
  })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Reset the form to current values whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setError(null)
      setForm({ name, startDate: toDateInput(startDate), endDate: toDateInput(endDate), repCap: String(repCap), housingPlan: housingPlan ?? "" })
    }
  }, [open, name, startDate, endDate, repCap, housingPlan])

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return }
    if (new Date(form.endDate) < new Date(form.startDate)) { setError("End date can't be before the start date."); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          repCap: Number(form.repCap),
          housingPlan: form.housingPlan.trim(),
        }),
      })
      if (res.ok) { setOpen(false); router.refresh() }
      else setError((await res.json().catch(() => ({}))).error ?? "Couldn't save changes.")
    } finally { setSaving(false) }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} className="max-w-md">
          <DialogHeader><DialogTitle>Edit blitz details</DialogTitle></DialogHeader>

          <div className="space-y-4 px-6 py-2">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Rep seats</Label>
              <Input type="number" min={1} value={form.repCap} onChange={(e) => set("repCap", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Housing plan</Label>
              <Input value={form.housingPlan} onChange={(e) => set("housingPlan", e.target.value)} placeholder="Hotel, address, notes…" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
