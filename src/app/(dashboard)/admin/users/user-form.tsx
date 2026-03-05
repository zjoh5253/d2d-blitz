"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Unified schema that covers both create and edit - password optional for edits
const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  role: z.enum([
    "ADMIN",
    "EXECUTIVE",
    "RECRUITER",
    "MARKET_OWNER",
    "FIELD_MANAGER",
    "FIELD_REP",
    "CALL_CENTER",
  ]),
  password: z.string().optional(),
  status: z.string().default("ACTIVE"),
});

type UserFormValues = z.infer<typeof userFormSchema>;

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
}

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserRow | null;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "EXECUTIVE", label: "Executive" },
  { value: "RECRUITER", label: "Recruiter" },
  { value: "MARKET_OWNER", label: "Market Owner" },
  { value: "FIELD_MANAGER", label: "Field Manager" },
  { value: "FIELD_REP", label: "Field Rep" },
  { value: "CALL_CENTER", label: "Call Center" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export function UserForm({ open, onOpenChange, user }: UserFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<UserFormValues, any, UserFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(userFormSchema) as any,
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "FIELD_REP",
      password: "",
      status: user?.status ?? "ACTIVE",
    },
  });

  async function onSubmit(data: UserFormValues) {
    // Validate password on create
    if (!isEdit && (!data.password || data.password.length < 8)) {
      return;
    }

    setServerError(null);
    try {
      const url = isEdit ? `/api/users/${user!.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      // For edits, don't send password field
      const payload = isEdit
        ? { name: data.name, email: data.email, phone: data.phone, role: data.role, status: data.status }
        : data;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      reset();
      onOpenChange(false);
      router.refresh();
    } catch {
      setServerError("Network error. Please try again.");
    }
  }

  function handleClose() {
    reset();
    setServerError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Jane Smith" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 000-0000"
              {...register("phone")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select id="role" options={ROLE_OPTIONS} {...register("role")} />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              options={STATUS_OPTIONS}
              {...register("status")}
            />
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
