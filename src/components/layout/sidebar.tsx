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
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  // Admin
  {
    title: "Users",
    href: "/dashboard/admin/users",
    icon: <Users className="h-4 w-4" />,
    roles: ["ADMIN"],
  },
  {
    title: "Carriers",
    href: "/dashboard/admin/carriers",
    icon: <Settings className="h-4 w-4" />,
    roles: ["ADMIN"],
  },
  {
    title: "Governance Config",
    href: "/dashboard/admin/governance-config",
    icon: <Settings className="h-4 w-4" />,
    roles: ["ADMIN"],
  },
  {
    title: "Stack Config",
    href: "/dashboard/admin/stack-config",
    icon: <Settings className="h-4 w-4" />,
    roles: ["ADMIN"],
  },

  // Recruiting
  {
    title: "Leads",
    href: "/dashboard/recruiting",
    icon: <UserPlus className="h-4 w-4" />,
    roles: ["ADMIN", "RECRUITER"],
  },

  // Markets
  {
    title: "Markets",
    href: "/dashboard/markets",
    icon: <MapPin className="h-4 w-4" />,
    roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
  },

  // Blitzes
  {
    title: "Blitzes",
    href: "/dashboard/blitzes",
    icon: <Zap className="h-4 w-4" />,
    roles: ["ADMIN", "MARKET_OWNER", "FIELD_MANAGER"],
  },

  // Reps
  {
    title: "Dashboard",
    href: "/dashboard/reps/dashboard",
    icon: <Activity className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
  },
  {
    title: "Daily Report",
    href: "/dashboard/reps/daily-report",
    icon: <Activity className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
  },
  {
    title: "Go-Backs",
    href: "/dashboard/reps/go-backs",
    icon: <Activity className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
  },
  {
    title: "Sales",
    href: "/dashboard/reps/sales",
    icon: <Activity className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "FIELD_REP"],
  },

  // Installs
  {
    title: "Verification",
    href: "/dashboard/installs",
    icon: <CheckCircle className="h-4 w-4" />,
    roles: ["ADMIN"],
  },

  // Compensation
  {
    title: "Payouts",
    href: "/dashboard/compensation",
    icon: <DollarSign className="h-4 w-4" />,
    roles: ["ADMIN"],
  },

  // Governance
  {
    title: "Tiers",
    href: "/dashboard/governance",
    icon: <Shield className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER"],
  },

  // Compliance
  {
    title: "Status",
    href: "/dashboard/compliance",
    icon: <ClipboardCheck className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER"],
  },

  // Leaderboard (all authenticated users)
  {
    title: "Rankings",
    href: "/dashboard/leaderboard",
    icon: <Trophy className="h-4 w-4" />,
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

  // Inbound
  {
    title: "Inbound Leads",
    href: "/dashboard/inbound",
    icon: <PhoneIncoming className="h-4 w-4" />,
    roles: ["ADMIN", "CALL_CENTER"],
  },

  // Reports
  {
    title: "National",
    href: "/dashboard/reports/national",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "EXECUTIVE"],
  },
  {
    title: "Margins",
    href: "/dashboard/reports/margins",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "EXECUTIVE"],
  },
  {
    title: "Governance Report",
    href: "/dashboard/reports/governance",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "EXECUTIVE"],
  },
  {
    title: "Blitz P&L",
    href: "/dashboard/reports/blitz-pnl",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "EXECUTIVE"],
  },
  {
    title: "Recruiting ROI",
    href: "/dashboard/reports/recruiting-roi",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "EXECUTIVE"],
  },

  // Manager
  {
    title: "Reps",
    href: "/dashboard/manager/reps",
    icon: <Users className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
  },
  {
    title: "Manager Blitzes",
    href: "/dashboard/manager/blitzes",
    icon: <Users className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
  },
  {
    title: "Manager Governance",
    href: "/dashboard/manager/governance",
    icon: <Users className="h-4 w-4" />,
    roles: ["ADMIN", "FIELD_MANAGER", "MARKET_OWNER"],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:z-auto lg:transition-none"
        )}
      >
        {/* Logo / brand */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
            B2B Blitz
          </span>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.icon}
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
