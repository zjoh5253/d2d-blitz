"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle2,
  MapPin,
  ChevronRight,
  Clock,
  FileText,
  ArrowLeftRight,
  Trophy,
  DollarSign,
  Timer,
  Wallet,
} from "lucide-react";

interface LeadsSummary {
  total: number;
  pending: number;
  soldToday: number;
}

interface WindowStats {
  hours: number;
  sales: number;
  knocks: number;
  salesPerHour: number | null;
}

interface BlitzStats extends WindowStats {
  blitzId: string;
  blitzName: string;
  marketName: string;
  carrierName: string;
}

interface Scorecard {
  today: WindowStats;
  week: WindowStats;
  blitzes: BlitzStats[];
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function formatRate(r: number | null): string {
  if (r == null) return "—";
  return r.toFixed(2);
}

export default function RepHomePage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<LeadsSummary | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [earnings, setEarnings] = useState<{ today: number; thisWeek: number; pending: number } | null>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rep/scorecard");
        if (res.ok) setScorecard(await res.json());
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commissions/preview");
        if (res.ok) setEarnings(await res.json());
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

      {/* Hours + sales-per-hour. Today/week aggregate from gps_sessions;
          per-blitz cards listed below if the rep is on an active blitz. */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Timer className="size-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">Hours & sales</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <HoursCell
            label="Today"
            hours={scorecard?.today.hours}
            sales={scorecard?.today.sales}
            rate={scorecard?.today.salesPerHour ?? null}
          />
          <HoursCell
            label="This week"
            hours={scorecard?.week.hours}
            sales={scorecard?.week.sales}
            rate={scorecard?.week.salesPerHour ?? null}
          />
        </div>
        {scorecard && scorecard.blitzes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Active blitz{scorecard.blitzes.length === 1 ? "" : "es"}
            </p>
            {scorecard.blitzes.map((b) => (
              <div
                key={b.blitzId}
                className="border rounded-md p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{b.blitzName}</p>
                  <p className="text-xs text-gray-500">
                    {b.carrierName} · {b.sales} sale{b.sales === 1 ? "" : "s"} · {b.knocks} knock{b.knocks === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatHours(b.hours)}</p>
                  <p className="text-xs text-gray-500">{formatRate(b.salesPerHour)} / hr</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/rep/gps/history"
          className="block text-center text-xs text-blue-600 hover:underline pt-1"
        >
          See full session history →
        </Link>
      </div>

      {/* Earnings snapshot — links to the full My Pay screen. */}
      <Link href="/rep/pay" className="block bg-white rounded-lg border p-4 active:bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wallet className="size-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700">Earnings</h2>
          </div>
          <ChevronRight className="size-4 text-gray-400" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-bold text-amber-700">
              {earnings == null ? "—" : `$${Math.round(earnings.pending)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">This week</p>
            <p className="text-lg font-bold text-gray-900">
              {earnings == null ? "—" : `$${Math.round(earnings.thisWeek)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Today</p>
            <p className="text-lg font-bold text-gray-900">
              {earnings == null ? "—" : `$${Math.round(earnings.today)}`}
            </p>
          </div>
        </div>
      </Link>

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

function HoursCell({
  label,
  hours,
  sales,
  rate,
}: {
  label: string;
  hours: number | undefined;
  sales: number | undefined;
  rate: number | null;
}) {
  return (
    <div className="bg-gray-50 rounded-md p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">
        {hours == null ? "—" : formatHours(hours)}
      </p>
      <p className="text-xs text-gray-600">
        {sales ?? "—"} sale{sales === 1 ? "" : "s"} · {formatRate(rate)} / hr
      </p>
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
