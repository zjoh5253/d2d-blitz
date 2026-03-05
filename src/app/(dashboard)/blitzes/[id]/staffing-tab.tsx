"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Trash2 } from "lucide-react"
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
}

export function StaffingTab({ blitzId, assignments: initialAssignments, availableReps }: StaffingTabProps) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {assignments.length} rep{assignments.length !== 1 ? "s" : ""} assigned
        </p>
        <Button size="sm" onClick={() => setAssignOpen(true)}>
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
