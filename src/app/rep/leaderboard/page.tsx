"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Trophy, TrendingUp, Star, ArrowUp, ArrowDown, Minus, Flame } from "lucide-react";

interface Row {
  repId: string;
  repName: string;
  sales: number;
  verifiedInstalls: number;
  installRate: number;
  knocks: number;
  hours: number;
  salesPerHour: number | null;
  points: number;
  streak: number;
  tier: string | null;
  rank: number;
  prevRank: number | null;
  delta: number | null;
}

interface Options {
  blitzes: { id: string; name: string; marketId: string | null }[];
  markets: { id: string; name: string }[];
}

type Period = "today" | "yesterday" | "week" | "month" | "all" | "custom";
type Metric = "sales" | "installs" | "knocks" | "sph" | "points";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today", yesterday: "Yesterday", week: "This week", month: "This month", all: "All time", custom: "Custom range",
};
const PERIOD_ORDER: Period[] = ["today", "yesterday", "week", "month", "all", "custom"];

// One config drives both the ranking (server gets `metric`) and what's shown —
// so the board is always ranked by the number it displays.
const METRIC: Record<Metric, { label: string; unit: string; value: (r: Row) => number | null; fmt: (r: Row) => string }> = {
  points:   { label: "Points",     unit: "pts",      value: (r) => r.points,       fmt: (r) => r.points.toLocaleString() },
  sales:    { label: "Sales",      unit: "sales",    value: (r) => r.sales,        fmt: (r) => `${r.sales}` },
  installs: { label: "Installs",   unit: "installs", value: (r) => r.verifiedInstalls, fmt: (r) => `${r.verifiedInstalls}` },
  knocks:   { label: "Knocks",     unit: "knocks",   value: (r) => r.knocks,       fmt: (r) => `${r.knocks}` },
  sph:      { label: "Sales / hr", unit: "per hour", value: (r) => r.salesPerHour, fmt: (r) => (r.salesPerHour == null ? "—" : r.salesPerHour.toFixed(2)) },
};
const METRIC_ORDER: Metric[] = ["points", "sales", "installs", "knocks", "sph"];

// Milestone chips — derived purely from the row, shown next to the name.
// First two matches render to keep the row uncluttered on mobile.
function achievements(r: Row): { icon: string; label: string }[] {
  const out: { icon: string; label: string }[] = [];
  if (r.streak >= 5) out.push({ icon: "🔥", label: `${r.streak}-day streak` });
  if (r.verifiedInstalls >= 10) out.push({ icon: "💯", label: "10+ installs" });
  if (r.sales >= 10) out.push({ icon: "🤝", label: "10+ sales" });
  if (r.knocks >= 100) out.push({ icon: "🚪", label: "100+ knocks" });
  if (r.sales >= 4 && r.installRate >= 0.5) out.push({ icon: "🎯", label: "50%+ close rate" });
  return out.slice(0, 2);
}

// Rank movement vs the previous period: ▲n climbed, ▼n dropped, – unchanged,
// NEW if the rep wasn't ranked last period.
function Movement({ delta }: { delta: number | null }) {
  if (delta == null)
    return <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600">NEW</span>;
  if (delta === 0) return <Minus className="size-3 text-gray-300" />;
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(delta)}
    </span>
  );
}

const MEDAL = ["bg-yellow-400", "bg-gray-300", "bg-orange-400"]; // 1st, 2nd, 3rd

