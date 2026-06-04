"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock, Home, ArrowLeftRight, CheckCircle2, XCircle, MapIcon, ListIcon, Navigation, X, ChevronRight } from "lucide-react";
import { RepLeadsMap, type RepLeadPin } from "./rep-leads-map";

type Disposition = "PENDING" | "NOT_HOME" | "GO_BACK" | "SOLD" | "NOT_INTERESTED";

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  disposition: Disposition;
  notes: string | null;
}

// Disposition palette (rep-requested 2026-06-04): yellow = Not Home (no
// answer), blue = Go Back (follow up), green = Sold, red = Not Interested
// (no sale), gray = Pending. Kept in sync with the rep map + admin.
const DISPO: Record<Disposition, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING:        { label: "Pending",        color: "text-gray-700",   bg: "bg-gray-100",   icon: Clock },
  NOT_HOME:       { label: "Not Home",       color: "text-yellow-700", bg: "bg-yellow-100", icon: Home },
  GO_BACK:        { label: "Go Back",        color: "text-blue-700",   bg: "bg-blue-100",   icon: ArrowLeftRight },
  SOLD:           { label: "Sold",           color: "text-green-700",  bg: "bg-green-100",  icon: CheckCircle2 },
  NOT_INTERESTED: { label: "Not Interested", color: "text-red-700",    bg: "bg-red-100",    icon: XCircle },
};

const FILTERS: Array<{ key: Disposition | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "NOT_HOME", label: "Not Home" },
  { key: "GO_BACK", label: "Go Back" },
  { key: "SOLD", label: "Sold" },
  { key: "NOT_INTERESTED", label: "No Interest" },
];

const RESOLVE_OPTIONS: Array<{ key: Disposition; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "NOT_HOME", label: "Not Home" },
  { key: "GO_BACK", label: "Go Back" },
  { key: "SOLD", label: "Sold" },
  { key: "NOT_INTERESTED", label: "Not Interested" },
];

type ViewMode = "list" | "map";

export default function RepLeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialView = (searchParams.get("view") as ViewMode) || "list";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<Disposition | "ALL">("PENDING");
  const [view, setView] = useState<ViewMode>(initialView);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [resolving, setResolving] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== "ALL") params.set("disposition", activeFilter);
      const res = await fetch(`/api/door-knock-leads?${params}`);
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const mappableLeads = useMemo<RepLeadPin[]>(
    () =>
      leads
        .filter((l): l is Lead & { lat: number; lng: number } => typeof l.lat === "number" && typeof l.lng === "number")
        .map((l) => ({
          id: l.id,
          lat: l.lat,
          lng: l.lng,
          street: `${l.streetNumber} ${l.streetName}`,
          disposition: l.disposition,
        })),
    [leads]
  );

  const navigateTo = (lead: Lead) => {
    if (typeof lead.lat !== "number" || typeof lead.lng !== "number") return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`;
    window.open(url, "_blank");
  };

  const saleFormHref = (lead: Lead): string => {
    const address = `${lead.streetNumber} ${lead.streetName}, ${lead.city}, ${lead.state} ${lead.zip}`;
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
    const params = new URLSearchParams({ address, leadId: lead.id });
    if (name) params.set("customerName", name);
    return `/rep/sales/new?${params}`;
  };

  const goToSaleForm = useCallback(
    (lead: Lead) => router.push(saleFormHref(lead)),
    [router]
  );

  const resolve = async (disposition: Disposition) => {
    if (!selectedLead) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/door-knock-leads/${selectedLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition }),
      });
      if (res.ok) {
        if (disposition === "SOLD") {
          goToSaleForm(selectedLead);
          return;
        }
        setSelectedLead(null);
        fetchLeads();
      }
    } finally {
      setResolving(false);
    }
  };

  const handlePinPress = useCallback((pin: RepLeadPin) => {
    const lead = leads.find((l) => l.id === pin.id);
    if (!lead) return;
    if (lead.disposition === "SOLD") {
      goToSaleForm(lead);
      return;
    }
    setSelectedLead(lead);
  }, [leads, goToSaleForm]);

  const pendingCount = leads.filter((l) => l.disposition === "PENDING").length;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">My Leads</h1>
          <p className="text-xs text-gray-500">
            {pendingCount} pending of {leads.length} total
          </p>
        </div>
        <button
          onClick={() => {
            const next: ViewMode = view === "list" ? "map" : "list";
            setView(next);
            router.replace(`/rep/leads?view=${next}`);
          }}
          className="rounded-full bg-gray-100 p-2"
          aria-label={view === "list" ? "Switch to map view" : "Switch to list view"}
        >
          {view === "list" ? <MapIcon className="size-5 text-blue-600" /> : <ListIcon className="size-5 text-blue-600" />}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="border-b bg-white">
        <div className="flex overflow-x-auto px-3 py-2 gap-2 no-scrollbar">
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${
                  active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center text-sm text-gray-500 py-10">Loading…</div>
          ) : leads.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-10">
              No leads. {activeFilter !== "ALL" ? "Try a different filter." : "Your admin will assign leads to you."}
            </div>
          ) : (
            leads.map((lead) => {
              const cfg = DISPO[lead.disposition];
              const Icon = cfg.icon;
              return (
                <button
                  key={lead.id}
                  onClick={() => {
                    if (lead.disposition === "SOLD") {
                      goToSaleForm(lead);
                      return;
                    }
                    setSelectedLead(lead);
                  }}
                  className="w-full text-left bg-white rounded-lg border p-3 active:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <Icon className="size-3.5" />
                      {cfg.label}
                    </span>
                    <ChevronRight className="size-4 text-gray-400" />
                  </div>
                  <div className="font-medium text-gray-900">
                    {lead.streetNumber} {lead.streetName}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lead.city}, {lead.state} {lead.zip}
                  </div>
                  {lead.notes && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">{lead.notes}</div>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 relative">
          {mappableLeads.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 p-6 text-center">
              {leads.length === 0
                ? "No leads to show on map."
                : "Your leads have no coordinates — switch to list view."}
            </div>
          ) : (
            <RepLeadsMap pins={mappableLeads} onPinPress={handlePinPress} />
          )}
        </div>
      )}

      {/* Action sheet */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLead(null); }}
        >
          <div className="w-full max-w-md bg-white rounded-t-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="font-semibold">{selectedLead.streetNumber} {selectedLead.streetName}</div>
                <div className="text-xs text-gray-500">{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-500">
                <X className="size-5" />
              </button>
            </div>

            <div className="p-4 space-y-2">
              <button
                onClick={() => navigateTo(selectedLead)}
                disabled={typeof selectedLead.lat !== "number"}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white font-medium py-3 disabled:bg-gray-300"
              >
                <Navigation className="size-4" />
                Navigate
              </button>

              <div className="text-xs uppercase tracking-wide text-gray-500 pt-2">
                {selectedLead.disposition === "PENDING" ? "Resolve" : "Change status"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {RESOLVE_OPTIONS.filter((opt) => opt.key !== selectedLead.disposition).map((opt) => {
                  const cfg = DISPO[opt.key];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => resolve(opt.key)}
                      disabled={resolving}
                      className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-3 text-sm font-medium ${cfg.color}`}
                    >
                      <Icon className="size-5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
