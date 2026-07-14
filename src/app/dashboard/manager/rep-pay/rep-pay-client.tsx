"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { RepPayForm } from "./rep-pay-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface RepOption {
  id: string;
  name: string | null;
}

interface CarrierOption {
  id: string;
  name: string;
}

interface OverrideRow {
  id: string;
  repId: string;
  carrierId: string | null;
  productId: string | null;
  amount: number;
  effectiveDate: Date | string;
  active: boolean;
  rep: { id: string; name: string | null };
  carrier: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
}

interface RepPayClientProps {
  overrides: OverrideRow[];
  reps: RepOption[];
  carriers: CarrierOption[];
}

export function RepPayClient({
  overrides,
  reps,
  carriers,
}: RepPayClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<OverrideRow | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingOverride(null);
    setDialogOpen(true);
  }

  function handleEdit(override: OverrideRow) {
    setEditingOverride(override);
    setDialogOpen(true);
  }

  async function handleDelete(override: OverrideRow) {
    if (
      !confirm(
        `Delete rep pay for "${override.rep.name ?? override.repId}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(override.id);
    try {
      await fetch(`/api/rep-commissions/${override.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "rep",
      label: "Rep",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
        return r.rep.name ?? r.rep.id;
      },
    },
    {
      key: "scope",
      label: "Scope",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
        if (r.product) {
          return r.product.name;
        }
        if (r.carrier) {
          return `${r.carrier.name} (all products)`;
        }
        return (
          <span className="text-muted-foreground italic">All sales</span>
        );
      },
    },
    {
      key: "amount",
      label: "Amount",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
        return `$${r.amount.toFixed(2)}`;
      },
    },
    {
      key: "effectiveDate",
      label: "Effective",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
        try {
          return format(new Date(r.effectiveDate), "MMM d, yyyy");
        } catch {
          return String(r.effectiveDate);
        }
      },
    },
    {
      key: "active",
      label: "Active",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
        return r.active ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <span className="text-muted-foreground">Inactive</span>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as OverrideRow;
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
          <h1 className="text-2xl font-semibold text-foreground">Rep Pay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set the flat commission you pay each of your reps per install.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Rep Pay
        </Button>
      </div>

      <DataTable
        data={overrides as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["rep.name"]}
        pagination
        pageSize={20}
        emptyMessage="No rep pay found. Add one to get started."
      />

      <RepPayForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        override={editingOverride}
        reps={reps}
        carriers={carriers}
      />
    </>
  );
}
