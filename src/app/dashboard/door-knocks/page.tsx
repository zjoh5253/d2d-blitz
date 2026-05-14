"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, UserPlus, Check, X, FileSpreadsheet, ChevronDown, MapPin, Sparkles, Map as MapIcon } from "lucide-react";
import { ClusterMap, type ClusterMapPoint } from "./cluster-map";
import { TerritoryMap, type RepTerritory } from "./territory-map";

type Disposition = "PENDING" | "NOT_HOME" | "GO_BACK" | "SOLD" | "NOT_INTERESTED";

interface DoorKnockLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  zip: string;
  disposition: Disposition;
  notes: string | null;
  assignedRepId: string | null;
  uploadBatchId: string | null;
  createdAt: string;
  assignedRep: { id: string; name: string | null } | null;
  blitz: { id: string; name: string } | null;
}

interface Rep {
  id: string;
  name: string | null;
  email: string;
}

interface Blitz {
  id: string;
  name: string;
}

interface PlannerCluster {
  clusterIdx: number;
  leadIds: string[];
  points: { id: string; lat: number; lng: number; street: string }[];
  leadCount: number;
  centroid: { lat: number; lng: number };
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  topStreets: string[];
  daysAtTarget: number | null;
  overTarget: boolean;
}

interface PlannerResult {
  clusters: PlannerCluster[];
  totalLeads: number;
  leadsPerRep: number;
  skippedNoCoords: number;
  doorsPerRepPerDay: number;
  warning?: string;
}

interface SavedPlan {
  id: string;
  name: string;
  numReps: number;
  numDays: number | null;
  assignments: {
    plannerResult: PlannerResult;
    clusterAssignments: Record<number, string>;
  };
  createdAt: string;
  appliedAt: string | null;
}

const CLUSTER_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500",
  "bg-cyan-500", "bg-orange-500", "bg-pink-500", "bg-lime-500", "bg-indigo-500",
];

const DISPOSITION_LABELS: Record<Disposition, string> = {
  PENDING: "Pending",
  NOT_HOME: "Not Home",
  GO_BACK: "Go Back",
  SOLD: "Sold",
  NOT_INTERESTED: "Not Interested",
};

const DISPOSITION_COLORS: Record<Disposition, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  NOT_HOME: "bg-amber-100 text-amber-700",
  GO_BACK: "bg-violet-100 text-violet-700",
  SOLD: "bg-emerald-100 text-emerald-700",
  NOT_INTERESTED: "bg-red-100 text-red-700",
};

