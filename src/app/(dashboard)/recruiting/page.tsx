"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

type LeadStatus =
  | "NEW"
  | "SCREENING"
  | "INTERVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ONBOARDED";

type LeadSource = "COLD" | "SOCIAL" | "REFERRAL" | "PAID";

interface Lead {
  id: string;
  name: string;
  source: LeadSource;
  status: LeadStatus;
  createdAt: string;
  recruiter: { id: string; name: string | null } | null;
}

const PIPELINE_COLUMNS: Array<{ status: LeadStatus; label: string }> = [
  { status: "NEW", label: "New" },
  { status: "SCREENING", label: "Screening" },
  { status: "INTERVIEW", label: "Interview" },
  { status: "APPROVED", label: "Approved" },
  { status: "ONBOARDED", label: "Onboarded" },
];

const SOURCE_LABELS: Record<LeadSource, string> = {
  COLD: "Cold",
  SOCIAL: "Social",
  REFERRAL: "Referral",
  PAID: "Paid",
};

const SOURCE_COLORS: Record<LeadSource, string> = {
  COLD: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SOCIAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  REFERRAL:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  PAID: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export default function RecruitingPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    async function loadLeads() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (sourceFilter !== "all") params.set("source", sourceFilter);
        const res = await fetch(`/api/leads?${params}`);
        if (res.ok) setLeads(await res.json());
      } finally {
        setLoading(false);
      }
    }
    loadLeads();
  }, [sourceFilter]);

  const filtered = leads.filter((l) => l.status !== "REJECTED");
  const rejected = leads.filter((l) => l.status === "REJECTED");

  function getColumnLeads(status: LeadStatus) {
    return filtered.filter((l) => l.status === status);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recruiting</h1>
          <p className="text-sm text-muted-foreground">Pipeline overview</p>
        </div>
        <div className="flex gap-2">
          <Select
            className="w-40"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
          <Link href="/dashboard/recruiting/leads/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading leads...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map(({ status, label }) => {
            const columnLeads = getColumnLeads(status);
            return (
              <div key={status} className="flex-shrink-0 w-64">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {columnLeads.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-32">
                  {columnLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() =>
                        router.push(`/dashboard/recruiting/leads/${lead.id}`)
                      }
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="rounded bg-muted p-1 mt-0.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {lead.name}
                            </p>
                            <span
                              className={cn(
                                "inline-block text-xs rounded px-1.5 py-0.5 mt-1",
                                SOURCE_COLORS[lead.source]
                              )}
                            >
                              {SOURCE_LABELS[lead.source]}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejected (collapsed) */}
      {rejected.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Rejected ({rejected.length})
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {rejected.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/recruiting/leads/${lead.id}`}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                >
                  {lead.name}
                </Badge>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
