"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, RefreshCw, XCircle } from "lucide-react";

interface ExceptionResolverProps {
  exceptionId: string;
  resolved: boolean;
  onActionComplete?: () => void;
}

type ResolveAction = "resolve" | "rematch" | "reject";

export function ExceptionResolver({
  exceptionId,
  resolved,
  onActionComplete,
}: ExceptionResolverProps) {
  const [open, setOpen] = React.useState(false);
  const [action, setAction] = React.useState<ResolveAction>("resolve");
  const [resolution, setResolution] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openDialog(a: ResolveAction) {
    setAction(a);
    setResolution("");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    if (!resolution.trim()) {
      setError("Please enter a resolution note.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/install-exceptions/${exceptionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to resolve exception");
      }
      setOpen(false);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  const actionConfig: Record<ResolveAction, { label: string; icon: React.ReactNode; variant: "default" | "destructive" | "outline" }> = {
    resolve: { label: "Resolve", icon: <CheckCircle className="h-3 w-3" />, variant: "default" },
    rematch: { label: "Re-match", icon: <RefreshCw className="h-3 w-3" />, variant: "outline" },
    reject: { label: "Reject", icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
  };

  if (resolved) {
    return (
      <span className="text-xs text-muted-foreground">Resolved</span>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        {(["resolve", "rematch", "reject"] as ResolveAction[]).map((a) => (
          <Button
            key={a}
            size="sm"
            variant={actionConfig[a].variant}
            onClick={() => openDialog(a)}
          >
            {actionConfig[a].icon}
            <span className="ml-1">{actionConfig[a].label}</span>
          </Button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "resolve" && "Resolve Exception"}
              {action === "rematch" && "Re-match Record"}
              {action === "reject" && "Reject Exception"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Resolution Note</Label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder={
                  action === "resolve"
                    ? "Describe how this exception was resolved..."
                    : action === "rematch"
                    ? "Explain why this record needs re-matching..."
                    : "Explain why this exception is being rejected..."
                }
                rows={4}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionConfig[action].variant}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving..." : actionConfig[action].label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
