"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { AgreementForm } from "./agreement-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface AgreementRow {
  id: string;
  type: "REP_AGREEMENT" | "GPS_CONSENT" | "TAX_W9" | "BACKGROUND_CHECK";
  title: string;
  body: string;
  version: number;
  required: boolean;
  blocking: boolean;
  requiresUpload: boolean;
  isActive: boolean;
}

interface AgreementsClientProps {
  agreements: AgreementRow[];
}

const TYPE_LABELS: Record<AgreementRow["type"], string> = {
  REP_AGREEMENT: "Rep Agreement",
  GPS_CONSENT: "GPS Consent",
  TAX_W9: "Tax W-9",
  BACKGROUND_CHECK: "Background Check",
};

export function AgreementsClient({ agreements }: AgreementsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<AgreementRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingAgreement(null);
    setDialogOpen(true);
  }

  function handleEdit(agreement: AgreementRow) {
    setEditingAgreement(agreement);
    setDialogOpen(true);
  }

  async function handleDelete(agreement: AgreementRow) {
    if (
      !confirm(
        `Delete agreement "${agreement.title}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(agreement.id);
    try {
      await fetch(`/api/agreements/${agreement.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return TYPE_LABELS[r.type] ?? r.type;
      },
    },
    {
      key: "title",
      label: "Title",
      sortable: true,
    },
    {
      key: "version",
      label: "Version",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return `v${r.version}`;
      },
    },
    {
      key: "required",
      label: "Required",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return (
          <Badge variant={r.required ? "default" : "secondary"}>
            {r.required ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      key: "blocking",
      label: "Blocking",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return (
          <Badge variant={r.blocking ? "default" : "secondary"}>
            {r.blocking ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      key: "requiresUpload",
      label: "Upload Required",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return (
          <Badge variant={r.requiresUpload ? "default" : "secondary"}>
            {r.requiresUpload ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      key: "isActive",
      label: "Status",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
        return (
          <Badge variant={r.isActive ? "default" : "secondary"}>
            {r.isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as AgreementRow;
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
          <h1 className="text-2xl font-semibold text-foreground">Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage onboarding agreements that reps must accept before using the app.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Agreement
        </Button>
      </div>

      <DataTable
        data={agreements as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["title", "type"]}
        pagination
        pageSize={20}
        emptyMessage="No agreements found. Add one to get started."
      />

      <AgreementForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agreement={editingAgreement}
      />
    </>
  );
}
