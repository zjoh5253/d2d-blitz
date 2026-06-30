"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Trash2, Loader2, Bell, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Rep {
  id: string
  name: string | null
  email: string
  role: string
}

interface Assignment {
  id: string
  repId: string
  status: string
  housingAssignment: string | null
  travelCoordination: string | null
  arrivalConfirmed: boolean
  rep: Rep
}

interface StaffingTabProps {
  blitzId: string
  assignments: Assignment[]
  availableReps: Rep[]
  leadPrepStatus: string
}

export function StaffingTab({ blitzId, assignments: initialAssignments, availableReps, leadPrepStatus }: StaffingTabProps) {
  const router = useRouter()
  const [assignments, setAssignments] = React.useState(initialAssignments)
  const [assignOpen, setAssignOpen] = React.useState(false)
  const [selectedRepId, setSelectedRepId] = React.useState("")
  const [housingAssignment, setHousingAssignment] = React.useState("")
  const [travelCoordination, setTravelCoordination] = React.useState("")
  const [assigning, setAssigning] = React.useState(false)
  const [assignError, setAssignError] = React.useState<string | null>(null)

  const assignedRepIds = new Set(assignments.map((a) => a.repId))
  const unassignedReps = availableReps.filter((r) => !assignedRepIds.has(r.id))

  async function handleAssign() {
    if (!selectedRepId) return
    setAssigning(true)
    setAssignError(null)

    const res = await fetch(`/api/blitzes/${blitzId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repId: selectedRepId,
        housingAssignment: housingAssignment || undefined,
        travelCoordination: travelCoordination || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setAssignError(data.error ?? "Failed to assign rep")
      setAssigning(false)
      return
    }

    const newAssignment = await res.json()
    setAssignments((prev) => [...prev, newAssignment])
    setAssignOpen(false)
    setSelectedRepId("")
    setHousingAssignment("")
    setTravelCoordination("")
    setAssigning(false)
    router.refresh()
  }

  async function handleStatusChange(assignmentId: string, status: string) {
    const res = await fetch(
      `/api/blitzes/${blitzId}/assignments/${assignmentId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    )
    if (res.ok) {
      const updated = await res.json()
      setAssignments((prev) =>
        prev.map((a) => (a.id === assignmentId ? updated : a))
      )
    }
  }

  async function handleRemove(assignmentId: string) {
    const res = await fetch(
      `/api/blitzes/${blitzId}/assignments/${assignmentId}`,
      { method: "DELETE" }
    )
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      router.refresh()
    }
  }

  const filtering = leadPrepStatus === "FILTERING"

  return (
    <div className="space-y-4">
      {filtering && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-amber-600" />
          <div>
            <div className="font-medium">Staffing locked — this blitz is still filtering out current customers</div>
            <div className="text-amber-800">
              You&apos;ll be able to assign reps once the lead list finishes filtering. Progress shows on the Blitzes list.
            </div>
          </div>
        </div>
      )}

      <BlitzInvitePanel blitzId={blitzId} disabled={filtering} />

      <BlitzSignupRoster blitzId={blitzId} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} rep{assignments.length !== 1 ? "s" : ""} assigned
        </p>
        <Button size="sm" onClick={() => setAssignOpen(true)} disabled={filtering}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Assign Rep
        </Button>
      </div>

      <div className="rounded-md border border-input">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rep</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Housing</TableHead>
              <TableHead>Travel</TableHead>
              <TableHead className="w-28">Update Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-20 text-center text-muted-foreground"
                >
                  No reps assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{a.rep.name ?? a.rep.email}</p>
                      <p className="text-xs text-muted-foreground">{a.rep.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>
                    {a.arrivalConfirmed ? (
                      <span className="text-xs text-green-600 font-medium">Confirmed</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-36 truncate">
                    {a.housingAssignment ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm max-w-36 truncate">
                    {a.travelCoordination ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={a.status}
                      onChange={(e) => handleStatusChange(a.id, e.target.value)}
                      options={[
                        { value: "ASSIGNED", label: "Assigned" },
                        { value: "CONFIRMED", label: "Confirmed" },
                        { value: "IN_TRANSIT", label: "In Transit" },
                        { value: "ACTIVE", label: "Active" },
                        { value: "DEPARTED", label: "Departed" },
                        { value: "REMOVED", label: "Removed" },
                      ]}
                      className="text-xs h-7"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(a.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Assign Rep Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent onClose={() => setAssignOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Rep to Blitz</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {assignError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {assignError}
              </div>
            )}

            <div className="space-y-1">
              <Label>Field Rep</Label>
              <Select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                placeholder="Select rep"
                options={unassignedReps.map((r) => ({
                  value: r.id,
                  label: r.name ?? r.email,
                }))}
              />
              {unassignedReps.length === 0 && (
                <p className="text-xs text-muted-foreground">All available reps are assigned.</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Housing Assignment</Label>
              <Input
                value={housingAssignment}
                onChange={(e) => setHousingAssignment(e.target.value)}
                placeholder="Room number, address, etc."
              />
            </div>

            <div className="space-y-1">
              <Label>Travel Coordination</Label>
              <Textarea
                value={travelCoordination}
                onChange={(e) => setTravelCoordination(e.target.value)}
                placeholder="Flight info, arrival time, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedRepId || assigning}
            >
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Targeted invites ────────────────────────────────────────────────────────
// Manager fires qualification-filtered invites (push + SMS) and watches the
// sent→viewed→accepted funnel. Firing is explicit — never automatic — so test
// blitzes never invite anyone.

interface InviteFunnel {
  total: number
  pending: number
  viewed: number
  accepted: number
  declined: number
  expired: number
  committed: number
}

function BlitzInvitePanel({ blitzId, disabled }: { blitzId: string; disabled: boolean }) {
  const [funnel, setFunnel] = React.useState<InviteFunnel | null>(null)
  const [sending, setSending] = React.useState(false)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/blitzes/${blitzId}/invite`)
    if (res.ok) setFunnel(await res.json())
  }, [blitzId])
  React.useEffect(() => { load() }, [load])

  async function send() {
    if (!window.confirm("Send invites to all qualified reps who haven't been invited yet?")) return
    setSending(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "both" }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        window.alert(
          d.invited > 0
            ? `Invited ${d.invited} rep${d.invited === 1 ? "" : "s"} (${d.pushSent} push sent${d.alreadyInvited ? `, ${d.alreadyInvited} already invited` : ""}).`
            : `No new reps to invite${d.alreadyInvited ? ` — ${d.alreadyInvited} already invited.` : "."}`
        )
        await load()
      } else {
        window.alert(d.error ?? "Couldn't send invites.")
      }
    } finally { setSending(false) }
  }

  const stat = (label: string, value: number, cls = "text-foreground") => (
    <div className="text-center">
      <div className={`text-base font-semibold ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">
          Targeted invites
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {funnel ? `${funnel.total} sent` : "—"}
          </span>
        </div>
        <Button size="sm" disabled={disabled || sending} onClick={send}>
          {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          {funnel && funnel.total > 0 ? "Invite more" : "Send invites"}
        </Button>
      </div>
      {funnel && funnel.total > 0 && (
        <div className="grid grid-cols-6 gap-1 rounded-md border bg-card px-2 py-2">
          {stat("Pending", funnel.pending)}
          {stat("Viewed", funnel.viewed, "text-blue-600")}
          {stat("Accepted", funnel.accepted, "text-green-600")}
          {stat("Declined", funnel.declined, "text-muted-foreground")}
          {stat("Expired", funnel.expired, "text-muted-foreground")}
          {stat("Committed", funnel.committed, "text-green-700")}
        </div>
      )}
    </div>
  )
}

// ── Job-board signups ───────────────────────────────────────────────────────
// Reps who self-claimed this blitz from the rep app. CLAIMED reps need
// territory (assign it on the Leads map → they flip to Active automatically);
// WAITLISTED reps are queued. Decline frees the spot + promotes the waitlist.

interface Signup {
  id: string
  repId: string
  status: "CLAIMED" | "ACTIVE" | "WAITLISTED"
  waitPosition: number | null
  rep: { id: string; name: string | null; email: string }
}

interface BoardData {
  openForSignup: boolean
  boardNotifiedAt: string | null
  signups: Signup[]
}

function BlitzSignupRoster({ blitzId }: { blitzId: string }) {
  const router = useRouter()
  const [data, setData] = React.useState<BoardData | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [notifying, setNotifying] = React.useState(false)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/blitzes/${blitzId}/signups`)
    if (res.ok) setData(await res.json())
  }, [blitzId])
  React.useEffect(() => { load() }, [load])

  async function decline(repId: string) {
    if (!window.confirm("Remove this rep from the blitz?")) return
    setBusy(repId)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/signups/${repId}/decline`, { method: "POST" })
      if (res.ok) { await load(); router.refresh() }
    } finally { setBusy(null) }
  }

  async function notify() {
    const already = !!data?.boardNotifiedAt
    if (!window.confirm(
      already
        ? "Reps were already notified for this blitz. Send another push to all reps?"
        : "Send a push notification to every rep who's enabled notifications?"
    )) return
    setNotifying(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/notify-signup`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        window.alert(`Sent to ${d.reps} rep${d.reps === 1 ? "" : "s"} (${d.sent} notification${d.sent === 1 ? "" : "s"}${d.stale ? `, ${d.stale} stale removed` : ""}).`)
        await load()
      } else {
        window.alert(d.error ?? "Couldn't send notifications.")
      }
    } finally { setNotifying(false) }
  }

  // Only blitzes that are actually on the rep board show this panel.
  if (!data || !data.openForSignup) return null

  const signups = data.signups
  const needsTerritory = signups.filter((s) => s.status === "CLAIMED")
  const active = signups.filter((s) => s.status === "ACTIVE")
  const waitlist = signups.filter((s) => s.status === "WAITLISTED").sort((a, b) => (a.waitPosition ?? 0) - (b.waitPosition ?? 0))

  const Row = ({ s, badge }: { s: Signup; badge: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{s.rep.name ?? s.rep.email}</div>
        <div className="text-xs text-muted-foreground truncate">{s.rep.email}</div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        <Button variant="ghost" size="sm" disabled={busy === s.repId} onClick={() => decline(s.repId)}>
          {busy === s.repId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium">
          Job-board signups
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {needsTerritory.length} awaiting territory · {active.length} active · {waitlist.length} waitlisted
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data.boardNotifiedAt && (
            <span className="text-xs text-muted-foreground">
              Notified {new Date(data.boardNotifiedAt).toLocaleDateString()}
            </span>
          )}
          <Button size="sm" variant={data.boardNotifiedAt ? "outline" : "default"} disabled={notifying} onClick={notify}>
            {notifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bell className="mr-1.5 h-3.5 w-3.5" />}
            {data.boardNotifiedAt ? "Notify again" : "Notify reps"}
          </Button>
        </div>
      </div>

      {signups.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No reps have claimed this blitz yet. They can find it on the board now; tap “Notify reps” to push an announcement.
        </div>
      )}

      {needsTerritory.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-amber-700">Needs territory — assign leads on the Leads map to activate</div>
          {needsTerritory.map((s) => (
            <Row key={s.id} s={s} badge={<span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Reserved</span>} />
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Active</div>
          {active.map((s) => (
            <Row key={s.id} s={s} badge={<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>} />
          ))}
        </div>
      )}

      {waitlist.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Waitlist</div>
          {waitlist.map((s) => (
            <Row key={s.id} s={s} badge={<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">#{s.waitPosition}</span>} />
          ))}
        </div>
      )}
    </div>
  )
}
