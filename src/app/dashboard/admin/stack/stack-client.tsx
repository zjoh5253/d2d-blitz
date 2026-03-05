"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { StackForm } from "./stack-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface CarrierOption {
  id: string;
  name: string;
}

interface MarketOption {
  id: string;
  name: string;
}

interface StackConfigRow {
  id: string;
  carrierId: string;
  marketId: string | null;
  companyFloorPercent: number;
  managerOverridePercent: number;
  marketOwnerSpreadPercent: number;
  effectiveDate: Date | string;
  carrier: { id: string; name: string };
  market: { id: string; name: string } | null;
}

interface StackClientProps {
  configs: StackConfigRow[];
  carriers: CarrierOption[];
  markets: MarketOption[];
}

export function StackClient({ configs, carriers, markets }: StackClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StackConfigRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingConfig(null);
    setDialogOpen(true);
  }

  function handleEdit(config: StackConfigRow) {
    setEditingConfig(config);
    setDialogOpen(true);
  }

  async function handleDelete(config: StackConfigRow) {
    if (
      !confirm(
        `Delete stack config for "${config.carrier.name}"${config.market ? ` / ${config.market.name}` : ""}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(config.id);
    try {
      await fetch(`/api/stack-configs/${config.id}`, { method: "DELETE" });
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
        const r = row as unknown as StackConfigRow;
        return r.carrier.name;
      },
    },
    {
      key: "market",
      label: "Market",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
        return r.market ? (
          <span>{r.market.name}</span>
        ) : (
          <span className="text-muted-foreground italic">All markets</span>
        );
      },
    },
    {
      key: "companyFloorPercent",
      label: "Company Floor %",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
        return `${r.companyFloorPercent.toFixed(2)}%`;
      },
    },
    {
      key: "managerOverridePercent",
      label: "Manager Override %",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
        return `${r.managerOverridePercent.toFixed(2)}%`;
      },
    },
    {
      key: "marketOwnerSpreadPercent",
      label: "Market Owner %",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
        return `${r.marketOwnerSpreadPercent.toFixed(2)}%`;
      },
    },
    {
      key: "effectiveDate",
      label: "Effective Date",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
        return format(new Date(r.effectiveDate), "MMM d, yyyy");
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as StackConfigRow;
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
            Stack Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure revenue split percentages by carrier and market.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Config
        </Button>
      </div>

      <DataTable
        data={configs as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["carrier.name", "market.name"]}
        pagination
        pageSize={20}
        emptyMessage="No stack configurations found. Add one to get started."
      />

      <StackForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={editingConfig}
        carriers={carriers}
        markets={markets}
      />
    </>
  );
}
