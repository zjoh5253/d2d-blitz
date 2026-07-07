"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface RepOption {
  id: string;
  name: string | null;
  email: string;
  activeBlitzName: string | null;
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
  repId: string;
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

export function ScorecardsClient({ reps }: { reps: RepOption[] }) {
  const [repId, setRepId] = useState<string>(reps[0]?.id ?? "");
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repId) return;
    setLoading(true);
    setError(null);
    setCard(null);
    fetch(`/api/rep/scorecard?repId=${encodeURIComponent(repId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setCard(await res.json());
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [repId]);

  const selected = reps.find((r) => r.id === repId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Rep:</label>
        <select
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm bg-white"
        >
          {reps.length === 0 && <option value="">No field reps</option>}
          {reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name ?? r.email}
              {r.activeBlitzName ? ` — ${r.activeBlitzName}` : ""}
            </option>
          ))}
        </select>
        {selected && (
          <span className="text-xs text-muted-foreground">{selected.email}</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-muted-foreground">Loading scorecard…</div>
      )}

      {card && !loading && (
        <div className="bg-white rounded-lg border p-4 space-y-3 max-w-2xl">
          <div className="flex items-center gap-1.5">
            <Timer className="size-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700">Hours & sales</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <HoursCell
              label="Today"
              hours={card.today.hours}
              sales={card.today.sales}
              rate={card.today.salesPerHour}
            />
            <HoursCell
              label="This week"
              hours={card.week.hours}
              sales={card.week.sales}
              rate={card.week.salesPerHour}
            />
          </div>
          {card.blitzes.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Active blitz{card.blitzes.length === 1 ? "" : "es"}
              </p>
              {card.blitzes.map((b) => (
                <div
                  key={b.blitzId}
                  className="border rounded-md p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{b.blitzName}</p>
                    <p className="text-xs text-gray-500">
                      {b.carrierName} · {b.sales} sale{b.sales === 1 ? "" : "s"} ·{" "}
                      {b.knocks} knock{b.knocks === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      {formatHours(b.hours)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRate(b.salesPerHour)} / hr
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground pt-1">
              No active blitz assignments.
            </p>
          )}
        </div>
      )}
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
  hours: number;
  sales: number;
  rate: number | null;
}) {
  return (
    <div className="bg-gray-50 rounded-md p-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{formatHours(hours)}</p>
      <p className="text-xs text-gray-600">
        {sales} sale{sales === 1 ? "" : "s"} · {formatRate(rate)} / hr
      </p>
    </div>
  );
}
