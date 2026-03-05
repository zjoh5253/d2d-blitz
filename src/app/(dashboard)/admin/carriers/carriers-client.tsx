"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { CarrierForm } from "./carrier-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface CarrierRow {
  id: string;
  name: string;
  revenuePerInstall: number;
  portalUrl: string | null;
  status: "ACTIVE" | "INACTIVE";
}

interface CarriersClientProps {
  carriers: CarrierRow[];
}

export function CarriersClient({ carriers }: CarriersClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<CarrierRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingCarrier(null);
    setDialogOpen(true);
  }

  function handleEdit(carrier: CarrierRow) {
    setEditingCarrier(carrier);
    setDialogOpen(true);
  }

  async function handleDelete(carrier: CarrierRow) {
    if (
      !confirm(
        `Deactivate carrier "${carrier.name}"? This sets the status to Inactive.`
      )
    ) {
      return;
    }

    setDeletingId(carrier.id);
    try {
      await fetch(`/api/carriers/${carrier.id}`, { method: "DELETE" });
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
      key: "revenuePerInstall",
      label: "Revenue / Install",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as CarrierRow;
        return `$${r.revenuePerInstall.toFixed(2)}`;
      },
    },
    {
      key: "portalUrl",
      label: "Portal URL",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as CarrierRow;
        return r.portalUrl ? (
          <a
            href={r.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:opacity-80 truncate max-w-[200px] block"
          >
            {r.portalUrl}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as CarrierRow;
        return (
          <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>
            {r.status}
          </Badge>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as CarrierRow;
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
          <h1 className="text-2xl font-semibold text-foreground">Carriers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage carrier configurations and revenue settings.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Carrier
        </Button>
      </div>

      <DataTable
        data={carriers as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["name", "status"]}
        pagination
        pageSize={20}
        emptyMessage="No carriers found. Add one to get started."
      />

      <CarrierForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        carrier={editingCarrier}
      />
    </>
  );
}
