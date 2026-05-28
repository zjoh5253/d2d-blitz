"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type VisitOutcome = "NOT_HOME" | "NOT_INTERESTED" | "CALLBACK" | "SALE";

interface Visit {
  id: string;
  address: string;
  outcome: VisitOutcome;
  notes: string | null;
  createdAt: string;
}

const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  NOT_HOME: "Not Home",
  NOT_INTERESTED: "Not Interested",
  CALLBACK: "Callback",
  SALE: "Sale",
};

const OUTCOME_VARIANTS: Record<VisitOutcome, "secondary" | "destructive" | "outline" | "default"> = {
  NOT_HOME: "secondary",
  NOT_INTERESTED: "destructive",
  CALLBACK: "outline",
  SALE: "default",
};

export default function MyVisitsPage() {
  const [visits, setVisits] = React.useState<Visit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dateFilter, setDateFilter] = React.useState("");

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const url = dateFilter ? `/api/visits?date=${dateFilter}` : "/api/visits";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setVisits(data);
      }
      setLoading(false);
    }
    load();
  }, [dateFilter]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Visits</h1>
          <p className="text-xs text-muted-foreground">Your door knock history</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/visits/new">
            <Plus className="w-4 h-4 mr-1" />
            Log Visit
          </Link>
        </Button>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>
            Clear
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <MapPin className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">No visits logged yet.</p>
            <Button asChild size="sm">
              <Link href="/dashboard/visits/new">Log your first visit</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visits.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.address}</p>
                    {v.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{v.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(v.createdAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <Badge variant={OUTCOME_VARIANTS[v.outcome]} className="shrink-0 text-xs">
                    {OUTCOME_LABELS[v.outcome]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
