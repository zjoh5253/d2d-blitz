"use client";

import { useEffect, useState } from "react";
import { Plus, X, Calendar, CalendarPlus, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { EnableRemindersButton } from "@/components/enable-reminders-button";

type GoBackStatus = "SCHEDULED" | "REVISITED" | "CONVERTED" | "CLOSED";

interface GoBack {
  id: string;
  prospectName: string;
  prospectPhone: string | null;
  prospectAddress: string;
  followUpDate: string;
  notes: string | null;
  status: GoBackStatus;
  blitz?: { name: string };
}

interface Blitz { id: string; name: string }

const STATUS_CFG: Record<GoBackStatus, { label: string; bg: string; color: string; btnLabel: string }> = {
  SCHEDULED: { label: "Scheduled", bg: "bg-blue-100",    color: "text-blue-700",    btnLabel: "Scheduled" },
  REVISITED: { label: "Revisited", bg: "bg-amber-100",   color: "text-amber-700",   btnLabel: "Revisited" },
  CONVERTED: { label: "Converted", bg: "bg-emerald-100", color: "text-emerald-700", btnLabel: "Converted" },
  CLOSED:    { label: "Closed",    bg: "bg-gray-100",    color: "text-gray-700",    btnLabel: "Close" },
};

const STATUS_ORDER: GoBackStatus[] = ["SCHEDULED", "REVISITED", "CONVERTED", "CLOSED"];

const REMINDER_OPTS: { value: string; label: string }[] = [
  { value: "0", label: "At time" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "1 day" },
];

// Google Calendar "add event" template link. Reminders aren't settable via the
// template URL (Google uses the user's default) — the Apple/.ics path carries
// the exact reminder.
function googleCalUrl(g: GoBack): string {
  const start = new Date(g.followUpDate);
  const end = new Date(start.getTime() + 30 * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Follow-up: ${g.prospectName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [g.prospectPhone ? `Phone: ${g.prospectPhone}` : "", g.notes ?? ""].filter(Boolean).join("\n"),
    location: g.prospectAddress,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function RepGobacksPage() {
  const [gobacks, setGobacks] = useState<GoBack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<GoBackStatus | "ALL">("SCHEDULED");
  const [reminders, setReminders] = useState<Record<string, string>>({});

  const fetchGobacks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/go-backs?${params}`);
      if (res.ok) setGobacks(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGobacks(); }, [statusFilter]);

  const advanceStatus = async (g: GoBack, status: GoBackStatus) => {
    if (status === g.status) return;
    const currentIdx = STATUS_ORDER.indexOf(g.status);
    const nextIdx = STATUS_ORDER.indexOf(status);
    if (
      nextIdx < currentIdx &&
      !window.confirm(
        `Change status from ${STATUS_CFG[g.status].label} to ${STATUS_CFG[status].label}?`
      )
    ) {
      return;
    }
    await fetch(`/api/go-backs/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchGobacks();
  };

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Go-Backs</h1>
          <p className="text-xs text-gray-500">Follow-ups you scheduled</p>
        </div>
        <div className="flex items-center gap-2">
          <EnableRemindersButton />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-4 py-2 text-sm font-medium">
            <Plus className="size-4" /> New
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["SCHEDULED", "REVISITED", "CONVERTED", "CLOSED", "ALL"] as const).map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {s === "ALL" ? "All" : STATUS_CFG[s].label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Loading…</div>
      ) : gobacks.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">No go-backs for this status.</div>
      ) : (
        gobacks.map((g) => {
          const cfg = STATUS_CFG[g.status];
          return (
            <div key={g.id} className="bg-white rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{g.prospectName}</div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(g.prospectAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-blue-600 flex items-center gap-1 mt-0.5 underline-offset-2 hover:underline"
                  >
                    <MapPin className="size-3" /> {g.prospectAddress}
                  </a>
                  {g.prospectPhone && (
                    <a href={`tel:${g.prospectPhone}`} className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                      <Phone className="size-3" /> {g.prospectPhone}
                    </a>
                  )}
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="size-3" /> {new Date(g.followUpDate).toLocaleDateString()}
                  </div>
                  {g.notes && <div className="text-xs text-gray-500 mt-1">{g.notes}</div>}
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                {STATUS_ORDER.filter((s) => s !== g.status).map((nextStatus) => {
                  const next = STATUS_CFG[nextStatus];
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => advanceStatus(g, nextStatus)}
                      className={`flex-1 text-xs font-medium rounded py-1.5 flex items-center justify-center gap-1 ${next.bg} ${next.color}`}
                    >
                      {nextStatus === "CONVERTED" && <CheckCircle2 className="size-3" />}
                      {next.btnLabel}
                    </button>
                  );
                })}
              </div>
              {(g.status === "SCHEDULED" || g.status === "REVISITED") && (
                <div className="flex items-center gap-2 pt-2 border-t text-xs">
                  <span className="text-gray-500 flex items-center gap-1 shrink-0">
                    <CalendarPlus className="size-3" /> Remind
                  </span>
                  <select
                    value={reminders[g.id] ?? "30"}
                    onChange={(e) => setReminders((r) => ({ ...r, [g.id]: e.target.value }))}
                    className="rounded border border-gray-200 px-1.5 py-1 bg-white"
                    aria-label="Reminder time before follow-up"
                  >
                    {REMINDER_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <a
                    href={`/api/go-backs/${g.id}/calendar?reminder=${reminders[g.id] ?? "30"}`}
                    className="ml-auto rounded bg-gray-100 px-2 py-1 font-medium text-gray-700"
                  >
                    Apple
                  </a>
                  <a
                    href={googleCalUrl(g)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-gray-100 px-2 py-1 font-medium text-gray-700"
                  >
                    Google
                  </a>
                </div>
              )}
            </div>
          );
        })
      )}

      {showForm && <NewGobackSheet onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchGobacks(); }} />}
    </div>
  );
}

function NewGobackSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [blitzId, setBlitzId] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [prospectAddress, setProspectAddress] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/blitzes");
      if (res.ok) {
        const data = await res.json();
        const list: Blitz[] = Array.isArray(data) ? data : data.blitzes || [];
        setBlitzes(list);
        if (list.length === 1) setBlitzId(list[0].id);
      }
    })();
  }, []);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/go-backs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blitzId, prospectName, prospectPhone: prospectPhone || undefined,
          prospectAddress,
          // datetime-local gives a TZ-less wall-clock ("2026-06-11T14:30");
          // convert it to a timezone-aware ISO in the rep's browser so the
          // server (UTC on prod) stores the intended moment, not 14:30 UTC.
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : followUpDate,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
          <h2 className="font-semibold">New Go-Back</h2>
          <button onClick={onClose}><X className="size-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Blitz *">
            <select value={blitzId} onChange={(e) => setBlitzId(e.target.value)} className="w-full h-11 px-3 rounded-lg border">
              <option value="">Pick a blitz…</option>
              {blitzes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Prospect name *">
            <input value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />
          </Field>
          <Field label="Phone">
            <input type="tel" inputMode="tel" value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />
          </Field>
          <Field label="Address *">
            <input value={prospectAddress} onChange={(e) => setProspectAddress(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />
          </Field>
          <Field label="Follow-up date & time *">
            <input type="datetime-local" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border" />
          </Field>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
          <button onClick={submit} disabled={submitting || !blitzId || !prospectName || !prospectAddress || !followUpDate} className="w-full bg-blue-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg">
            {submitting ? "Saving…" : "Save go-back"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}
