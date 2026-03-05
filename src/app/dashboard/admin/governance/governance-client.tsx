"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { TierForm } from "./tier-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface GovernanceTierRow {
  id: string;
  name: string;
  rank: number;
  minInstallRate: number;
  commissionMultiplier: number;
  isDefault: boolean;
  createdAt: Date | string;
}

interface GovernanceClientProps {
  tiers: GovernanceTierRow[];
}

export function GovernanceClient({ tiers }: GovernanceClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<GovernanceTierRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleAdd() {
    setEditingTier(null);
    setDialogOpen(true);
  }

  function handleEdit(tier: GovernanceTierRow) {
    setEditingTier(tier);
    setDialogOpen(true);
  }

  async function handleDelete(tier: GovernanceTierRow) {
    if (
      !confirm(
        `Delete tier "${tier.name}"? This cannot be undone and will fail if users are assigned.`
      )
    ) {
      return;
    }

    setDeletingId(tier.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/governance-tiers/${tier.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? "Failed to delete tier.");
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
    },
    {
      key: "rank",
      label: "Rank",
      sortable: true,
    },
    {
      key: "minInstallRate",
      label: "Min Install Rate",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as GovernanceTierRow;
        return `${(r.minInstallRate * 100).toFixed(0)}%`;
      },
    },
    {
      key: "commissionMultiplier",
      label: "Commission Multiplier",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as GovernanceTierRow;
        return `${r.commissionMultiplier.toFixed(2)}x`;
      },
    },
    {
      key: "isDefault",
      label: "Default",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as GovernanceTierRow;
        return r.isDefault ? (
          <Badge variant="default">Default</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as GovernanceTierRow;
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
            Governance Tiers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define install rate thresholds and commission multipliers by tier.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Tier
        </Button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-sm text-destructive">{deleteError}</p>
        </div>
      )}

      <DataTable
        data={tiers as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["name"]}
        emptyMessage="No governance tiers configured. Add one to get started."
      />

      <TierForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tier={editingTier}
      />
    </>
  );
}
