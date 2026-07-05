"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";

export function RunPayrollButton() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create payroll run");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payroll run");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={handleRun} disabled={loading}>
        <Play className="h-4 w-4 mr-2" />
        {loading ? "Running..." : "Run payroll for my team"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Creates a draft payroll run for your downline; an admin approves it before funds are sent.
      </p>
    </div>
  );
}