export default function DoorKnocksPage() {
  const [leads, setLeads] = useState<DoorKnockLead[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRepId, setSelectedRepId] = useState("");
  const [filterDisposition, setFilterDisposition] = useState<Disposition | "ALL" | "UNASSIGNED" | "ASSIGNED">("ALL");
  const [filterRepId, setFilterRepId] = useState<string>("ALL");
  // Pre-select blitz filter from ?blitz=<id> query param so map-scanner
  // can deep-link to a freshly-created blitz's lead list.
  const searchParams = useSearchParams();
  const initialBlitzFilter = searchParams.get("blitz") ?? "ALL";
  const [filterBlitzId, setFilterBlitzId] = useState<string>(initialBlitzFilter);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [selectedBlitzId, setSelectedBlitzId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastClickedIndex = useRef<number | null>(null);

  // Rep-assignment planner — auto-clusters unassigned leads into geographic
  // territories sized for each rep's daily door-knock target.
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerNumReps, setPlannerNumReps] = useState(5);
  const [plannerNumDays, setPlannerNumDays] = useState(4);
  const [plannerIncludeAssigned, setPlannerIncludeAssigned] = useState(false);
  // When set, the planner redistributes only this rep's PENDING leads
  // across the other reps. Used when a rep drops mid-blitz.
  const [plannerSourceRepId, setPlannerSourceRepId] = useState<string>("");
  const [plannerComputing, setPlannerComputing] = useState(false);
  const [plannerApplying, setPlannerApplying] = useState(false);
  const [plannerResult, setPlannerResult] = useState<PlannerResult | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  // Territory map modal — visualizes who's covering what after assignments
  // are applied.
  const [territoriesOpen, setTerritoriesOpen] = useState(false);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  const [territories, setTerritories] = useState<RepTerritory[]>([]);

  const handleOpenTerritories = useCallback(async () => {
    if (filterBlitzId === "ALL") return;
    setTerritoriesOpen(true);
    setTerritoriesLoading(true);
    try {
      const res = await fetch(
        `/api/door-knock-leads?blitzId=${encodeURIComponent(filterBlitzId)}&assigned=true`
      );
      if (res.ok) {
        const all: DoorKnockLead[] = await res.json();
        // Group by rep.
        const byRep = new Map<string, RepTerritory>();
        for (const lead of all) {
          if (
            !lead.assignedRep ||
            typeof (lead as DoorKnockLead & { lat?: number; lng?: number }).lat !== "number" ||
            typeof (lead as DoorKnockLead & { lat?: number; lng?: number }).lng !== "number"
          ) continue;
          const key = lead.assignedRep.id;
          if (!byRep.has(key)) {
            byRep.set(key, {
              repId: lead.assignedRep.id,
              repName: lead.assignedRep.name ?? "Unknown",
              points: [],
            });
          }
          byRep.get(key)!.points.push({
            id: lead.id,
            lat: (lead as DoorKnockLead & { lat: number }).lat,
            lng: (lead as DoorKnockLead & { lng: number }).lng,
            street: `${lead.streetNumber} ${lead.streetName}`,
            disposition: lead.disposition,
          });
        }
        // Stable order: most leads first.
        setTerritories(
          Array.from(byRep.values()).sort((a, b) => b.points.length - a.points.length)
        );
      }
    } finally {
      setTerritoriesLoading(false);
    }
  }, [filterBlitzId]);
  // clusterIdx -> repId (or "" if not yet picked)
  const [clusterAssignments, setClusterAssignments] = useState<Record<number, string>>({});

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterDisposition === "UNASSIGNED") {
        params.set("unassigned", "true");
      } else if (filterDisposition === "ASSIGNED") {
        params.set("assigned", "true");
      } else if (filterDisposition !== "ALL") {
        params.set("disposition", filterDisposition);
      }
      if (filterRepId === "UNASSIGNED") params.set("unassigned", "true");
      else if (filterRepId !== "ALL") params.set("assignedRepId", filterRepId);

      if (filterBlitzId !== "ALL") params.set("blitzId", filterBlitzId);

      const res = await fetch(`/api/door-knock-leads?${params}`);
      if (res.ok) {
        setLeads(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [filterDisposition, filterRepId, filterBlitzId]);

  const fetchReps = async () => {
    try {
      const res = await fetch("/api/users?role=FIELD_REP");
      if (res.ok) setReps(await res.json());
    } catch (err) {
      console.error("Failed to fetch reps:", err);
    }
  };

  const fetchBlitzes = async () => {
    try {
      const res = await fetch("/api/blitzes");
      if (res.ok) {
        const data = await res.json();
        setBlitzes(Array.isArray(data) ? data : data.blitzes || []);
      }
    } catch (err) {
      console.error("Failed to fetch blitzes:", err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchReps();
    fetchBlitzes();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedBlitzId) formData.append("blitzId", selectedBlitzId);

      const res = await fetch("/api/door-knock-leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult(`Imported ${data.imported} leads`);
        fetchLeads();
      } else {
        setUploadResult(`Error: ${data.error}`);
      }
    } catch {
      setUploadResult("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAssign = async () => {
    if (!selectedRepId || selectedIds.size === 0) return;

    setAssigning(true);
    try {
      const res = await fetch("/api/door-knock-leads/assign", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
          repId: selectedRepId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setUploadResult(data.message);
        setSelectedIds(new Set());
        setSelectedRepId("");
        fetchLeads();
      }
    } catch {
      setUploadResult("Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent, id: string, index: number) => {
    e.preventDefault();
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (e.shiftKey && lastClickedIndex.current !== null) {
        const start = Math.min(lastClickedIndex.current, index);
        const end = Math.max(lastClickedIndex.current, index);
        for (let i = start; i <= end; i++) {
          next.add(leads[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }

      lastClickedIndex.current = index;
      return next;
    });
  };

  const handleComputePlan = async () => {
    if (filterBlitzId === "ALL") return;
    setPlannerComputing(true);
    setPlannerError(null);
    setPlannerResult(null);
    setClusterAssignments({});
    try {
      const res = await fetch("/api/door-knock-leads/cluster-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blitzId: filterBlitzId,
          numReps: plannerNumReps,
          numDays: plannerNumDays,
          includeAssigned: plannerIncludeAssigned,
          sourceRepId: plannerSourceRepId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlannerError(data.error ?? "Failed to compute plan");
        return;
      }
      setPlannerResult(data);
    } catch (err) {
      setPlannerError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlannerComputing(false);
    }
  };

  const fetchSavedPlans = useCallback(async (blitzId: string) => {
    try {
      const res = await fetch(`/api/door-knock-leads/cluster-plan/save?blitzId=${encodeURIComponent(blitzId)}`);
      if (res.ok) setSavedPlans(await res.json());
    } catch {}
  }, []);

  // Refresh saved plans whenever the planner opens.
  useEffect(() => {
    if (plannerOpen && filterBlitzId !== "ALL") {
      fetchSavedPlans(filterBlitzId);
    }
  }, [plannerOpen, filterBlitzId, fetchSavedPlans]);

  const handleSaveDraft = async () => {
    if (!plannerResult || filterBlitzId === "ALL") return;
    const name = window.prompt("Name this draft:", `Draft ${new Date().toLocaleString()}`);
    if (!name) return;
    setSavingDraft(true);
    setPlannerError(null);
    try {
      const res = await fetch("/api/door-knock-leads/cluster-plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blitzId: filterBlitzId,
          name,
          numReps: plannerNumReps,
          numDays: plannerNumDays,
          assignments: { plannerResult, clusterAssignments },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setPlannerError(data.error ?? "Failed to save draft");
        return;
      }
      await fetchSavedPlans(filterBlitzId);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = (plan: SavedPlan) => {
    setPlannerResult(plan.assignments.plannerResult);
    setClusterAssignments(plan.assignments.clusterAssignments ?? {});
    setPlannerNumReps(plan.numReps);
    if (plan.numDays !== null) setPlannerNumDays(plan.numDays);
    setPlannerError(null);
  };

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm("Delete this draft?")) return;
    await fetch(`/api/door-knock-leads/cluster-plan/save?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (filterBlitzId !== "ALL") await fetchSavedPlans(filterBlitzId);
  };

  const handleApplyPlan = async () => {
    if (!plannerResult) return;
    // Verify every cluster has a rep picked.
    const unassigned = plannerResult.clusters.filter((c) => !clusterAssignments[c.clusterIdx]);
    if (unassigned.length > 0) {
      setPlannerError(`Pick a rep for every cluster (${unassigned.length} unassigned).`);
      return;
    }
    setPlannerApplying(true);
    setPlannerError(null);
    try {
      let totalAssigned = 0;
      // One PUT per cluster — the existing assign endpoint takes
      // {leadIds[], repId} and updates them in one transaction.
      for (const c of plannerResult.clusters) {
        const repId = clusterAssignments[c.clusterIdx];
        const res = await fetch("/api/door-knock-leads/assign", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadIds: c.leadIds, repId }),
        });
        if (!res.ok) {
          const data = await res.json();
          setPlannerError(`Failed to assign cluster ${c.clusterIdx + 1}: ${data.error}`);
          return;
        }
        const data = await res.json();
        totalAssigned += data.assigned;
      }
      setUploadResult(`Assigned ${totalAssigned} leads across ${plannerResult.clusters.length} reps.`);
      setPlannerOpen(false);
      setPlannerResult(null);
      setClusterAssignments({});
      fetchLeads();
    } catch (err) {
      setPlannerError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlannerApplying(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const pendingCount = leads.filter((l) => l.disposition === "PENDING").length;
  const assignedCount = leads.filter((l) => l.assignedRepId).length;
  const resolvedCount = leads.filter((l) => l.disposition !== "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Door Knock Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload, assign, and track door-to-door leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleOpenTerritories}
            disabled={filterBlitzId === "ALL"}
            title={filterBlitzId === "ALL" ? "Select a blitz first" : "View per-rep territory map"}
          >
            <MapIcon className="size-4 mr-2" />
            View territories
          </Button>
          <Button
            onClick={() => {
              setPlannerOpen(true);
              setPlannerError(null);
              setPlannerResult(null);
            }}
            disabled={filterBlitzId === "ALL"}
            title={filterBlitzId === "ALL" ? "Select a blitz first to plan rep assignments" : ""}
          >
            <Sparkles className="size-4 mr-2" />
            Plan rep assignments
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: leads.length, color: "text-blue-600" },
          { label: "Pending", value: pendingCount, color: "text-gray-600" },
          { label: "Assigned", value: assignedCount, color: "text-violet-600" },
          { label: "Resolved", value: resolvedCount, color: "text-emerald-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          Import Leads from CSV
        </h2>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium text-muted-foreground block mb-1.5">
              Blitz (optional)
            </label>
            <select
              value={selectedBlitzId}
              onChange={(e) => setSelectedBlitzId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border text-sm"
            >
              <option value="">No blitz</option>
              {blitzes.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-4 mr-2" />
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>
        {uploadResult && (
          <p className={`mt-3 text-sm font-medium ${uploadResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
            {uploadResult}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Expected columns: First Name, Last Name, Street Number, Street Name, City, Zip, Notes
        </p>
      </div>

      {/* Assignment Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-blue-800">
              {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} selected
            </p>
            {selectedIds.size < leads.length && (
              <button
                onClick={toggleSelectAll}
                className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
              >
                Select all {leads.length.toLocaleString()}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="h-9 px-3 rounded-lg border text-sm"
            >
              <option value="">Assign to rep...</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.name || r.email}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!selectedRepId || assigning}
            >
              <UserPlus className="size-4 mr-1" />
              {assigning ? "Assigning..." : "Assign"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterBlitzId}
          onChange={(e) => setFilterBlitzId(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm"
        >
          <option value="ALL">All Blitzes</option>
          {blitzes.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={filterDisposition}
          onChange={(e) => setFilterDisposition(e.target.value as Disposition | "ALL" | "UNASSIGNED" | "ASSIGNED")}
          className="h-9 px-3 rounded-lg border text-sm"
        >
          <option value="ALL">All Dispositions</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="ASSIGNED">Assigned</option>
          {Object.entries(DISPOSITION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterRepId}
          onChange={(e) => setFilterRepId(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm"
        >
          <option value="ALL">All Reps</option>
          <option value="UNASSIGNED">Unassigned</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name || r.email}</option>
          ))}
        </select>
      </div>

      {/* Rep-assignment Planner */}
      {plannerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setPlannerOpen(false); }}
        >
          <div className="bg-white rounded-xl w-full max-w-4xl my-6 shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-violet-600" />
                <h2 className="text-lg font-semibold">Plan rep assignments</h2>
              </div>
              <button
                onClick={() => setPlannerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-sm text-muted-foreground">
                Auto-cluster the unassigned leads in this blitz into walkable
                territories — one per rep. Reps stay in tight geographic
                areas instead of driving across the ZIP.
              </p>

              {/* Inputs */}
              <div className="flex items-end gap-4 flex-wrap">
                <label className="flex flex-col text-xs font-medium text-muted-foreground">
                  Reps
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={plannerNumReps}
                    onChange={(e) => setPlannerNumReps(parseInt(e.target.value, 10) || 1)}
                    className="mt-1 w-24 h-10 px-3 rounded-lg border text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs font-medium text-muted-foreground">
                  Days
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={plannerNumDays}
                    onChange={(e) => setPlannerNumDays(parseInt(e.target.value, 10) || 1)}
                    className="mt-1 w-24 h-10 px-3 rounded-lg border text-sm"
                  />
                </label>
                <div className="text-sm text-muted-foreground pb-2">
                  Target = {plannerNumReps} × {plannerNumDays} × 100 ={" "}
                  <span className="font-semibold text-foreground">
                    {(plannerNumReps * plannerNumDays * 100).toLocaleString()} doors
                  </span>{" "}
                  at 100/rep/day
                </div>
                <Button
                  onClick={handleComputePlan}
                  disabled={plannerComputing || filterBlitzId === "ALL"}
                >
                  {plannerComputing ? "Computing…" : "Compute clusters"}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={plannerIncludeAssigned}
                  onChange={(e) => setPlannerIncludeAssigned(e.target.checked)}
                  disabled={!!plannerSourceRepId}
                  className="rounded"
                />
                Re-plan leads that are already assigned (overrides existing rep assignments)
              </label>
              {/* Rep-dropout redistribution. Pulls one rep's PENDING leads
                  and partitions them across the others. */}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="whitespace-nowrap">Rep dropped out — redistribute leads from:</span>
                <select
                  value={plannerSourceRepId}
                  onChange={(e) => setPlannerSourceRepId(e.target.value)}
                  className="h-8 px-2 rounded border text-sm"
                >
                  <option value="">(no — use default lead pool)</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.email}
                    </option>
                  ))}
                </select>
              </label>

              {plannerError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {plannerError}
                </div>
              )}

              {/* Saved drafts for this blitz */}
              {savedPlans.length > 0 && (
                <div className="rounded-lg border bg-gray-50/50 p-3 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Saved drafts for this blitz
                  </div>
                  {savedPlans.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                      <span className="flex-1 truncate">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.numReps} reps{p.numDays ? ` × ${p.numDays}d` : ""} ·
                          {" "}
                          {new Date(p.createdAt).toLocaleString()}
                        </span>
                        {p.appliedAt && (
                          <span className="ml-2 text-emerald-700 text-xs">(applied)</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(p)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(p.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {plannerResult && plannerResult.totalLeads === 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">No leads to cluster.</p>
                  <p>
                    {plannerResult.warning ??
                      "Every lead in this blitz is already assigned to a rep."}{" "}
                    Check the box above to re-plan leads that are already assigned.
                  </p>
                </div>
              )}
              {plannerResult && plannerResult.totalLeads > 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Clustered {plannerResult.totalLeads.toLocaleString()} leads
                    into {plannerResult.clusters.length} territories
                    {plannerResult.skippedNoCoords > 0 && (
                      <>
                        {" · "}
                        <span className="text-amber-700">
                          {plannerResult.skippedNoCoords} skipped (no coordinates)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Map view: every lead as a colored pin per territory.
                      Click a pin (or shift+drag a rectangle) to reassign
                      leads between territories before applying. */}
                  <ClusterMap
                    points={plannerResult.clusters.flatMap((c) =>
                      c.points.map((p) => ({
                        id: p.id,
                        lat: p.lat,
                        lng: p.lng,
                        clusterIdx: c.clusterIdx,
                        street: p.street,
                      } satisfies ClusterMapPoint))
                    )}
                    numClusters={plannerResult.clusters.length}
                    onReassign={(leadIds, newClusterIdx) => {
                      // Move the leads from their current cluster(s) into
                      // newClusterIdx. Mutates plannerResult.clusters by
                      // splicing leadIds + points and updating counts.
                      setPlannerResult((prev) => {
                        if (!prev) return prev;
                        const moved = new Set(leadIds);
                        const next = prev.clusters.map((c) => ({
                          ...c,
                          leadIds: [...c.leadIds],
                          points: [...c.points],
                        }));
                        // Collect moved points from source clusters.
                        const harvested: typeof next[number]["points"] = [];
                        for (const c of next) {
                          if (c.clusterIdx === newClusterIdx) continue;
                          const keptIds: string[] = [];
                          const keptPoints: typeof c.points = [];
                          for (let i = 0; i < c.leadIds.length; i++) {
                            const id = c.leadIds[i];
                            if (moved.has(id)) {
                              harvested.push(c.points[i]);
                            } else {
                              keptIds.push(id);
                              keptPoints.push(c.points[i]);
                            }
                          }
                          c.leadIds = keptIds;
                          c.points = keptPoints;
                          c.leadCount = keptIds.length;
                        }
                        // Dump into destination cluster.
                        const dest = next.find((c) => c.clusterIdx === newClusterIdx);
                        if (dest) {
                          dest.leadIds = [
                            ...dest.leadIds,
                            ...harvested.map((p) => p.id),
                          ];
                          dest.points = [...dest.points, ...harvested];
                          dest.leadCount = dest.leadIds.length;
                        }
                        return { ...prev, clusters: next };
                      });
                    }}
                  />

                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left">Territory</th>
                          <th className="p-3 text-left">Leads</th>
                          <th className="p-3 text-left">Days at 100/day</th>
                          <th className="p-3 text-left">Top streets</th>
                          <th className="p-3 text-left">Assign to rep</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plannerResult.clusters.map((c) => (
                          <tr key={c.clusterIdx} className="border-t">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block size-3 rounded-full ${CLUSTER_COLORS[c.clusterIdx % CLUSTER_COLORS.length]}`}
                                />
                                <span className="font-medium">#{c.clusterIdx + 1}</span>
                              </div>
                            </td>
                            <td className="p-3 font-medium">
                              {c.leadCount.toLocaleString()}
                            </td>
                            <td className="p-3">
                              {c.daysAtTarget !== null ? (
                                <span className={c.overTarget ? "text-amber-700 font-medium" : ""}>
                                  {c.daysAtTarget.toFixed(1)} days
                                  {c.overTarget && " (over)"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {c.topStreets.join(", ")}
                            </td>
                            <td className="p-3">
                              <select
                                value={clusterAssignments[c.clusterIdx] ?? ""}
                                onChange={(e) =>
                                  setClusterAssignments((prev) => ({
                                    ...prev,
                                    [c.clusterIdx]: e.target.value,
                                  }))
                                }
                                className="h-8 px-2 rounded border text-sm"
                              >
                                <option value="">Pick rep…</option>
                                {reps.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name || r.email}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Same rep can be assigned to multiple territories.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setPlannerOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleSaveDraft}
                        disabled={savingDraft || plannerApplying}
                      >
                        {savingDraft ? "Saving…" : "Save as draft"}
                      </Button>
                      <Button
                        onClick={handleApplyPlan}
                        disabled={plannerApplying}
                      >
                        <Check className="size-4 mr-1" />
                        {plannerApplying ? "Applying…" : "Apply assignments"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Territory Map Modal */}
      {territoriesOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setTerritoriesOpen(false); }}
        >
          <div className="bg-white rounded-xl w-full max-w-5xl my-6 shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div className="flex items-center gap-2">
                <MapIcon className="size-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Territory map</h2>
              </div>
              <button
                onClick={() => setTerritoriesOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Each rep&apos;s currently-assigned leads with a convex-hull
                polygon showing the territory they cover. Pins are colored by rep.
              </p>
              {territoriesLoading ? (
                <div className="text-sm text-muted-foreground p-8 text-center">
                  Loading territories…
                </div>
              ) : territories.length === 0 ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  No assigned leads with coordinates in this blitz yet. Use the planner to assign reps first.
                </div>
              ) : (
                <TerritoryMap territories={territories} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="p-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="p-3 text-left font-medium text-muted-foreground">Address</th>
              <th className="p-3 text-left font-medium text-muted-foreground">City</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Assigned To</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Disposition</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No leads found. Upload a CSV to get started.
                </td>
              </tr>
            ) : (
              leads.map((lead, index) => (
                <tr
                  key={lead.id}
                  className={`border-b last:border-0 hover:bg-gray-50/50 cursor-pointer select-none ${selectedIds.has(lead.id) ? "bg-blue-50" : ""}`}
                  onClick={(e) => handleRowClick(e, lead.id, index)}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      readOnly
                      className="rounded pointer-events-none"
                    />
                  </td>
                  <td className="p-3 font-medium">
                    {lead.streetNumber} {lead.streetName}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {lead.city}, {lead.state} {lead.zip}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="p-3">
                    {lead.assignedRep ? (
                      <span className="text-sm font-medium">{lead.assignedRep.name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DISPOSITION_COLORS[lead.disposition]}`}>
                      {DISPOSITION_LABELS[lead.disposition]}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                    {lead.notes || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
