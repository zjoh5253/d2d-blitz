"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  Zap,
  TrendingUp,
  Users,
  Trophy,
} from "lucide-react";

/* ─── Zod schema ─────────────────────────────────────── */

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email address"),
    phone: z
      .string()
      .min(10, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

/* ─── Stat cards for hero panel ─────────────────────── */

const stats = [
  { value: "38", label: "Active Markets", icon: TrendingUp },
  { value: "2.4K", label: "Field Reps", icon: Users },
  { value: "$12M+", label: "Commissions Paid", icon: Trophy },
];

/* ─── Decorative hero panel ──────────────────────────── */

function HeroPanel() {
  return (
    <div
      className="hidden lg:flex lg:flex-col lg:justify-between relative overflow-hidden"
      style={{
        background: "linear-gradient(155deg, #0F172A 0%, #0F2A4A 40%, #1E3A8A 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Dot-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(59,130,246,0.18) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Orbs */}
      <div
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 65%)",
          transform: "translate(20%, -20%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 65%)",
          transform: "translate(-30%, 30%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-12">
        {/* Top: wordmark */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
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
            <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest">
              Join the network
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
              Join the fastest-growing D2D network
            </h1>
            <p className="text-blue-200/70 text-base leading-relaxed max-w-xs">
              Get set up in minutes. Start tracking your team, commissions, and field ops from day one.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ value, label, icon: Icon }, i) => (
              <div
                key={label}
                className="flex flex-col gap-2 p-4 rounded-xl animate-fade-in"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  animationDelay: `${i * 80 + 150}ms`,
                }}
              >
                <Icon className="w-4 h-4 text-amber-400" />
                <p
                  className="text-white font-bold text-lg leading-none"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {value}
                </p>
                <p className="text-blue-300/60 text-[11px] leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl animate-fade-in"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              animationDelay: "400ms",
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
            >
              MR
            </div>
            <div>
              <p className="text-blue-100/80 text-sm leading-relaxed italic">
                &ldquo;D2D Blitz gave our team the real-time visibility we needed. Sales went up 40% in 60 days.&rdquo;
              </p>
              <p className="text-amber-400/80 text-xs font-semibold mt-1.5">
                Marcus R. &mdash; Regional Manager, Dallas
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: tagline */}
        <p className="text-blue-300/40 text-xs">
          &copy; {new Date().getFullYear()} D2D Blitz &middot; Nationwide Sales Intelligence
        </p>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────── */

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormValues) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Registration failed. Please try again.");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

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
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
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
                Create your account
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Get started with D2D Blitz for free
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-sm font-medium"
                  style={{ color: "#334155" }}
                >
                  Full name
                </Label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "#94A3B8" }}
                  />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    autoComplete="name"
                    className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium"
                  style={{ color: "#334155" }}
                >
                  Work email
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

              {/* Phone */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="phone"
                  className="text-sm font-medium"
                  style={{ color: "#334155" }}
                >
                  Phone{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "#94A3B8" }}
                  />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="555-555-5555"
                    autoComplete="tel"
                    className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                    {...register("phone")}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-500">{errors.phone.message}</p>
                )}
              </div>

              {/* Password row — two columns */}
              <div className="grid grid-cols-2 gap-4">
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
                      autoComplete="new-password"
                      className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                      {...register("password")}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium"
                    style={{ color: "#334155" }}
                  >
                    Confirm
                  </Label>
                  <div className="relative">
                    <ShieldCheck
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: "#94A3B8" }}
                    />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                      {...register("confirmPassword")}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-500">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
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
                className="w-full h-11 rounded-lg font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                style={{
                  background: isLoading
                    ? "#60A5FA"
                    : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  boxShadow: isLoading
                    ? "none"
                    : "0 1px 3px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.2)",
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
                    Creating account&hellip;
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Divider + login link */}
            <div className="mt-7 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-150 underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Trust line */}
          <p className="text-center text-xs text-slate-400 mt-6">
            No credit card required &middot; Free to get started &middot; Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
