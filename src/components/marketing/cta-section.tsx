"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function CtaSection() {
  const { data: session, status } = useSession();

  return (
    <section className="gradient-brand py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2
          className="text-white text-3xl lg:text-4xl font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Your next blitz is waiting.
        </h2>

        <p className="text-blue-100/80 text-lg mt-4 max-w-2xl mx-auto">
          Create your free account and start turning doors into paid installs today.
        </p>

        <div className="mt-8">
          {status === "loading" ? (
            <div className="inline-block h-12 w-48 rounded-lg bg-white/20 animate-pulse" />
          ) : session ? (
            <Link
              href="/dashboard"
              className="bg-white text-blue-600 font-semibold rounded-lg px-8 py-3 hover:bg-blue-50 transition-colors duration-200 shadow-lg inline-block"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/register"
              className="bg-white text-blue-600 font-semibold rounded-lg px-8 py-3 hover:bg-blue-50 transition-colors duration-200 shadow-lg inline-block"
            >
              Get Started Free
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
