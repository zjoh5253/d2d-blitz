"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ClipboardList, CheckCircle2, MapPin, ChevronRight, Clock, FileText, ArrowLeftRight, Trophy, DollarSign } from "lucide-react";

interface LeadsSummary {
  total: number;
  pending: number;
  soldToday: number;
}

export default function RepHomePage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<LeadsSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/door-knock-leads?");
        if (!res.ok) return;
        const leads: Array<{ disposition: string; resolvedAt?: string | null }> = await res.json();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        setSummary({
          total: leads.length,
          pending: leads.filter((l) => l.disposition === "PENDING").length,
          soldToday: leads.filter(
            (l) =>
              l.disposition === "SOLD" &&
              l.resolvedAt &&
              new Date(l.resolvedAt) >= todayStart
          ).length,
        });
      } catch {}
    })();
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 space-y-4">
      <header className="bg-white rounded-lg border p-4">
        <p className="text-sm text-gray-500">{greeting},</p>
        <h1 className="text-2xl font-bold">{firstName}</h1>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={ClipboardList}
          label="Pending"
          value={summary?.pending ?? "—"}
          tone="text-gray-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Sold today"
          value={summary?.soldToday ?? "—"}
          tone="text-emerald-700"
        />
        <StatCard
          icon={MapPin}
          label="Total leads"
          value={summary?.total ?? "—"}
          tone="text-blue-700"
        />
      </div>

      <Link
        href="/rep/leads"
        className="flex items-center justify-between bg-blue-600 text-white rounded-lg p-4 font-medium"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="size-5" />
          View my leads
        </span>
        <ChevronRight className="size-5" />
      </Link>

      <Link
        href="/rep/leads?view=map"
        className="flex items-center justify-between bg-white border rounded-lg p-4 font-medium text-gray-900"
      >
        <span className="flex items-center gap-2">
          <MapPin className="size-5 text-blue-600" />
          Open map
        </span>
        <ChevronRight className="size-5 text-gray-400" />
      </Link>

      {/* Secondary quick links — Reports / Go-backs / Leaderboard / New sale */}
      <div className="grid grid-cols-2 gap-2">
        <QuickLink href="/rep/sales/new" icon={DollarSign} label="New sale" tone="text-emerald-700" />
        <QuickLink href="/rep/gobacks" icon={ArrowLeftRight} label="Go-backs" tone="text-yellow-700" />
        <QuickLink href="/rep/reports" icon={FileText} label="Daily report" tone="text-blue-700" />
        <QuickLink href="/rep/leaderboard" icon={Trophy} label="Leaderboard" tone="text-orange-700" />
      </div>

      <div className="bg-white rounded-lg border p-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5 mb-1">
          <Clock className="size-3.5" />
          <span className="font-medium text-gray-700">Tip</span>
        </div>
        Tap any pin on the map to get Google Maps directions to that door.
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-3 text-center">
      <Icon className={`size-5 mx-auto mb-1 ${tone}`} />
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function QuickLink({
  href, icon: Icon, label, tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
}) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-1 bg-white rounded-lg border p-3 active:bg-gray-50">
      <Icon className={`size-5 ${tone}`} />
      <span className="text-sm font-medium text-gray-900">{label}</span>
    </Link>
  );
}
