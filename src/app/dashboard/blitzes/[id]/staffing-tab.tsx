"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Trash2, Loader2, Bell, Send, RotateCcw, Check, X, MapPinned, Rocket } from "lucide-react"
import { TerritoryDialog } from "./territory-dialog"
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

      <BlitzApprovalsPanel blitzId={blitzId} />

      <BlitzGatesPanel blitzId={blitzId} />

      <BlitzBackfillPanel blitzId={blitzId} />

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

// ── Check-in gate status ────────────────────────────────────────────────────
// Per-rep gate progress across the blitz's slots (spec §5.2 at-risk roster).
// At-risk reps (a missed/escalated gate) float to the top and are flagged.

interface GateMatrix {
  order: { id: string; label: string }[]
  reps: { repId: string; repName: string; gates: Record<string, string>; atRisk: boolean }[]
}

const GATE_DOT: Record<string, string> = {
  COMPLETED: "bg-green-500",
  PENDING: "bg-gray-200",
  SENT: "bg-blue-400",
  MISSED: "bg-rose-500",
  ESCALATED: "bg-amber-500",
}

function BlitzGatesPanel({ blitzId }: { blitzId: string }) {
  const [data, setData] = React.useState<GateMatrix | null>(null)

  React.useEffect(() => {
    fetch(`/api/blitzes/${blitzId}/gates`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d))
  }, [blitzId])

  // Nothing to show until reps are activated (gates are created on activation).
  if (!data || data.reps.length === 0) return null

  const atRisk = data.reps.filter((r) => r.atRisk).length

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">
          Check-in gates
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {data.reps.length} active{atRisk > 0 ? ` · ${atRisk} at-risk` : ""}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
          {data.order.map((g) => <span key={g.id} title={g.label} className="w-5 text-center font-medium">{g.id}</span>)}
        </div>
      </div>

      <div className="space-y-1.5">
        {data.reps.map((r) => (
          <div key={r.repId} className={`flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm ${r.atRisk ? "border-rose-300" : ""}`}>
            <div className="min-w-0 truncate font-medium">
              {r.repName}
              {r.atRisk && <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">At risk</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {data.order.map((g) => {
                const st = r.gates[g.id]
                return (
                  <span
                    key={g.id}
                    title={`${g.label}: ${st ?? "—"}`}
                    className={`h-2.5 w-2.5 rounded-full ${st ? GATE_DOT[st] ?? "bg-gray-300" : "bg-gray-100 ring-1 ring-inset ring-gray-200"}`}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pending approvals (in-Staffing, #2) ─────────────────────────────────────
// New-rep applications + no-penalty requests for THIS blitz, approved inline so
// the manager never leaves the tab. (The standalone Approvals page still shows
// the cross-blitz view.)

interface BlitzApprovals {
  onboarding: { id: string; name: string | null; email: string; onboardingData: { experienceMonths?: number; homeMarket?: string } | null }[]
  waivers: { id: string; reason: string; rep: { name: string | null; email: string } }[]
}

function BlitzApprovalsPanel({ blitzId }: { blitzId: string }) {
  const router = useRouter()
  const [data, setData] = React.useState<BlitzApprovals | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/blitzes/${blitzId}/approvals`)
    if (res.ok) setData(await res.json())
  }, [blitzId])
  React.useEffect(() => { load() }, [load])

  async function decideOnboarding(id: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm("Reject this applicant and release their held spot?")) return
    setBusy(id)
    try {
      const res = await fetch(`/api/onboarding/${id}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      if (res.ok) { await load(); router.refresh() } else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't update.")
    } finally { setBusy(null) }
  }
  async function decideWaiver(id: string, action: "approve" | "deny") {
    setBusy(id)
    try {
      const res = await fetch(`/api/penalty-waivers/${id}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
      if (res.ok) await load(); else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't update.")
    } finally { setBusy(null) }
  }

  if (!data || (data.onboarding.length === 0 && data.waivers.length === 0)) return null

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 space-y-3">
      <div className="text-sm font-medium">
        Pending approvals
        <span className="ml-2 text-xs font-normal text-muted-foreground">{data.onboarding.length + data.waivers.length} awaiting you</span>
      </div>

      {data.onboarding.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="font-medium truncate">{o.name ?? o.email} <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">New rep</span></div>
            <div className="text-xs text-muted-foreground truncate">{o.onboardingData?.experienceMonths ?? "—"} mo experience · {o.onboardingData?.homeMarket ?? o.email}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={busy === o.id} onClick={() => decideOnboarding(o.id, "approve")}>
              {busy === o.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => decideOnboarding(o.id, "reject")}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}

      {data.waivers.map((w) => (
        <div key={w.id} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="font-medium truncate">{w.rep.name ?? w.rep.email} <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">No-penalty request</span></div>
            <div className="text-xs text-muted-foreground truncate">“{w.reason}”</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={busy === w.id} onClick={() => decideWaiver(w.id, "approve")}>
              {busy === w.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Waive
            </Button>
            <Button size="sm" variant="outline" disabled={busy === w.id} onClick={() => decideWaiver(w.id, "deny")}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Backfill queue ──────────────────────────────────────────────────────────
// Warm prospects to pull in when a spot frees up (spec §5.2): reps invited but
// who didn't claim (declined / expired / still pending), plus the standby
// waitlist. Re-invite resets a prospect's invite + re-pings them.

interface BackfillPerson { repId: string; name: string; email: string; waitPosition?: number | null }
interface BackfillData {
  declined: BackfillPerson[]
  expired: BackfillPerson[]
  pending: BackfillPerson[]
  waitlist: BackfillPerson[]
}

function BlitzBackfillPanel({ blitzId }: { blitzId: string }) {
  const [data, setData] = React.useState<BackfillData | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/blitzes/${blitzId}/backfill`)
    if (res.ok) setData(await res.json())
  }, [blitzId])
  React.useEffect(() => { load() }, [load])

  async function reinvite(repId: string) {
    setBusy(repId)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) window.alert(d.error ?? "Couldn't re-invite.")
      await load()
    } finally { setBusy(null) }
  }

  if (!data) return null
  const total = data.declined.length + data.expired.length + data.pending.length + data.waitlist.length
  if (total === 0) return null

  const Group = ({ label, people, reinvitable }: { label: string; people: BackfillPerson[]; reinvitable?: boolean }) =>
    people.length === 0 ? null : (
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {people.map((p) => (
          <div key={p.repId} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{p.name}{p.waitPosition != null ? ` · #${p.waitPosition}` : ""}</div>
              <div className="text-xs text-muted-foreground truncate">{p.email}</div>
            </div>
            {reinvitable && (
              <Button size="sm" variant="outline" disabled={busy === p.repId} onClick={() => reinvite(p.repId)}>
                {busy === p.repId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                Re-invite
              </Button>
            )}
          </div>
        ))}
      </div>
    )

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="text-sm font-medium">
        Backfill queue
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {data.waitlist.length} standby · {data.declined.length + data.expired.length} warm
        </span>
      </div>
      <Group label="Standby (waitlist)" people={data.waitlist} />
      <Group label="Awaiting response" people={data.pending} />
      <Group label="Declined" people={data.declined} reinvitable />
      <Group label="Invite expired" people={data.expired} reinvitable />
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
  needsApproval: boolean
  rep: { id: string; name: string | null; email: string }
}

interface BoardData {
  openForSignup: boolean
  boardNotifiedAt: string | null
  staffingPublishedAt: string | null
  signups: Signup[]
}

function BlitzSignupRoster({ blitzId }: { blitzId: string }) {
  const router = useRouter()
  const [data, setData] = React.useState<BoardData | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [notifying, setNotifying] = React.useState(false)
  const [finalizing, setFinalizing] = React.useState(false)
  // In-Staffing territory map (#1)
  const [territoryOpen, setTerritoryOpen] = React.useState(false)

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

  async function approve(repId: string) {
    setBusy(repId)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/signups/${repId}/approve`, { method: "POST" })
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

  // Reset staffing (the "redo"): unassign all leads + send activated reps back
  // to reserved. Reuses the territory reset.
  async function resetStaffing() {
    if (!window.confirm("Start staffing over? This unassigns all territory and sends activated reps back to “reserved.” Claims and the waitlist are kept.")) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/territory/reset`, { method: "POST" })
      if (res.ok) { await load(); router.refresh() } else window.alert((await res.json().catch(() => ({}))).error ?? "Couldn't reset.")
    } finally { setFinalizing(false) }
  }

  // Finalize: publish staffing + notify the confirmed crew. Until this, reps get
  // no check-in pings, so setup mistakes never notify anyone.
  async function publish() {
    const already = !!data?.staffingPublishedAt
    if (!window.confirm(already ? "Re-send the confirmation push to the active crew?" : "Finish staffing and notify the confirmed reps? Their check-ins start now.")) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/blitzes/${blitzId}/publish-staffing`, { method: "POST" })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { window.alert(`Confirmed ${d.confirmed} rep${d.confirmed === 1 ? "" : "s"} (${d.pushed} push${d.pushed === 1 ? "" : "es"} sent).`); await load(); router.refresh() }
      else window.alert(d.error ?? "Couldn't finish staffing.")
    } finally { setFinalizing(false) }
  }

  // Only blitzes that are actually on the rep board show this panel.
  if (!data || !data.openForSignup) return null

  const signups = data.signups
  const needsTerritory = signups.filter((s) => s.status === "CLAIMED")
  const active = signups.filter((s) => s.status === "ACTIVE")
  const waitlist = signups.filter((s) => s.status === "WAITLISTED").sort((a, b) => (a.waitPosition ?? 0) - (b.waitPosition ?? 0))

  const Row = ({ s, badge, extra }: { s: Signup; badge: React.ReactNode; extra?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{s.rep.name ?? s.rep.email}</div>
        <div className="text-xs text-muted-foreground truncate">{s.rep.email}</div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {extra}
        <Button variant="ghost" size="sm" disabled={busy === s.repId} onClick={() => decline(s.repId)}>
          {busy === s.repId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )

  const pendingApproval = needsTerritory.filter((s) => s.needsApproval)

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

      {pendingApproval.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-violet-700">Needs your approval — restricted-band rep claimed a spot</div>
          {pendingApproval.map((s) => (
            <Row
              key={s.id}
              s={s}
              badge={<span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Pending</span>}
              extra={
                <Button size="sm" variant="outline" disabled={busy === s.repId} onClick={() => approve(s.repId)}>
                  {busy === s.repId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                  Approve
                </Button>
              }
            />
          ))}
        </div>
      )}

      {needsTerritory.filter((s) => !s.needsApproval).length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-amber-700">Needs territory — assign on the map to activate</div>
            <Button size="sm" variant="outline" onClick={() => setTerritoryOpen(true)}>
              <MapPinned className="mr-1.5 h-3.5 w-3.5" />Assign on map
            </Button>
          </div>
          {needsTerritory.filter((s) => !s.needsApproval).map((s) => (
            <Row key={s.id} s={s} badge={<span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Reserved</span>} />
          ))}
        </div>
      )}

      {/* In-Staffing territory map (#1): carve territory + activate reps here */}
      <TerritoryDialog
        blitzId={blitzId}
        reps={signups.filter((s) => (s.status === "CLAIMED" && !s.needsApproval) || s.status === "ACTIVE").map((s) => ({ repId: s.repId, name: s.rep.name ?? s.rep.email }))}
        open={territoryOpen}
        onClose={() => setTerritoryOpen(false)}
        onChanged={() => { load(); router.refresh() }}
      />

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

      {/* Finalize: reps get no check-in pings until this. Reset to start over. */}
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <div className="text-xs">
          {data.staffingPublishedAt ? (
            <span className="font-medium text-green-700">Staffing finalized · crew notified {new Date(data.staffingPublishedAt).toLocaleDateString()}</span>
          ) : (
            <span className="text-muted-foreground">Draft — no rep is notified until you finish. Reset to start over.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={finalizing || (active.length === 0 && needsTerritory.length === 0)} onClick={resetStaffing}>
            {finalizing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}Reset
          </Button>
          <Button size="sm" variant={data.staffingPublishedAt ? "outline" : "default"} disabled={finalizing || active.length === 0} onClick={publish}>
            {finalizing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
            {data.staffingPublishedAt ? "Re-notify crew" : "Finish & notify reps"}
          </Button>
        </div>
      </div>
    </div>
  )
}
