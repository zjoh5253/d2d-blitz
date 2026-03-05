import type React from "react";

// Re-export Prisma types
export type { Role } from "@prisma/client";

// Navigation item for sidebar/nav components
export type NavItem = {
  title: string;
  href: string;
  icon: string;
  roles: import("@prisma/client").Role[];
};

// Generic table column definition
export type Column<T> = {
  key: keyof T;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
};
