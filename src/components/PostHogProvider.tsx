"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = searchParams.size > 0
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

function PostHogIdentify() {
  const { data: session } = useSession();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph || !session?.user) return;
    ph.identify(session.user.id, {
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      role: session.user.role,
    });
  }, [session, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    if (!key || !host) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // handled manually via PostHogPageView
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: true,
      },
      autocapture: true,
      loaded(ph) {
        if (process.env.NODE_ENV === "development") ph.debug();
      },
    });
  }, [key, host]);

  if (!key || !host) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