export default function RepLeaderboardPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("sales");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [marketId, setMarketId] = useState("");
  const [blitzId, setBlitzId] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Options>({ blitzes: [], markets: [] });
  const [loading, setLoading] = useState(true);

  const blitzOptions = useMemo(
    () => options.blitzes.filter((b) => !marketId || b.marketId === marketId),
    [options.blitzes, marketId]
  );
  useEffect(() => {
    if (blitzId && !blitzOptions.some((b) => b.id === blitzId)) setBlitzId("");
  }, [blitzId, blitzOptions]);

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) { setRows([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period === "custom") { params.set("from", customFrom); params.set("to", customTo); }
        else params.set("period", period);
        params.set("metric", metric);
        if (marketId) params.set("marketId", marketId);
        if (blitzId) params.set("blitzId", blitzId);
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
          if (data.options) setOptions(data.options);
        }
      } finally { setLoading(false); }
    })();
  }, [period, metric, customFrom, customTo, marketId, blitzId]);

  const myRow = myId ? rows.find((r) => r.repId === myId) : null;
  const mCfg = METRIC[metric];
  const subtitle = period === "custom" && customFrom && customTo ? `${customFrom} → ${customTo}` : PERIOD_LABELS[period];

  // Top-3 podium (only with a full podium's worth of reps); the rest fall to the
  // list below it. Display order is 2nd · 1st · 3rd so #1 sits center/tallest.
  const showPodium = !loading && rows.length >= 3;
  const podium = showPodium ? [rows[1], rows[0], rows[2]] : [];
  const listRows = showPodium ? rows.slice(3) : rows;

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-lg font-bold">Leaderboard</h1>
        <p className="text-xs text-gray-500">Ranked by {mCfg.label.toLowerCase()} · {subtitle}</p>
      </header>

      {/* Metric selector — drives both ranking and the headline number */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {METRIC_ORDER.map((m) => {
          const active = metric === m;
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {METRIC[m].label}
            </button>
          );
        })}
      </div>

      {/* Date presets */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {PERIOD_ORDER.map((p) => {
          const active = period === p;
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          );
        })}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5" aria-label="From date" />
          <span className="text-gray-400">→</span>
          <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5" aria-label="To date" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <select value={marketId} onChange={(e) => setMarketId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white" aria-label="Market filter">
          <option value="">All markets</option>
          {options.markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={blitzId} onChange={(e) => setBlitzId(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white" aria-label="Blitz (team) filter">
          <option value="">All blitzes</option>
          {blitzOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {myRow && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
              Your rank <Movement delta={myRow.delta} />
            </div>
            <div className="text-2xl font-bold text-blue-900 flex items-center gap-2">
              #{myRow.rank}
              {myRow.streak >= 2 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
                  <Flame className="size-3" />{myRow.streak}-day
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-700">{mCfg.label}</div>
            <div className="text-2xl font-bold text-blue-900">{mCfg.fmt(myRow)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Loading…</div>
      ) : period === "custom" && (!customFrom || !customTo) ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">Pick a start and end date.</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">
          No reps in this view yet. Try a wider period (e.g. All time) or clear the filters.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top-3 podium (2nd · 1st · 3rd) */}
          {showPodium && (
            <div className="grid grid-cols-3 gap-2 items-end">
              {podium.map((r) => {
                const isMe = r.repId === myId;
                const isFirst = r.rank === 1;
                return (
                  <div
                    key={r.repId}
                    className={`relative rounded-xl border p-3 text-center ${isFirst ? "bg-gradient-to-b from-yellow-50 to-white border-yellow-300 -mt-2 pt-4" : "bg-white border-gray-200"} ${isMe ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <div className={`mx-auto mb-1 flex items-center justify-center rounded-full text-white ${MEDAL[r.rank - 1]} ${isFirst ? "size-10" : "size-8"}`}>
                      <Trophy className={isFirst ? "size-5" : "size-4"} />
                    </div>
                    <div className="truncate text-xs font-semibold text-gray-900">{isMe ? "You" : r.repName}</div>
                    <div className={`font-bold text-gray-900 ${isFirst ? "text-xl" : "text-lg"}`}>{mCfg.fmt(r)}</div>
                    <div className="text-[9px] uppercase tracking-wide text-gray-400">{mCfg.unit}</div>
                    {r.streak >= 2 && (
                      <div className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">
                        <Flame className="size-2.5" />{r.streak}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Everyone else (or the whole board when too few reps for a podium) */}
          {listRows.length > 0 && (
            <div className="bg-white rounded-lg border divide-y">
              {listRows.map((r) => {
                const isMe = r.repId === myId;
                const top3 = r.rank <= 3;
                const badges = achievements(r);
                return (
                  <div key={r.repId} className={`flex items-center gap-3 p-3 ${isMe ? "bg-blue-50" : ""}`}>
                    <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center font-bold text-sm ${top3 ? `${MEDAL[r.rank - 1]} text-white` : "bg-gray-100 text-gray-700"}`}>
                      {top3 ? <Trophy className="size-4" /> : r.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate flex items-center gap-1.5 ${isMe ? "text-blue-900" : "text-gray-900"}`}>
                        <span className="truncate">{r.repName}</span>
                        {isMe && <span className="text-xs shrink-0">(you)</span>}
                        {r.tier && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Star className="size-2.5" />{r.tier}
                          </span>
                        )}
                        {badges.map((b) => (
                          <span key={b.label} title={b.label} className="shrink-0 text-xs">{b.icon}</span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5">
                        <span className="flex items-center gap-1"><TrendingUp className="size-3" /> {r.verifiedInstalls} inst · {(r.installRate * 100).toFixed(0)}% · {r.knocks} knocks</span>
                        {r.streak >= 2 && (
                          <span className="inline-flex items-center gap-0.5 text-orange-600 font-semibold"><Flame className="size-3" />{r.streak}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-gray-900 leading-none">{mCfg.fmt(r)}</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">{mCfg.unit}</div>
                      <div className="mt-0.5 flex justify-end"><Movement delta={r.delta} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
