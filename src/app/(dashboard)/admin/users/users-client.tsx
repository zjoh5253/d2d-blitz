"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/tables/data-table";
import { UserForm } from "./user-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

type UserRole =
  | "ADMIN"
  | "EXECUTIVE"
  | "RECRUITER"
  | "MARKET_OWNER"
  | "FIELD_MANAGER"
  | "FIELD_REP"
  | "CALL_CENTER";

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  status: string;
  createdAt: Date | string;
  governanceTier: { id: string; name: string } | null;
}

interface UsersClientProps {
  users: UserRow[];
}

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "RECRUITER", label: "Recruiter" },
  { value: "MARKET_OWNER", label: "Market Owner" },
  { value: "FIELD_MANAGER", label: "Field Manager" },
  { value: "FIELD_REP", label: "Field Rep" },
  { value: "CALL_CENTER", label: "Call Center" },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  RECRUITER: "Recruiter",
  MARKET_OWNER: "Market Owner",
  FIELD_MANAGER: "Field Manager",
  FIELD_REP: "Field Rep",
  CALL_CENTER: "Call Center",
};

export function UsersClient({ users }: UsersClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");

  const filteredUsers = roleFilter
    ? users.filter((u) => u.role === roleFilter)
    : users;

  function handleAdd() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function handleEdit(user: UserRow) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  async function handleDelete(user: UserRow) {
    if (
      !confirm(
        `Deactivate user "${user.name ?? user.email}"? This sets their status to Inactive.`
      )
    ) {
      return;
    }

    setDeletingId(user.id);
    try {
      await fetch(`/api/users/${user.id}`, { method: "DELETE" });
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
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
        return r.name ?? <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
    },
    {
      key: "role",
      label: "Role",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
        return (
          <Badge variant="outline">{ROLE_LABEL[r.role] ?? r.role}</Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
        return (
          <Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>
            {r.status}
          </Badge>
        );
      },
    },
    {
      key: "governanceTier",
      label: "Governance Tier",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
        return r.governanceTier ? (
          <span>{r.governanceTier.name}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
        return new Date(r.createdAt).toLocaleDateString();
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as UserRow;
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
              <span className="sr-only">Deactivate</span>
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
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage platform users, roles, and access.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add User
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by role:</span>
        <div className="w-48">
          <Select
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <DataTable
        data={filteredUsers as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["name", "email", "role"]}
        pagination
        pageSize={20}
        emptyMessage="No users found."
      />

      <UserForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
      />
    </>
  );
}
