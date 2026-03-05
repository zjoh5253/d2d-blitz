"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Period = "week" | "month" | "season" | "lifetime";

interface LeaderboardRow {
  rank: number;
  repId: string;
  repName: string;
  verifiedInstalls: number;
  sales: number;
  installRate: number;
  tier: string | null;
}

interface Market {
  id: string;
  name: string;
}

interface Blitz {
  id: string;
  name: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "This Week",
  month: "This Month",
  season: "This Season",
  lifetime: "Lifetime",
};

const RANK_STYLES = [
  "bg-amber-50 border-l-4 border-l-amber-400 dark:bg-amber-950/30",
  "bg-slate-50 border-l-4 border-l-slate-400 dark:bg-slate-900/30",
  "bg-orange-50 border-l-4 border-l-orange-300 dark:bg-orange-950/30",
];

const RANK_BADGES = ["gold", "silver", "bronze"] as const;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-bold text-sm">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-bold text-sm">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-300 text-orange-900 font-bold text-sm">
        3
      </span>
    );
  return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [marketId, setMarketId] = useState<string>("all");
  const [blitzId, setBlitzId] = useState<string>("all");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [loading, setLoading] = useState(false);

  // Load markets and blitzes for filters
  useEffect(() => {
    async function loadFilters() {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/blitzes"),
      ]);
      if (mRes.ok) setMarkets(await mRes.json());
      if (bRes.ok) setBlitzes(await bRes.json());
    }
    loadFilters().catch(console.error);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (marketId !== "all") params.set("marketId", marketId);
      if (blitzId !== "all") params.set("blitzId", blitzId);

      const res = await fetch(`/api/leaderboard?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows);
      }
    } finally {
      setLoading(false);
    }
  }, [period, marketId, blitzId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const tableData = rows.map((row) => ({
    ...row,
    installRateDisplay: `${(row.installRate * 100).toFixed(1)}%`,
    _rowStyle: row.rank <= 3 ? RANK_STYLES[row.rank - 1] : "",
  })) as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Top performers by verified installs
        </p>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors border",
              period === p
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          className="w-48"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        >
          <option value="all">All Markets</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>

        <Select
          className="w-48"
          value={blitzId}
          onChange={(e) => setBlitzId(e.target.value)}
        >
          <option value="all">All Blitzes</option>
          {blitzes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Rankings — {PERIOD_LABELS[period]}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-6">
          <DataTable
            data={tableData}
            loading={loading}
            columns={[
              {
                key: "rank",
                label: "Rank",
                sortable: true,
                render: (val) => <RankBadge rank={val as number} />,
              },
              {
                key: "repName",
                label: "Rep Name",
                sortable: true,
                render: (val, row) => {
                  const rank = (row as { rank: number }).rank;
                  return (
                    <span
                      className={cn(
                        "font-medium",
                        rank === 1 && "text-amber-600",
                        rank === 2 && "text-slate-600",
                        rank === 3 && "text-orange-600"
                      )}
                    >
                      {val as string}
                    </span>
                  );
                },
              },
              {
                key: "verifiedInstalls",
                label: "Verified Installs",
                sortable: true,
                render: (val, row) => {
                  const rank = (row as { rank: number }).rank;
                  return (
                    <span
                      className={cn(
                        "font-semibold",
                        rank === 1 && "text-amber-600"
                      )}
                    >
                      {val as number}
                    </span>
                  );
                },
              },
              { key: "sales", label: "Total Sales", sortable: true },
              {
                key: "installRateDisplay",
                label: "Install Rate",
                sortable: false,
              },
              {
                key: "tier",
                label: "Tier",
                render: (val) =>
                  val ? (
                    <Badge variant="outline">{val as string}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  ),
              },
            ]}
            pagination
            pageSize={25}
            emptyMessage="No qualifying reps found for this period."
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Only reps who are compliant (no active holds) and not governance-suspended
        (fewer than 2 consecutive strikes) appear on the leaderboard.
      </p>
    </div>
  );
}
