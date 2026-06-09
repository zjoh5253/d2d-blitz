"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ClipboardList, MapPin, DollarSign, Wallet, User } from "lucide-react";
import { GpsSessionProvider } from "@/components/gps-session-context";
import { InstallPrompt } from "@/components/install-prompt";

// Mobile-web rep experience — mirrors the native app's bottom-tab nav.
// Renders inside a phone-shaped viewport on desktop but full-bleed on
// mobile. Only FIELD_REPs land here by default after sign-in; admins
// and field managers can visit for testing/QA.

const TABS = [
  { href: "/rep", label: "Home", icon: Home, match: (p: string) => p === "/rep" },
  { href: "/rep/leads", label: "Leads", icon: ClipboardList, match: (p: string) => p.startsWith("/rep/leads") },
  { href: "/rep/gps", label: "GPS", icon: MapPin, match: (p: string) => p.startsWith("/rep/gps") },
  { href: "/rep/sales", label: "Sales", icon: DollarSign, match: (p: string) => p.startsWith("/rep/sales") },
  { href: "/rep/pay", label: "Pay", icon: Wallet, match: (p: string) => p.startsWith("/rep/pay") },
  { href: "/rep/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/rep/profile") },
];

export default function RepLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <GpsSessionProvider>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main content area scrolls; reserves space for the bottom tab bar. */}
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom tab nav — fixed to the viewport bottom, full-width on
          mobile, narrower on tablet+. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white"
        aria-label="Rep tab navigation"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch">
          {TABS.map((t) => {
            const active = t.match(pathname);
            const Icon = t.icon;
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium ${
                    active ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  <Icon className={`size-5 ${active ? "stroke-2" : ""}`} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <InstallPrompt />
    </div>
    </GpsSessionProvider>
  );
}
