"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function HeroSection() {
  const { status } = useSession();

  return (
    <section
      className="relative overflow-hidden min-h-screen flex items-center pt-24"
      style={{
        background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Gradient orbs */}
      <div
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(30,64,175,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto text-center px-6 w-full flex flex-col items-center py-20">
        {/* Badge pill */}
        <div
          className="inline-flex items-center bg-blue-500/10 border border-blue-400/20 text-blue-300 text-sm font-medium px-4 py-1.5 rounded-full mb-8 animate-fade-in"
          style={{ animationDelay: "0ms" }}
        >
          Sales Operations Platform
        </div>

        {/* Headline */}
        <h1
          className="text-white font-heading animate-fade-in"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            animationDelay: "80ms",
          }}
        >
          Dominate the Field. Own Your Numbers.
        </h1>

        {/* Subheadline */}
        <p
          className="text-blue-200/70 text-lg max-w-2xl mx-auto leading-relaxed mt-6 animate-fade-in"
          style={{ animationDelay: "160ms" }}
        >
          The all-in-one platform powering America&apos;s top door-to-door sales teams. Manage
          blitzes, track performance, and pay commissions &mdash; all in real time.
        </p>

        {/* CTA buttons */}
        <div
          className="flex items-center justify-center gap-4 mt-10 animate-fade-in"
          style={{ animationDelay: "240ms" }}
        >
          {status === "loading" && (
            <>
              <div className="skeleton w-40 h-12 rounded-lg" />
              <div className="skeleton w-36 h-12 rounded-lg" />
            </>
          )}

          {status === "authenticated" && (
            <Link
              href="/dashboard"
              className="gradient-brand glow-blue text-white font-semibold px-8 py-3 rounded-lg transition-opacity hover:opacity-90"
            >
              Go to Dashboard
            </Link>
          )}

          {status === "unauthenticated" && (
            <>
              <Link
                href="/login"
                className="gradient-brand glow-blue text-white font-semibold px-8 py-3 rounded-lg transition-opacity hover:opacity-90"
              >
                Get Started Free
              </Link>
              <Link
                href="#"
                className="border border-white/30 text-white font-semibold px-8 py-3 rounded-lg transition-colors hover:bg-white/10"
              >
                Watch Demo
              </Link>
            </>
          )}
        </div>

        {/* Social proof strip */}
        <div
          className="flex items-center justify-center gap-3 mt-16 animate-fade-in"
          style={{ animationDelay: "320ms" }}
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {(["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"] as const).map((bg, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-[#1E293B] flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: bg }}
              >
                {(["JT", "AM", "KR", "DS"] as const)[i]}
              </div>
            ))}
          </div>
          <p className="text-blue-200/70 text-sm">2,400+ reps active across 38 markets</p>
        </div>
      </div>
    </section>
  );
}
