"use client";

import { useState } from "react";
import { X, Mail } from "lucide-react";

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (dismissed) return null;

  async function handleResend() {
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-amber-800">
        <Mail className="h-4 w-4 shrink-0" />
        <span>
          Please verify your email address.{" "}
          {resent ? (
            <span className="font-medium">Verification email sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-medium underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800 shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
