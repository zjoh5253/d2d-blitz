"use client";

import * as React from "react";
import { Wallet, Clock, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

// Rep-facing "My Pay" screen. Mirrors the rep home card conventions
// (white rounded cards, blue accents). Read-only view of the rep's own
// commissions + payout history, scoped server-side to the logged-in rep.

type PayData = {
  tier: { name: string; multiplier: number } | null;
  holds: { active: number; reasons: string[] };
  summary: { paidToDate: number; pending: number; onHold: number; lifetimeGross: number };
  recent: {
    id: string;
    customerName: string;
    carrierName: string;
    blitzName: string;
    repPay: number;
    status: string;
    createdAt: string;
  }[];
  payouts: {
    id: string;
    period: string;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    status: string;
    complianceVerified: boolean;
    approvedAt: string | null;
  }[];
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function commissionPill(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";
    case "ON_HOLD":
      return "bg-red-100 text-red-700";
    case "PENDING":
      return "bg-blue-100 text-blue-700";
    default: // ELIGIBLE
      return "bg-amber-100 text-amber-700";
  }
}

function batchPill(status: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";
    case "APPROVED":
      return "bg-indigo-100 text-indigo-700";
    case "REVIEWED":
      return "bg-blue-100 text-blue-700";
    default: // DRAFT
      return "bg-gray-100 text-gray-600";
  }
}

export default function RepPayPage() {
  const [data, setData] = React.useState<PayData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rep/pay");
        if (res.ok) setData(await res.json());
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Couldn&apos;t load your pay right now. Pull to refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Wallet className="size-5 text-blue-600" />
          My Pay
        </h1>
        {data.tier && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {data.tier.name} &middot; ×{data.tier.multiplier}
          </span>
        )}
      </div>

      {data.holds.active > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div className="text-xs text-red-700">
            <p className="font-semibold">
              Payouts on hold ({data.holds.active} compliance {data.holds.active === 1 ? "hold" : "holds"})
            </p>
            {data.holds.reasons.length > 0 && <p className="mt-0.5">{data.holds.reasons.join("; ")}</p>}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard
          icon={<Clock className="size-4 text-amber-600" />}
          label="Pending"
          value={usd(data.summary.pending)}
          hint="earned, not yet paid"
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4 text-green-600" />}
          label="Paid to date"
          value={usd(data.summary.paidToDate)}
        />
        {data.summary.onHold > 0 && (
          <SummaryCard
            icon={<AlertTriangle className="size-4 text-red-600" />}
            label="On hold"
            value={usd(data.summary.onHold)}
          />
        )}
        <SummaryCard
          icon={<TrendingUp className="size-4 text-blue-600" />}
          label="Lifetime"
          value={usd(data.summary.lifetimeGross)}
          hint="gross commissions"
        />
      </div>

      {/* Recent commissions */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Recent commissions</h2>
        {data.recent.length === 0 ? (
          <p className="text-xs text-gray-500">
            No commissions yet. They appear once a sale is verified as installed.
          </p>
        ) : (
          <ul className="divide-y">
            {data.recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{c.customerName}</p>
                  <p className="truncate text-xs text-gray-500">
                    {c.carrierName} &middot; {c.blitzName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{usdCents(c.repPay)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${commissionPill(c.status)}`}>
                    {c.status === "ELIGIBLE" ? "PENDING" : c.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payout history */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Payout history</h2>
        {data.payouts.length === 0 ? (
          <p className="text-xs text-gray-500">No payouts processed yet.</p>
        ) : (
          <ul className="divide-y">
            {data.payouts.map((p) => (
              <li key={p.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{p.period}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${batchPill(p.status)}`}>
                    {p.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {usdCents(p.grossPay)} gross
                    {p.totalDeductions > 0 && <> &minus; {usdCents(p.totalDeductions)} deductions</>}
                  </span>
                  <span className="font-semibold text-gray-900">{usdCents(p.netPay)} net</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-gray-400">
        Commissions are created when a sale is verified as installed, then roll into a payout batch
        for the period. Amounts reflect your governance tier multiplier.
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
