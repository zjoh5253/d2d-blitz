"use client";

import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { RestoreHoldButton } from "./holds-actions";

export interface HoldRow {
  id: string;
  repName: string;
  repEmail: string;
  holdDate: string;
  reason: string;
  status: "Active" | "Restored";
  restoredDate: string | null;
  restoredBy: string | null;
}

const columns = [
  { key: "repName", label: "Rep", sortable: true },
  { key: "repEmail", label: "Email" },
  {
    key: "holdDate",
    label: "Hold Date",
    sortable: true,
    render: (val: unknown) => val as string,
  },
  {
    key: "reason",
    label: "Reason",
    render: (val: unknown) => (
      <span className="text-sm text-muted-foreground truncate max-w-xs block">
        {val as string}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (val: unknown) =>
      val === "Active" ? (
        <Badge variant="destructive">Active</Badge>
      ) : (
        <Badge variant="outline" className="text-emerald-600 border-emerald-600">
          Restored
        </Badge>
      ),
  },
  {
    key: "restoredDate",
    label: "Restored Date",
    render: (val: unknown) => (val as string | null) ?? "—",
  },
  {
    key: "restoredBy",
    label: "Restored By",
    render: (val: unknown) => (val as string | null) ?? "—",
  },
  {
    key: "id",
    label: "Actions",
    render: (val: unknown, row: Record<string, unknown>) => {
      if (row.status !== "Active") return null;
      return (
        <RestoreHoldButton
          holdId={val as string}
          repName={row.repName as string}
        />
      );
    },
  },
];

export function HoldsTable({ data }: { data: HoldRow[] }) {
  return (
    <DataTable
      data={data as unknown as Record<string, unknown>[]}
      columns={columns}
      searchable
      searchKeys={["repName", "repEmail", "reason", "status"]}
      pagination
      pageSize={20}
      emptyMessage="No compliance holds found."
    />
  );
}
