"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CheckCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface CreateBatchButtonProps {
  onCreated?: (id: string) => void;
}

export function CreateBatchButton({ onCreated }: CreateBatchButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [period, setPeriod] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    if (!period.trim()) {
      setError("Please enter a period (e.g. 2025-Q1 or 2025-03).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create batch");
      }
      const data = await res.json();
      setOpen(false);
      setPeriod("");
      if (onCreated) {
        onCreated(data.id);
      } else {
        router.push(`/compensation/payouts/${data.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Create New Batch
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Input
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. 2025-Q1 or 2025-03"
              />
              <p className="text-xs text-muted-foreground">
                All eligible commission records will be aggregated into this batch.
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface BatchStatusActionsProps {
  batchId: string;
  currentStatus: string;
}

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  DRAFT: { next: "REVIEWED", label: "Mark as Reviewed" },
  REVIEWED: { next: "APPROVED", label: "Approve Batch" },
  APPROVED: { next: "PAID", label: "Mark as Paid" },
};

export function BatchStatusActions({ batchId, currentStatus }: BatchStatusActionsProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  const transition = STATUS_TRANSITIONS[currentStatus];
  if (!transition) return null;

  async function handleTransition() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payouts/${batchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: transition.next }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update status");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  const Icon = currentStatus === "REVIEWED" ? CheckCircle : ArrowRight;

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleTransition} disabled={loading}>
        <Icon className="h-4 w-4 mr-2" />
        {loading ? "Updating..." : transition.label}
      </Button>
    </div>
  );
}
