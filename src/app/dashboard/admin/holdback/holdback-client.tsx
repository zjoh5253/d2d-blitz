"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { HoldbackForm } from "./holdback-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface CarrierOption {
  id: string;
  name: string;
}

interface HoldbackPolicyRow {
  id: string;
  carrierId: string | null;
  holdbackPercent: number;
  holdbackDays: number;
  effectiveDate: Date | string;
  carrier: { id: string; name: string } | null;
}

interface HoldbackClientProps {
  policies: HoldbackPolicyRow[];
  carriers: CarrierOption[];
}

export function HoldbackClient({ policies, carriers }: HoldbackClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<HoldbackPolicyRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingPolicy(null);
    setDialogOpen(true);
  }

  function handleEdit(policy: HoldbackPolicyRow) {
    setEditingPolicy(policy);
    setDialogOpen(true);
  }

  async function handleDelete(policy: HoldbackPolicyRow) {
    if (
      !confirm(
        `Delete holdback policy for "${policy.carrier ? policy.carrier.name : "all carriers"}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(policy.id);
    try {
      await fetch(`/api/holdback-policies/${policy.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "carrier",
      label: "Carrier",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as HoldbackPolicyRow;
        return r.carrier ? (
          <span>{r.carrier.name}</span>
        ) : (
          <span className="text-muted-foreground italic">All carriers (default)</span>
        );
      },
    },
    {
      key: "holdbackPercent",
      label: "Holdback %",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as HoldbackPolicyRow;
        return `${r.holdbackPercent.toFixed(0)}%`;
      },
    },
    {
      key: "holdbackDays",
      label: "Hold Days",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as HoldbackPolicyRow;
        return `${r.holdbackDays} days`;
      },
    },
    {
      key: "effectiveDate",
      label: "Effective Date",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as HoldbackPolicyRow;
        return format(new Date(r.effectiveDate), "MMM d, yyyy");
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as HoldbackPolicyRow;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(r);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={deletingId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Holdback Policies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reserve a slice of rep commission against chargebacks; released as a
            retention bonus after the hold period.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Policy
        </Button>
      </div>

      <DataTable
        data={policies as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["carrier.name"]}
        pagination
        pageSize={20}
        emptyMessage="No holdback policies found. Add one to get started."
      />

      <HoldbackForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={editingPolicy}
        carriers={carriers}
      />
    </>
  );
}
