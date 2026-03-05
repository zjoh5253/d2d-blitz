"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, ChevronDown, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  RECRUITER: "Recruiter",
  MARKET_OWNER: "Market Owner",
  FIELD_MANAGER: "Field Manager",
  FIELD_REP: "Field Rep",
  CALL_CENTER: "Call Center",
};

interface TopbarProps {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const user = session?.user;
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "";

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background shrink-0">
      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right: user menu */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {/* Avatar */}
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>

          {/* Name + role */}
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-foreground line-clamp-1 max-w-[140px]">
              {user?.name ?? user?.email ?? "User"}
            </span>
            {roleLabel && (
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              dropdownOpen && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            {/* Click-away overlay */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 mt-1 w-56 z-20 bg-popover border border-border rounded-md shadow-md py-1">
              {/* User info header */}
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                {roleLabel && (
                  <span className="mt-1 inline-block text-xs font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                    {roleLabel}
                  </span>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
