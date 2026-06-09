"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Trophy, TrendingUp } from "lucide-react";

interface Row {
  repId: string;
  repName: string;
  verifiedInstalls: number;
  sales: number;
  installRate: number;
}

interface Options {
  blitzes: { id: string; name: string; marketId: string | null }[];
  markets: { id: string; name: string }[];
}

type Period = "today" | "yesterday" | "week" | "month" | "all" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  all: "All time",
  custom: "Custom range",
};

const PERIOD_ORDER: Period[] = ["today", "yesterday", "week", "month", "all", "custom"];

export default function RepLeaderboardPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [marketId, setMarketId] = useState("");
  const [blitzId, setBlitzId] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Options>({ blitzes: [], markets: [] });
  const [loading, setLoading] = useState(true);

  // Blitz dropdown narrows to the selected market.
  const blitzOptions = useMemo(
    () => options.blitzes.filter((b) => !marketId || b.marketId === marketId),
    [options.blitzes, marketId]
  );

  // If the selected blitz no longer matches the chosen market, clear it.
  useEffect(() => {
    if (blitzId && !blitzOptions.some((b) => b.id === blitzId)) setBlitzId("");
  }, [blitzId, blitzOptions]);

  useEffect(() => {
    // Custom needs both ends before we query.
    if (period === "custom" && (!customFrom || !customTo)) {
      setRows([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period === "custom") {
          params.set("from", customFrom);
          params.set("to", customTo);
        } else {
          params.set("period", period);
        }
        if (marketId) params.set("marketId", marketId);
        if (blitzId) params.set("blitzId", blitzId);
        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
          if (data.options) setOptions(data.options);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [period, customFrom, customTo, marketId, blitzId]);

  const myRank = myId ? rows.findIndex((r) => r.repId === myId) + 1 : 0;
  const myRow = myId ? rows.find((r) => r.repId === myId) : null;

  const subtitle =
    period === "custom" && customFrom && customTo
      ? `${customFrom} → ${customTo}`
      : PERIOD_LABELS[period];

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-lg font-bold">Leaderboard</h1>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </header>

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

      {/* Custom range inputs */}
      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5"
            aria-label="From date"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5"
            aria-label="To date"
          />
        </div>
      )}

      {/* Market + Blitz (Team) filters */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          aria-label="Market filter"
        >
          <option value="">All markets</option>
          {options.markets.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={blitzId}
          onChange={(e) => setBlitzId(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white"
          aria-label="Blitz (team) filter"
        >
          <option value="">All blitzes</option>
          {blitzOptions.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {myRow && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
          <div>
            <div className="text-xs text-blue-700 font-medium">Your rank</div>
            <div className="text-2xl font-bold text-blue-900">#{myRank}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-700">Sales</div>
            <div className="text-2xl font-bold text-blue-900">{myRow.sales}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-gray-500 py-8">Loading…</div>
      ) : period === "custom" && (!customFrom || !customTo) ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">Pick a start and end date.</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">No sales for this filter.</div>
      ) : (
        <div className="bg-white rounded-lg border divide-y">
          {rows.map((r, i) => {
            const isMe = r.repId === myId;
            return (
              <div key={r.repId} className={`flex items-center gap-3 p-3 ${isMe ? "bg-blue-50" : ""}`}>
                <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-gray-300 text-white" : i === 2 ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-700"}`}>
                  {i < 3 ? <Trophy className="size-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${isMe ? "text-blue-900" : "text-gray-900"}`}>
                    {r.repName} {isMe && <span className="text-xs">(you)</span>}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <TrendingUp className="size-3" /> {r.verifiedInstalls} installed · {(r.installRate * 100).toFixed(0)}% rate
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{r.sales}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">sales</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
