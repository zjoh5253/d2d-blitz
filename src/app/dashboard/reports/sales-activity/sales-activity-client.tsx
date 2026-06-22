"use client";

import * as React from "react";
import { Download, FileSpreadsheet, DoorClosed, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/charts/stat-card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface BlitzOption {
  id: string;
  name: string;
  market: string;
}
interface RepOption {
  id: string;
  name: string;
}

interface Row {
  kind: "data" | "subtotal" | "total";
  blitzArea: string;
  repName: string;
  loggedDoors: number;
  salesSubmitted: number;
  notInterested: number;
  goBacks: number;
  notHome: number;
  conversionRate: string;
}

interface Summary {
  generatedAt: string;
  startDate: string;
  endDate: string;
  groupBy: string;
  totalReps: number;
  totalBlitzes: number;
  salesPerRep: number;
  salesPerBlitz: number;
  totals: Row & { conversionRate: string };
}

interface ReportResponse {
  rows: Row[];
  summary: Summary;
}

const GROUP_OPTIONS = [
  { value: "blitz", label: "Export by Blitz Area" },
  { value: "rep", label: "Export by Rep" },
  { value: "team", label: "Export by Team" },
  { value: "dataset", label: "Export Entire Dataset" },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function SalesActivityClient({
  blitzes,
  reps,
}: {
  blitzes: BlitzOption[];
  reps: RepOption[];
}) {
  const [startDate, setStartDate] = React.useState(isoDaysAgo(29));
  const [endDate, setEndDate] = React.useState(isoDaysAgo(0));
  const [blitzId, setBlitzId] = React.useState("");
  const [repId, setRepId] = React.useState("");
  const [groupBy, setGroupBy] = React.useState("blitz");

  const [data, setData] = React.useState<ReportResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const buildQuery = React.useCallback(
    (extra?: Record<string, string>) => {
      const p = new URLSearchParams();
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      if (blitzId) p.set("blitzId", blitzId);
      if (repId) p.set("repId", repId);
      p.set("groupBy", groupBy);
      for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
      return p.toString();
    },
    [startDate, endDate, blitzId, repId, groupBy]
  );

  const loadPreview = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/sales-activity?${buildQuery({ format: "json" })}`
      );
      if (!res.ok) throw new Error("Failed to load report");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery]);

  // Load once on mount with the default (last 30 days) filters.
  React.useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadCsv = () => {
    const url = `/api/reports/sales-activity?${buildQuery({ format: "csv" })}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const totals = data?.summary.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="size-6 text-primary" />
            Sales &amp; Activity Report
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Field performance by blitz area, team, and rep. Filter, preview, then
            download a CSV for analysis.
          </p>
        </div>
        <Button onClick={downloadCsv} disabled={isLoading || !data}>
          <Download className="size-4" />
          Download CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="groupBy">Export option</Label>
              <Select
                id="groupBy"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                options={GROUP_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blitzId">Blitz area / Team</Label>
              <Select
                id="blitzId"
                value={blitzId}
                onChange={(e) => setBlitzId(e.target.value)}
              >
                <option value="">All blitzes</option>
                {blitzes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.market ? `${b.name} — ${b.market}` : b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repId">Rep</Label>
              <Select
                id="repId"
                value={repId}
                onChange={(e) => setRepId(e.target.value)}
              >
                <option value="">All reps</option>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={loadPreview}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Loading…" : "Apply filters"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={DoorClosed}
            label="Logged Doors"
            value={totals.loggedDoors.toLocaleString()}
          />
          <StatCard
            icon={TrendingUp}
            label="Sales Submitted"
            value={totals.salesSubmitted.toLocaleString()}
          />
          <StatCard
            icon={TrendingUp}
            label="Conversion Rate"
            value={totals.conversionRate}
          />
          <StatCard
            icon={FileSpreadsheet}
            label="Sales / Rep · / Blitz"
            value={`${data!.summary.salesPerRep} · ${data!.summary.salesPerBlitz}`}
          />
        </div>
      )}

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Preview{data ? ` (${data.rows.filter((r) => r.kind === "data").length} rows)` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {error ? (
            <div className="py-16 text-center text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading report…
            </div>
          ) : data && data.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blitz Area</TableHead>
                  <TableHead>Rep Name</TableHead>
                  <TableHead className="text-right">Logged Doors</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Not Interested</TableHead>
                  <TableHead className="text-right">Go-Backs</TableHead>
                  <TableHead className="text-right">Not Home</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r, i) => (
                  <TableRow
                    key={i}
                    className={cn(
                      r.kind === "subtotal" && "bg-secondary/40 font-medium",
                      r.kind === "total" &&
                        "bg-primary/5 font-semibold border-t-2 border-primary/30"
                    )}
                  >
                    <TableCell>{r.blitzArea}</TableCell>
                    <TableCell
                      className={cn(
                        r.kind === "subtotal" && "italic text-muted-foreground"
                      )}
                    >
                      {r.repName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.loggedDoors.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {r.salesSubmitted.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.notInterested.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.goBacks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.notHome.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.conversionRate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No activity found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
