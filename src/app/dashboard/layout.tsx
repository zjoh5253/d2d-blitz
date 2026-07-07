"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { OnboardingBanner } from "@/components/layout/onboarding-banner";

/** Onboarding gate check state for FIELD_REP users. */
type OnboardingGate =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; gateComplete: boolean; allComplete: boolean };

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [gate, setGate] = useState<OnboardingGate>({ status: "idle" });
  // Guards the one-time onboarding check. Intentionally NOT `gate.status` in the
  // effect deps: setGate({ checking }) would otherwise re-run this effect and its
  // cleanup would cancel the very fetch it just started, wedging the gate on
  // "checking" forever.
  const gateCheckStarted = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // FIELD_REPs must clear the onboarding gate before using the dashboard.
  // Non-rep roles skip the check entirely.
  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    if (session.user.role !== "FIELD_REP") {
      setGate({ status: "ready", gateComplete: true, allComplete: true });
      return;
    }
    if (gateCheckStarted.current) return;
    gateCheckStarted.current = true;

    setGate({ status: "checking" });
    fetch("/api/onboarding/status", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          // On failure, don't hard-lock the rep out of the app.
          setGate({ status: "ready", gateComplete: true, allComplete: true });
          return;
        }
        if (!data.gateComplete) {
          router.replace("/onboarding");
          return;
        }
        setGate({
          status: "ready",
          gateComplete: true,
          allComplete: !!data.allComplete,
        });
      })
      .catch(() => {
        setGate({ status: "ready", gateComplete: true, allComplete: true });
      });
  }, [status, session, router]);

  const gateResolved = gate.status === "ready";

  if (status === "loading" || (status === "authenticated" && !gateResolved)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const showOnboardingBanner =
    gate.status === "ready" && gate.gateComplete && !gate.allComplete;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — handles its own mobile backdrop internally */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />

        {session.user.emailVerified === false && session.user.email && (
          <EmailVerificationBanner email={session.user.email} />
        )}

        {showOnboardingBanner && <OnboardingBanner />}

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
