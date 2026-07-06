"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { RateSheetForm } from "./rate-sheet-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface PrincipalOption {
  id: string;
  name: string | null;
  role: string;
}

interface CarrierOption {
  id: string;
  name: string;
}

interface RateSheetRow {
  id: string;
  level: "OWNER" | "MANAGER";
  principalId: string;
  carrierId: string | null;
  productId: string | null;
  availableRevenue: number;
  effectiveDate: Date | string;
  active: boolean;
  principal: { id: string; name: string | null; role: string };
  carrier: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
}

interface RateSheetsClientProps {
  sheets: RateSheetRow[];
  principals: PrincipalOption[];
  carriers: CarrierOption[];
}

export function RateSheetsClient({
  sheets,
  principals,
  carriers,
}: RateSheetsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<RateSheetRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingSheet(null);
    setDialogOpen(true);
  }

  function handleEdit(sheet: RateSheetRow) {
    setEditingSheet(sheet);
    setDialogOpen(true);
  }

  async function handleDelete(sheet: RateSheetRow) {
    if (
      !confirm(
        `Delete rate sheet for "${sheet.principal.name ?? sheet.principalId}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(sheet.id);
    try {
      await fetch(`/api/rate-sheets/${sheet.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "level",
      label: "Level",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as RateSheetRow;
        return r.level === "OWNER" ? (
          <Badge variant="default">Owner</Badge>
        ) : (
          <Badge variant="secondary">Manager</Badge>
        );
      },
    },
    {
      key: "principal",
      label: "Principal",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as RateSheetRow;
        return r.principal.name ?? r.principal.id;
      },
    },
    {
      key: "scope",
      label: "Scope",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as RateSheetRow;
        if (r.product) {
          return r.product.name;
        }
        if (r.carrier) {
          return `${r.carrier.name} (all products)`;
        }
        return <span className="text-muted-foreground italic">All</span>;
      },
    },
    {
      key: "availableRevenue",
      label: "Available Revenue",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as RateSheetRow;
        return `$${r.availableRevenue.toFixed(2)}`;
      },
    },
    {
      key: "effectiveDate",
      label: "Effective",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as RateSheetRow;
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
        const r = row as unknown as RateSheetRow;
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
        const r = row as unknown as RateSheetRow;
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
            Rate Sheets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grant each level its available revenue. Master grants the owner;
            owner grants the manager. Company floor / owner spread / manager
            override derive down the chain.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Rate Sheet
        </Button>
      </div>

      <DataTable
        data={sheets as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["principal.name"]}
        pagination
        pageSize={20}
        emptyMessage="No rate sheets found. Add one to get started."
      />

      <RateSheetForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sheet={editingSheet}
        principals={principals}
        carriers={carriers}
      />
    </>
  );
}
