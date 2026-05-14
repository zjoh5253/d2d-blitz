"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Trophy, TrendingUp } from "lucide-react";

interface Row {
  repId: string;
  repName: string;
  verifiedInstalls: number;
  sales: number;
  installRate: number;
}

type Period = "week" | "month" | "quarter" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  all: "All time",
};

export default function RepLeaderboardPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [period, setPeriod] = useState<Period>("month");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leaderboard?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  const myRank = myId ? rows.findIndex((r) => r.repId === myId) + 1 : 0;
  const myRow = myId ? rows.find((r) => r.repId === myId) : null;

  return (
    <div className="p-4 space-y-4">
      <header>
        <h1 className="text-lg font-bold">Leaderboard</h1>
        <p className="text-xs text-gray-500">{PERIOD_LABELS[period]}</p>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["week", "month", "quarter", "all"] as const).map((p) => {
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
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-gray-500">No sales yet this period.</div>
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
