"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Settings,
  UserPlus,
  MapPin,
  Zap,
  Activity,
  CheckCircle,
  DollarSign,
  Shield,
  ClipboardCheck,
  Trophy,
  PhoneIncoming,
  BarChart3,
  Users,
  X,
  LayoutDashboard,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard/reps/dashboard",
        icon: <LayoutDashboard className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Markets",
        href: "/dashboard/markets",
        icon: <MapPin className="size-[18px]" />,
        roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
      },
      {
        title: "Blitzes",
        href: "/dashboard/blitzes",
        icon: <Zap className="size-[18px]" />,
        roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
      },
      {
        title: "Daily Report",
        href: "/dashboard/reps/daily-report",
        icon: <Activity className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
      },
      {
        title: "Go-Backs",
        href: "/dashboard/reps/go-backs",
        icon: <Activity className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
      },
      {
        title: "Sales",
        href: "/dashboard/reps/sales",
        icon: <Activity className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        title: "Verification",
        href: "/dashboard/installs",
        icon: <CheckCircle className="size-[18px]" />,
        roles: ["ADMIN"],
      },
      {
        title: "Payouts",
        href: "/dashboard/compensation",
        icon: <DollarSign className="size-[18px]" />,
        roles: ["ADMIN"],
      },
      {
        title: "Inbound Leads",
        href: "/dashboard/inbound",
        icon: <PhoneIncoming className="size-[18px]" />,
        roles: ["ADMIN", "CALL_CENTER"],
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Leads",
        href: "/dashboard/recruiting",
        icon: <UserPlus className="size-[18px]" />,
        roles: ["ADMIN", "RECRUITER"],
      },
      {
        title: "Tiers",
        href: "/dashboard/governance",
        icon: <Shield className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER"],
      },
      {
        title: "Compliance",
        href: "/dashboard/compliance",
        icon: <ClipboardCheck className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Rankings",
        href: "/dashboard/leaderboard",
        icon: <Trophy className="size-[18px]" />,
        roles: [
          "ADMIN",
          "EXECUTIVE",
          "RECRUITER",
          "MARKET_OWNER",
          "FIELD_MANAGER",
          "FIELD_REP",
          "CALL_CENTER",
        ],
      },
      {
        title: "National",
        href: "/dashboard/reports/national",
        icon: <BarChart3 className="size-[18px]" />,
        roles: ["ADMIN", "EXECUTIVE"],
      },
      {
        title: "Margins",
        href: "/dashboard/reports/margins",
        icon: <BarChart3 className="size-[18px]" />,
        roles: ["ADMIN", "EXECUTIVE"],
      },
      {
        title: "Governance Report",
        href: "/dashboard/reports/governance",
        icon: <BarChart3 className="size-[18px]" />,
        roles: ["ADMIN", "EXECUTIVE"],
      },
      {
        title: "Blitz P&L",
        href: "/dashboard/reports/blitz-pnl",
        icon: <BarChart3 className="size-[18px]" />,
        roles: ["ADMIN", "EXECUTIVE"],
      },
      {
        title: "Recruiting ROI",
        href: "/dashboard/reports/recruiting-roi",
        icon: <BarChart3 className="size-[18px]" />,
        roles: ["ADMIN", "EXECUTIVE"],
      },
      {
        title: "Reps",
        href: "/dashboard/manager/reps",
        icon: <Users className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
      },
      {
        title: "Manager Blitzes",
        href: "/dashboard/manager/blitzes",
        icon: <Zap className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
      },
      {
        title: "Manager Governance",
        href: "/dashboard/manager/governance",
        icon: <Shield className="size-[18px]" />,
        roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Users",
        href: "/dashboard/admin/users",
        icon: <Users className="size-[18px]" />,
        roles: ["ADMIN"],
      },
      {
        title: "Carriers",
        href: "/dashboard/admin/carriers",
        icon: <Settings className="size-[18px]" />,
        roles: ["ADMIN"],
      },
      {
        title: "Governance Config",
        href: "/dashboard/admin/governance-config",
        icon: <Settings className="size-[18px]" />,
        roles: ["ADMIN"],
      },
      {
        title: "Stack Config",
        href: "/dashboard/admin/stack-config",
        icon: <Settings className="size-[18px]" />,
        roles: ["ADMIN"],
      },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EXECUTIVE: "Executive",
  RECRUITER: "Recruiter",
  MARKET_OWNER: "Market Owner",
  FIELD_MANAGER: "Field Manager",
  FIELD_REP: "Field Rep",
  CALL_CENTER: "Call Center",
};

function getInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
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

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const user = session?.user;

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(userRole)),
  })).filter((group) => group.items.length > 0);

  const initials = getInitials(user?.name, user?.email);
  const roleLabel = userRole ? (ROLE_LABELS[userRole] ?? userRole) : "";
  const displayName = user?.name ?? user?.email ?? "User";

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col",
          "transition-transform duration-300 ease-out",
          "lg:translate-x-0 lg:static lg:z-auto lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "#0F172A",
          borderRight: "1px solid #1E293B",
        }}
      >
        {/* Logo area */}
        <div
          className="flex items-center justify-between px-5 py-[18px] shrink-0"
          style={{ borderBottom: "1px solid #1E293B" }}
        >
          <div className="flex items-center gap-3">
            {/* Amber lightning mark */}
            <div
              className="flex items-center justify-center size-8 rounded-lg shrink-0"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                boxShadow: "0 0 12px rgba(245,158,11,0.35)",
              }}
            >
              <Zap className="size-4 text-white" fill="white" strokeWidth={0} />
            </div>

            {/* Wordmark */}
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "1.0625rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#3B82F6" }}>D2D</span>
              <span style={{ color: "#F8FAFC" }}> Blitz</span>
            </span>
          </div>

          {/* Close — mobile only */}
          <button
            onClick={onClose}
            className={cn(
              "lg:hidden flex items-center justify-center size-7 rounded-md transition-colors",
              "hover:bg-[#1E293B]"
            )}
            style={{ color: "#475569" }}
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.label}>
              {/* Section divider line before all groups except first */}
              {groupIndex > 0 && (
                <div
                  className="mx-2 my-3"
                  style={{ height: "1px", background: "#1E293B" }}
                />
              )}

              {/* Section label */}
              <p
                className="px-3 mb-1.5"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "0.625rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#475569",
                }}
              >
                {group.label}
              </p>

              {/* Nav items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-[rgba(59,130,246,0.1)]"
                          : "hover:bg-[#1E293B]/70"
                      )}
                      style={
                        isActive
                          ? {
                              color: "#60A5FA",
                              borderLeft: "2px solid #3B82F6",
                              paddingTop: "0.5625rem",
                              paddingBottom: "0.5625rem",
                              paddingLeft: "calc(0.75rem - 2px)",
                              paddingRight: "0.75rem",
                            }
                          : {
                              color: "#94A3B8",
                              padding: "0.5625rem 0.75rem",
                            }
                      }
                    >
                      {/* Icon */}
                      <span
                        className="shrink-0 transition-colors duration-200"
                        style={{ color: isActive ? "#3B82F6" : "inherit" }}
                      >
                        {item.icon}
                      </span>

                      <span className="truncate">{item.title}</span>

                      {/* Active dot */}
                      {isActive && (
                        <span
                          className="absolute right-3 size-1.5 rounded-full shrink-0"
                          style={{ background: "#3B82F6", opacity: 0.8 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User mini-card */}
        <div
          className="shrink-0 px-3 py-3"
          style={{ borderTop: "1px solid #1E293B" }}
        >
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{ background: "#1E293B" }}
          >
            {/* Avatar */}
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

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p
                className="truncate text-sm font-semibold leading-tight"
                style={{
                  color: "#E2E8F0",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {displayName}
              </p>
              {roleLabel && (
                <span
                  className="inline-block mt-0.5 px-1.5 py-px rounded text-[10px] font-semibold leading-none"
                  style={{
                    background: "rgba(59,130,246,0.15)",
                    color: "#60A5FA",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    letterSpacing: "0.02em",
                  }}
                >
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
