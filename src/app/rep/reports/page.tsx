"use client";

import { useEffect, useState } from "react";
import { Plus, X, ChevronLeft } from "lucide-react";

interface Blitz { id: string; name: string }

interface DailyReport {
  id: string;
  date: string;
  doorsKnocked: number;
  conversations: number;
  goBacksRecorded: number;
  appointmentsScheduled: number;
  salesCount: number;
  blitz?: { name: string };
}

export default function RepReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-reports");
      if (res.ok) setReports(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const todayTotals = reports
    .filter((r) => r.date.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce(
      (acc, r) => ({
        doors: acc.doors + r.doorsKnocked,
        convos: acc.convos + r.conversations,
        sales: acc.sales + r.salesCount,
      }),
      { doors: 0, convos: 0, sales: 0 }
    );

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Daily Reports</h1>
          <p className="text-xs text-gray-500">Track your daily door-knock numbers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-4 py-2 text-sm font-medium"
        >
          <Plus className="size-4" />
          New
        </button>
      </header>

      {/* Today summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Doors today" value={todayTotals.doors} />
        <StatCard label="Conversations" value={todayTotals.convos} />
        <StatCard label="Sales" value={todayTotals.sales} />
      </div>

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          No reports yet. Tap <strong>New</strong> after a shift to log your numbers.
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">
                  {new Date(r.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </div>
                {r.blitz?.name && <div className="text-xs text-gray-500">{r.blitz.name}</div>}
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <Mini label="Doors" value={r.doorsKnocked} />
                <Mini label="Convos" value={r.conversations} />
                <Mini label="Go-backs" value={r.goBacksRecorded} />
                <Mini label="Appts" value={r.appointmentsScheduled} />
                <Mini label="Sales" value={r.salesCount} highlight />
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <NewReportSheet onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchReports(); }} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border p-3 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function Mini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-base font-bold ${highlight ? "text-emerald-700" : "text-gray-700"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function NewReportSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [blitzId, setBlitzId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [doorsKnocked, setDoorsKnocked] = useState("");
  const [conversations, setConversations] = useState("");
  const [goBacksRecorded, setGoBacksRecorded] = useState("");
  const [appointmentsScheduled, setAppointmentsScheduled] = useState("");
  const [salesCount, setSalesCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/blitzes");
        if (res.ok) {
          const data = await res.json();
          const list: Blitz[] = Array.isArray(data) ? data : data.blitzes || [];
          setBlitzes(list);
          if (list.length === 1) setBlitzId(list[0].id);
        }
      } catch {}
    })();
  }, []);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          blitzId,
          doorsKnocked: parseInt(doorsKnocked, 10) || 0,
          conversations: parseInt(conversations, 10) || 0,
          goBacksRecorded: parseInt(goBacksRecorded, 10) || 0,
          appointmentsScheduled: parseInt(appointmentsScheduled, 10) || 0,
          salesCount: parseInt(salesCount, 10) || 0,
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
          <button onClick={onClose}><ChevronLeft className="size-5" /></button>
          <h2 className="font-semibold">New Daily Report</h2>
          <button onClick={onClose}><X className="size-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />
          </Field>
          <Field label="Blitz">
            <select value={blitzId} onChange={(e) => setBlitzId(e.target.value)} className="w-full h-11 px-3 rounded-lg border">
              <option value="">Pick a blitz…</option>
              {blitzes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Doors knocked"><NumInput value={doorsKnocked} onChange={setDoorsKnocked} /></Field>
          <Field label="Conversations"><NumInput value={conversations} onChange={setConversations} /></Field>
          <Field label="Go-backs recorded"><NumInput value={goBacksRecorded} onChange={setGoBacksRecorded} /></Field>
          <Field label="Appointments scheduled"><NumInput value={appointmentsScheduled} onChange={setAppointmentsScheduled} /></Field>
          <Field label="Sales"><NumInput value={salesCount} onChange={setSalesCount} /></Field>
          {error && <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-sm text-red-700">{error}</div>}
          <button onClick={submit} disabled={submitting || !blitzId} className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg">
            {submitting ? "Submitting…" : "Submit report"}
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

function NumInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 px-3 rounded-lg border" />;
}
