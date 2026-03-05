"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type LeadStatus =
  | "NEW"
  | "SCREENING"
  | "INTERVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ONBOARDED";

interface LeadActionsProps {
  leadId: string;
  currentStatus: LeadStatus;
  markets: Array<{ id: string; name: string }>;
  managers: Array<{ id: string; name: string | null }>;
}

const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["SCREENING", "REJECTED"],
  SCREENING: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ONBOARDED", "REJECTED"],
  REJECTED: [],
  ONBOARDED: [],
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ONBOARDED: "Onboarded",
};

const STATUS_VARIANTS: Record<
  LeadStatus,
  "default" | "outline" | "destructive"
> = {
  NEW: "outline",
  SCREENING: "outline",
  INTERVIEW: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  ONBOARDED: "default",
};

export function LeadActions({
  leadId,
  currentStatus,
  markets,
  managers,
}: LeadActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldManagerId, setFieldManagerId] = useState<string>("");
  const [marketId, setMarketId] = useState<string>("");

  const nextStatuses = TRANSITIONS[currentStatus];

  async function transition(status: LeadStatus) {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { status };
      if (status === "APPROVED" || status === "ONBOARDED") {
        if (fieldManagerId) body.fieldManagerId = fieldManagerId;
        if (marketId) body.marketId = marketId;
      }

      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update lead");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No further transitions available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Show assignment fields when approving */}
      {(currentStatus === "INTERVIEW" || currentStatus === "APPROVED") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Assign Field Manager</Label>
            <Select
              value={fieldManagerId}
              onChange={(e) => setFieldManagerId(e.target.value)}
              placeholder="Select manager..."
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.id}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assign Market</Label>
            <Select
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              placeholder="Select market..."
            >
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {nextStatuses.map((status) => (
          <Button
            key={status}
            variant={STATUS_VARIANTS[status]}
            size="sm"
            onClick={() => transition(status)}
            disabled={loading}
          >
            Move to {STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}
