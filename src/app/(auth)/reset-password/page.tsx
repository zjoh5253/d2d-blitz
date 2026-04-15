"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Zap, ArrowLeft, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-slate-500 text-sm">
          Invalid or missing reset token. Please request a new password reset link.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Request new link
        </Link>
      </div>
    );
  }

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
        <p className="text-slate-500 text-sm">
          Your password has been reset. Redirecting you to sign in&hellip;
        </p>
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
          <ArrowLeft className="w-3.5 h-3.5" />
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Set new password</h1>
        <p className="text-slate-500 text-sm mt-1">Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium" style={{ color: "#334155" }}>
            New password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#94A3B8" }} />
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              className="h-11 pl-10 rounded-lg border-[#E2E8F0] bg-white text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
              {...register("password")}
            />
          </div>
          {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium" style={{ color: "#334155" }}>
            Confirm new password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#94A3B8" }} />
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
            <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 rounded-lg font-semibold text-white text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: isLoading ? "#60A5FA" : "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
            boxShadow: isLoading ? "none" : "0 1px 3px rgba(59,130,246,0.4), 0 4px 12px rgba(59,130,246,0.2)",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Updating&hellip;
            </span>
          ) : (
            "Update password"
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "#F8FAFC" }}>
      <div className="w-full max-w-md animate-fade-in">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 mb-10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}
          >
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </div>
          <span className="text-slate-900 text-lg font-bold tracking-tight">D2D Blitz</span>
        </div>

        <div
          className="bg-white rounded-2xl p-8 lg:p-10"
          style={{
            boxShadow:
              "0 1px 3px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
          }}
        >
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
