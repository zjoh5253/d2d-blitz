"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, Download } from "lucide-react";

interface RestoreHoldButtonProps {
  holdId: string;
  repName: string;
}

export function RestoreHoldButton({ holdId, repName }: RestoreHoldButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    const confirmed = confirm(`Restore compliance hold for ${repName}?`);
    if (!confirmed) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compliance-holds/${holdId}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error ?? "Failed to restore hold",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Hold restored", variant: "success" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRestore} disabled={loading}>
      <ShieldCheck className="mr-1 h-3 w-3" />
      Restore
    </Button>
  );
}

interface ExportHoldsButtonProps {
  period?: string;
  repId?: string;
  activeOnly?: boolean;
}

export function ExportHoldsButton({ period, repId, activeOnly }: ExportHoldsButtonProps) {
  function handleExport() {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (repId) params.set("repId", repId);
    if (activeOnly) params.set("activeOnly", "true");
    window.location.href = `/api/compliance-holds/export?${params.toString()}`;
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <Download className="mr-1 h-4 w-4" />
      Export CSV
    </Button>
  );
}
