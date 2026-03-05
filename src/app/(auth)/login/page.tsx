"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Zap, BarChart3, DollarSign, Map } from "lucide-react";

/* ─── Zod schema ─────────────────────────────────────── */

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/* ─── Feature pills ──────────────────────────────────── */

const features = [
  { icon: BarChart3, label: "Real-time Leaderboards" },
  { icon: DollarSign, label: "Instant Commissions" },
  { icon: Map, label: "Field Intelligence" },
];

/* ─── Decorative hero panel ──────────────────────────── */

function HeroPanel() {
  return (
    <div
      className="hidden lg:flex lg:flex-col lg:justify-between relative overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
        minHeight: "100vh",
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
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(30,64,175,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-12">
        {/* Top: wordmark */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
          >
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <span
            className="text-white text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            D2D Blitz
          </span>
        </div>

        {/* Middle: headline */}
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest">
              Sales Operations Platform
            </p>
            <h1
              className="text-white leading-tight"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Powering the nation&apos;s top door-to-door sales teams
            </h1>
            <p className="text-blue-200/70 text-base leading-relaxed max-w-xs">
              From field to close — manage reps, track performance, and pay commissions in real time.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {features.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className="flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: `${i * 80 + 200}ms` }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.3)" }}
                >
                  <Icon className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-blue-100/90 text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: social proof */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"].map((bg, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-[#1E293B] flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: bg }}
              >
                {["JT", "AM", "KR", "DS"][i]}
              </div>
            ))}
          </div>
          <div>
            <p className="text-white text-xs font-semibold">2,400+ reps active today</p>
            <p className="text-blue-300/60 text-[11px]">across 38 markets nationwide</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Login form (needs Suspense for useSearchParams) ─── */

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Email */}
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-sm font-medium"
          style={{ color: "#334155" }}
        >
          Email address
        </Label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "#94A3B8" }}
          />
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-sm font-medium"
          style={{ color: "#334155" }}
        >
          Password
        </Label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "#94A3B8" }}
          />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "rgba(244,63,94,0.05)",
            border: "1px solid rgba(244,63,94,0.15)",
            color: "#BE123C",
          }}
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 rounded-lg font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: isLoading
            ? "#60A5FA"
            : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
          boxShadow: isLoading ? "none" : "0 1px 3px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.2)",
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 16px rgba(59,130,246,0.45), 0 8px 24px rgba(59,130,246,0.25)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 1px 3px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.2)";
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing in&hellip;
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}

/* ─── Page ───────────────────────────────────────────── */

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ background: "#F8FAFC" }}>
      {/* Left hero panel */}
      <div className="lg:w-[52%] xl:w-[55%] flex-shrink-0">
        <HeroPanel />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile wordmark */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
            >
              <Zap className="w-4 h-4 text-white" fill="currentColor" />
            </div>
            <span
              className="text-slate-900 text-lg font-bold tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              D2D Blitz
            </span>
          </div>

          {/* Card */}
          <div
            className="bg-white rounded-2xl p-8 lg:p-10"
            style={{
              boxShadow:
                "0 1px 3px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
            }}
          >
            {/* Heading */}
            <div className="mb-8">
              <h1
                className="text-2xl font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Welcome back
              </h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to your dashboard</p>
            </div>

            {/* Form — Suspense required for useSearchParams */}
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>

            {/* Divider + register link */}
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-150 underline-offset-4 hover:underline"
                >
                  Create one free
                </Link>
              </p>
            </div>
          </div>

          {/* Trust line */}
          <p className="text-center text-xs text-slate-400 mt-6">
            Protected by 256-bit encryption &middot; SOC 2 compliant
          </p>
        </div>
      </div>
    </div>
  );
}
