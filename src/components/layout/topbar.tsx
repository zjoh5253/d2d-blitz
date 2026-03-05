"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, Bell, LogOut, ChevronDown } from "lucide-react";
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

const ROLE_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#F3E8FF", color: "#7E22CE" },
  EXECUTIVE: { bg: "#DBEAFE", color: "#1D4ED8" },
  RECRUITER: { bg: "#D1FAE5", color: "#065F46" },
  MARKET_OWNER: { bg: "#FEF3C7", color: "#92400E" },
  FIELD_MANAGER: { bg: "#CFFAFE", color: "#155E75" },
  FIELD_REP: { bg: "#DCFCE7", color: "#166534" },
  CALL_CENTER: { bg: "#FCE7F3", color: "#9D174D" },
};

/** Derive a friendly section name from the current pathname */
function getSectionLabel(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  // Strip "dashboard" prefix
  const relevant = segments[0] === "dashboard" ? segments.slice(1) : segments;
  if (relevant.length === 0) return "Dashboard";

  const segment = relevant[0];
  const labelMap: Record<string, string> = {
    admin: "Admin",
    reps: "Reps",
    markets: "Markets",
    blitzes: "Blitzes",
    installs: "Installs",
    compensation: "Compensation",
    governance: "Governance",
    compliance: "Compliance",
    leaderboard: "Leaderboard",
    inbound: "Inbound",
    reports: "Reports",
    manager: "Manager",
    recruiting: "Recruiting",
  };
  return labelMap[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

function getSubLabel(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const relevant = segments[0] === "dashboard" ? segments.slice(1) : segments;
  if (relevant.length < 2) return null;

  const sub = relevant[relevant.length - 1];
  const subMap: Record<string, string> = {
    users: "Users",
    carriers: "Carriers",
    "governance-config": "Governance Config",
    "stack-config": "Stack Config",
    dashboard: "Dashboard",
    "daily-report": "Daily Report",
    "go-backs": "Go-Backs",
    sales: "Sales",
    national: "National",
    margins: "Margins",
    governance: "Governance",
    "blitz-pnl": "Blitz P&L",
    "recruiting-roi": "Recruiting ROI",
    reps: "Reps",
    blitzes: "Blitzes",
  };
  return subMap[sub] ?? null;
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

interface TopbarProps {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = session?.user;
  const userRole = user?.role ?? "";
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : "";
  const roleBadge = userRole ? (ROLE_BADGE_STYLES[userRole] ?? { bg: "#F1F5F9", color: "#475569" }) : null;
  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name ?? user?.email ?? "User";

  const section = getSectionLabel(pathname);
  const subSection = getSubLabel(pathname);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  async function handleSignOut() {
    setDropdownOpen(false);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header
      className="h-16 flex items-center justify-between px-4 lg:px-6 shrink-0 bg-white"
      style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.8)" }}
    >
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center size-9 rounded-lg transition-colors shrink-0"
          style={{ color: "#64748B" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F1F5F9";
            (e.currentTarget as HTMLButtonElement).style.color = "#0F172A";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#64748B";
          }}
          aria-label="Toggle navigation"
        >
          <Menu className="size-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "#0F172A",
              letterSpacing: "-0.01em",
            }}
          >
            {section}
          </span>
          {subSection && subSection !== section && (
            <>
              <span
                className="shrink-0"
                style={{ color: "#CBD5E1", fontSize: "0.75rem" }}
              >
                /
              </span>
              <span
                className="truncate"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  color: "#64748B",
                }}
              >
                {subSection}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: notification bell + user dropdown */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notification bell */}
        <button
          className="relative flex items-center justify-center size-9 rounded-lg transition-colors"
          style={{ color: "#64748B" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F1F5F9";
            (e.currentTarget as HTMLButtonElement).style.color = "#0F172A";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#64748B";
          }}
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          {/* Amber dot indicator */}
          <span
            className="absolute top-2 right-2 size-2 rounded-full border border-white"
            style={{ background: "#F59E0B" }}
          />
        </button>

        {/* Thin divider */}
        <div
          className="h-6 w-px mx-1"
          style={{ background: "#E2E8F0" }}
        />

        {/* User dropdown trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors"
            style={{ color: "#0F172A" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F8FAFC";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            {/* Avatar with initials */}
            <div
              className="flex items-center justify-center size-8 rounded-full shrink-0 text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
                color: "#FFFFFF",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {initials}
            </div>

            {/* Name — hidden on very small screens */}
            <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
              <span
                className="line-clamp-1 max-w-[130px]"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  color: "#0F172A",
                }}
              >
                {displayName}
              </span>
              {roleLabel && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    color: "#94A3B8",
                  }}
                >
                  {roleLabel}
                </span>
              )}
            </div>

            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                dropdownOpen && "rotate-180"
              )}
              style={{ color: "#94A3B8" }}
            />
          </button>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-60 z-50 rounded-xl p-2 animate-scale-in"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(226, 232, 240, 0.8)",
                boxShadow:
                  "0 4px 6px -1px rgba(15,23,42,0.06), 0 10px 32px -4px rgba(15,23,42,0.12)",
              }}
            >
              {/* User info header */}
              <div
                className="px-3 py-3 rounded-lg mb-1"
                style={{ background: "#F8FAFC" }}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div
                    className="flex items-center justify-center size-9 rounded-full shrink-0 text-xs font-bold"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
                      color: "#FFFFFF",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        color: "#0F172A",
                      }}
                    >
                      {displayName}
                    </p>
                    {user?.email && (
                      <p
                        className="truncate"
                        style={{
                          fontSize: "0.75rem",
                          color: "#94A3B8",
                          marginTop: "1px",
                        }}
                      >
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                {roleLabel && roleBadge && (
                  <span
                    className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-md"
                    style={{
                      background: roleBadge.bg,
                      color: roleBadge.color,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: "0.6875rem",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {roleLabel}
                  </span>
                )}
              </div>

              {/* Separator */}
              <div
                className="my-1 mx-1"
                style={{ height: "1px", background: "#F1F5F9" }}
              />

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "#F43F5E" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#FFF1F2";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                }}
              >
                <LogOut className="size-4 shrink-0" />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 }}>
                  Sign out
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
