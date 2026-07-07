"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, CheckCircle2, Clock, AlertCircle, X } from "lucide-react";

// SaleStatus enum mirror — used for the badge styling.
type SaleStatus = "SUBMITTED" | "APPROVED" | "INSTALLED" | "CANCELLED" | "EXCEPTION";

interface Sale {
  id: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  installDate: string;
  status: SaleStatus;
  submittedAt: string;
  carrier?: { name: string };
  blitz?: { name: string };
}

const STATUS_CFG: Record<SaleStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  SUBMITTED:  { label: "Submitted",  color: "text-blue-700",    bg: "bg-blue-100",    icon: Clock },
  APPROVED:   { label: "Approved",   color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  INSTALLED:  { label: "Installed",  color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",  color: "text-red-700",     bg: "bg-red-100",     icon: X },
  EXCEPTION:  { label: "Exception",  color: "text-amber-700",   bg: "bg-amber-100",   icon: AlertCircle },
};

export default function RepSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sales");
        if (res.ok) setSales(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group by month for scannability.
  const byMonth = new Map<string, Sale[]>();
  for (const s of sales) {
    const d = s.submittedAt ? new Date(s.submittedAt) : new Date();
    const key = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(s);
  }
  const months = [...byMonth.keys()];

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">My Sales</h1>
          <p className="text-xs text-gray-500">
            {sales.length} {sales.length === 1 ? "sale" : "sales"} submitted
          </p>
        </div>
        <Link
          href="/rep/sales/new"
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-medium shadow"
        >
          <Plus className="size-4" />
          New
        </Link>
      </header>

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Loading…</div>
      ) : sales.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          No sales yet. Tap <strong>New</strong> to submit one.
        </div>
      ) : (
        months.map((m) => {
          const items = byMonth.get(m)!;
          return (
            <section key={m} className="space-y-2">
              <h2 className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                {m} · {items.length}
              </h2>
              {items.map((s) => {
                const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.SUBMITTED;
                const Icon = cfg.icon;
                return (
                  <Link
                    key={s.id}
                    href={`/rep/sales/new?saleId=${s.id}`}
                    className="block bg-white rounded-lg border p-3 space-y-1 active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 truncate">
                          {s.customerName}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.customerAddress}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="size-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {s.carrier?.name && <span>{s.carrier.name}</span>}
                      {s.installDate && (
                        <span>Install: {new Date(s.installDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </section>
          );
        })
      )}
    </div>
  );
}
