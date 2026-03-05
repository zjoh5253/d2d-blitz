"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface ComplianceActionsProps {
  holdId?: string;
  repName?: string;
}

export function ComplianceActions({ holdId, repName }: ComplianceActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runComplianceCheck() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/check", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to run compliance check");
        return;
      }
      const data = await res.json();
      alert(
        `Compliance check complete.\nHolds created: ${data.holdsCreated}`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function restoreHold() {
    if (!holdId) return;
    const confirmed = confirm(
      `Restore hold for ${repName ?? "this rep"}?`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance-holds/${holdId}`, {
        method: "PUT",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to restore hold");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Inline restore button for table rows
  if (holdId) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={restoreHold}
        disabled={loading}
      >
        <ShieldCheck className="mr-1 h-3 w-3" />
        Restore
      </Button>
    );
  }

  // Top-level run check button
  return (
    <Button onClick={runComplianceCheck} disabled={loading} size="sm">
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Run Compliance Check
    </Button>
  );
}
