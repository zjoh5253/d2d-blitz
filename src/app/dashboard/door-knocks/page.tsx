"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, UserPlus, Check, X, FileSpreadsheet, ChevronDown } from "lucide-react";

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
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [selectedBlitzId, setSelectedBlitzId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastClickedIndex = useRef<number | null>(null);

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

      const res = await fetch(`/api/door-knock-leads?${params}`);
      if (res.ok) {
        setLeads(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
    }
  }, [filterDisposition, filterRepId]);

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
          value={filterDisposition}
          onChange={(e) => setFilterDisposition(e.target.value as Disposition | "ALL" | "UNASSIGNED" | "ASSIGNED")}
          className="h-9 px-3 rounded-lg border text-sm"
        >
          <option value="ALL">All Leads</option>
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
