"use client";

import { useState } from "react";
import Link from "next/link";
import { X, ClipboardList } from "lucide-react";

/**
 * Non-blocking onboarding reminder (parity with the mobile "Finish your
 * onboarding" banner). Shown to FIELD_REPs who have cleared the hard gate
 * (gateComplete) but still have outstanding optional items (allComplete === false),
 * e.g. the W-9. Dismissible for the session.
 */
export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <ClipboardList className="h-4 w-4 shrink-0" />
        <span>
          Finish your onboarding — a few items are still outstanding (W-9, etc.).{" "}
          <Link
            href="/onboarding"
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Complete now
          </Link>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-600 hover:text-amber-800"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
