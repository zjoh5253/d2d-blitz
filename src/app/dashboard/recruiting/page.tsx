"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const PIPELINE_COLUMNS: Array<{
  status: LeadStatus;
  label: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  headerAccent: string;
}> = [
  {
    status: "NEW",
    label: "New",
    borderColor: "border-l-blue-500",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    headerAccent: "bg-blue-500",
  },
  {
    status: "SCREENING",
    label: "Screening",
    borderColor: "border-l-amber-500",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    headerAccent: "bg-amber-500",
  },
  {
    status: "INTERVIEW",
    label: "Interview",
    borderColor: "border-l-violet-500",
    badgeBg: "bg-violet-100",
    badgeText: "text-violet-700",
    headerAccent: "bg-violet-500",
  },
  {
    status: "APPROVED",
    label: "Approved",
    borderColor: "border-l-emerald-500",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    headerAccent: "bg-emerald-500",
  },
  {
    status: "ONBOARDED",
    label: "Onboarded",
    borderColor: "border-l-teal-500",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
    headerAccent: "bg-teal-500",
  },
];

const SOURCE_LABELS: Record<LeadSource, string> = {
  COLD: "Cold",
  SOCIAL: "Social",
  REFERRAL: "Referral",
  PAID: "Paid",
};

const SOURCE_COLORS: Record<LeadSource, string> = {
  COLD: "bg-slate-100 text-slate-600",
  SOCIAL: "bg-blue-100 text-blue-700",
  REFERRAL: "bg-emerald-100 text-emerald-700",
  PAID: "bg-purple-100 text-purple-700",
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-heading text-foreground">
            Recruiting
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pipeline overview &mdash; drag candidates through stages
          </p>
        </div>
        <div className="flex gap-2 items-center">
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
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Loading leads...
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map(({ status, label, borderColor, badgeBg, badgeText, headerAccent }, colIdx) => {
            const columnLeads = getColumnLeads(status);
            return (
              <div
                key={status}
                className="flex-shrink-0 w-[272px] animate-fade-in"
                style={{ animationDelay: `${colIdx * 60}ms` }}
              >
                {/* Column header */}
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", headerAccent)} />
                    <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-semibold px-1.5",
                      badgeBg,
                      badgeText
                    )}
                  >
                    {columnLeads.length}
                  </span>
                </div>

                {/* Cards container */}
                <div className="space-y-2 min-h-[8rem]">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => router.push(`/dashboard/recruiting/leads/${lead.id}`)}
                      className={cn(
                        "bg-card border border-border border-l-4 rounded-xl shadow-sm cursor-pointer",
                        "hover:shadow-md hover:-translate-y-0.5",
                        "transition-all duration-200",
                        "p-3.5",
                        borderColor
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Avatar */}
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary">
                          {getInitials(lead.name)}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Name */}
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">
                            {lead.name}
                          </p>

                          {/* Source badge */}
                          <span
                            className={cn(
                              "inline-block text-[10px] font-semibold rounded-full px-2 py-0.5 mt-1.5",
                              SOURCE_COLORS[lead.source]
                            )}
                          >
                            {SOURCE_LABELS[lead.source]}
                          </span>

                          {/* Date */}
                          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/50 inline-block" />
                            {new Date(lead.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {columnLeads.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                      <User className="h-4 w-4 mx-auto mb-1.5 text-muted-foreground/40" />
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
        <details className="mt-2 animate-fade-in">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground font-medium select-none">
            Rejected ({rejected.length})
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {rejected.map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/recruiting/leads/${lead.id}`}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted transition-colors"
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
