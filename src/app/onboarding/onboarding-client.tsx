"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileSignature,
  User,
  GraduationCap,
  Check,
  ChevronRight,
  ChevronLeft,
  Upload,
  Loader2,
  Phone,
  Receipt,
  MapPin,
  Undo2,
  Trophy,
  Rocket,
} from "lucide-react";
import { BlitzBolt } from "@/components/brand/blitz-bolt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { OnboardingStatus, OnboardingAgreement } from "./types";

/* ─── Steps ──────────────────────────────────────────── */

const STEPS = [
  { key: "welcome", label: "Welcome" },
  { key: "agreements", label: "Agreements" },
  { key: "profile", label: "Profile" },
  { key: "training", label: "Training" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/* ─── Helpers ────────────────────────────────────────── */

/** Strip simple markdown (**bold**, # headings, leading list dashes) for plain display. */
function stripMarkdown(body: string): string {
  return body
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

/** Format a 10-digit string as (555) 123-4567 while typing. */
function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const WELCOME_ITEMS = [
  {
    icon: FileSignature,
    title: "Sign your agreements",
    copy: "Rep agreement, GPS consent, and tax forms.",
  },
  {
    icon: User,
    title: "Complete your profile",
    copy: "Add your contact info so your team can reach you.",
  },
  {
    icon: GraduationCap,
    title: "Quick training",
    copy: "A short orientation on logging sales and tracking.",
  },
];

const TRAINING_SLIDES = [
  {
    icon: Receipt,
    color: "#3B82F6",
    title: "Log a sale",
    copy: "Tap New Sale, fill in the customer details, choose the carrier, and submit. Sales sync automatically — even if you lose signal.",
  },
  {
    icon: MapPin,
    color: "#10B981",
    title: "GPS tracking",
    copy: "Start a tracking session before you head out. Your route and door knocks are recorded so your stats stay accurate all day.",
  },
  {
    icon: Undo2,
    color: "#8B5CF6",
    title: "Go-backs & leads",
    copy: "Mark interested prospects as go-backs and revisit them later. Your assigned leads live under My Leads so you always know where to knock next.",
  },
  {
    icon: Trophy,
    color: "#F59E0B",
    title: "Climb the leaderboard",
    copy: "Every verified install moves you up the leaderboard and boosts your streak multiplier. Check your ranking any time.",
  },
];

/* ─── Profile schema ─────────────────────────────────── */

const profileSchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10, "Enter a valid 10-digit phone number"),
});

type ProfileFormValues = { phone: string };

/* ─── Props ──────────────────────────────────────────── */

interface OnboardingClientProps {
  initialStatus: OnboardingStatus;
  initialAgreements: OnboardingAgreement[];
}

export function OnboardingClient({
  initialStatus,
  initialAgreements,
}: OnboardingClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("welcome");
  const [status, setStatus] = useState<OnboardingStatus>(initialStatus);
  const [agreements, setAgreements] =
    useState<OnboardingAgreement[]>(initialAgreements);
  const [activeAgreement, setActiveAgreement] =
    useState<OnboardingAgreement | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  /** Re-fetch status + agreements after a mutation to drive the UI. */
  async function refresh() {
    try {
      const [statusRes, agreementsRes] = await Promise.all([
        fetch("/api/onboarding/status", { credentials: "include" }),
        fetch("/api/onboarding/agreements", { credentials: "include" }),
      ]);
      if (statusRes.ok) {
        setStatus((await statusRes.json()) as OnboardingStatus);
      }
      if (agreementsRes.ok) {
        setAgreements((await agreementsRes.json()) as OnboardingAgreement[]);
      }
    } catch {
      // network hiccup — the user can retry the underlying action
    }
  }

  const blockingAgreements = useMemo(
    () => agreements.filter((a) => a.required && a.blocking),
    [agreements]
  );
  const blockingAllAccepted = blockingAgreements.every((a) => a.accepted);

  function goToStep(next: StepKey) {
    setStep(next);
  }

  async function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
          >
            <BlitzBolt className="h-4 w-4 text-white" />
          </div>
          <span
            className="text-lg font-bold tracking-tight text-slate-900"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            D2D Blitz
          </span>
        </div>
      </header>

      {/* Step indicator */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-8">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      done && "bg-primary text-primary-foreground",
                      current && "bg-primary/10 text-primary ring-2 ring-primary",
                      !done && !current && "bg-slate-100 text-slate-400"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      current ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      i < stepIndex ? "bg-primary" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <div className="animate-fade-in">
          {step === "welcome" && (
            <WelcomeStep onNext={() => goToStep("agreements")} />
          )}
          {step === "agreements" && (
            <AgreementsStep
              agreements={agreements}
              blockingAllAccepted={blockingAllAccepted}
              onOpen={setActiveAgreement}
              onBack={() => goToStep("welcome")}
              onNext={() => goToStep("profile")}
            />
          )}
          {step === "profile" && (
            <ProfileStep
              phoneComplete={status.profileComplete}
              onSaved={async () => {
                await refresh();
              }}
              onBack={() => goToStep("agreements")}
              onNext={() => goToStep("training")}
            />
          )}
          {step === "training" && (
            <TrainingStep
              gateComplete={status.gateComplete}
              onBack={() => goToStep("profile")}
              onFinish={finish}
            />
          )}
        </div>
      </main>

      {/* Agreement signing dialog */}
      {activeAgreement && (
        <AgreementDialog
          agreement={activeAgreement}
          onClose={() => setActiveAgreement(null)}
          onAccepted={async () => {
            setActiveAgreement(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/* ─── Welcome step ───────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h1
          className="mt-5 text-2xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Welcome to D2D Blitz
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Let&apos;s get you set up so you can start knocking. It only takes a
          few minutes.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          What you&apos;ll set up
        </p>
        {WELCOME_ITEMS.map(({ icon: Icon, title, copy }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-sm text-slate-500">{copy}</p>
            </div>
          </div>
        ))}
      </div>

      <Button size="lg" className="mt-8 w-full" onClick={onNext}>
        Get started
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Agreements step ────────────────────────────────── */

function AgreementsStep({
  agreements,
  blockingAllAccepted,
  onOpen,
  onBack,
  onNext,
}: {
  agreements: OnboardingAgreement[];
  blockingAllAccepted: boolean;
  onOpen: (a: OnboardingAgreement) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
      <h2
        className="text-xl font-bold tracking-tight text-slate-900"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Sign your agreements
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Review and sign each agreement. Required items must be signed before you
        continue.
      </p>

      <div className="mt-6 space-y-3">
        {agreements.map((a) => {
          const optionalNow = !a.blocking;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen(a)}
              className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/30 hover:bg-slate-50"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  a.accepted ? "bg-green-100" : "bg-slate-100"
                )}
              >
                {a.accepted ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <FileSignature className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {a.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {a.accepted ? (
                    <span className="text-xs font-medium text-green-600">
                      Signed
                    </span>
                  ) : optionalNow ? (
                    <span className="text-xs font-medium text-amber-600">
                      Optional now
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      Required
                    </span>
                  )}
                  {a.requiresUpload && (
                    <span className="text-xs text-slate-400">
                      · Document upload
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!blockingAllAccepted}>
          Continue
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {!blockingAllAccepted && (
        <p className="mt-3 text-right text-xs text-slate-400">
          Sign all required agreements to continue.
        </p>
      )}
    </div>
  );
}

/* ─── Agreement signing dialog ───────────────────────── */

function AgreementDialog({
  agreement,
  onClose,
  onAccepted,
}: {
  agreement: OnboardingAgreement;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const [signatureName, setSignatureName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFile = agreement.requiresUpload;
  const canSubmit =
    signatureName.trim().length > 0 && (!needsFile || file !== null);

  async function handleAccept() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("signatureName", signatureName.trim());
      if (needsFile && file) {
        form.append("document", file);
      }
      const res = await fetch(
        `/api/onboarding/agreements/${agreement.id}/accept`,
        { method: "POST", body: form, credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save your signature. Please try again.");
        return;
      }
      onAccepted();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onClose={onClose}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle>{agreement.title}</DialogTitle>
          <DialogDescription>
            {agreement.blocking
              ? "Read the agreement and sign to continue."
              : "You can finish this later — signing it now is optional."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[38vh] overflow-y-auto px-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {stripMarkdown(agreement.body)}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="signatureName">Type your full name to sign</Label>
            <Input
              id="signatureName"
              placeholder="Jane Smith"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              autoComplete="name"
            />
          </div>

          {needsFile && (
            <div className="space-y-1.5">
              <Label htmlFor="document">Upload your signed W-9</Label>
              <label
                htmlFor="document"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-primary/40 hover:bg-slate-100"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {file ? file.name : "Choose an image or PDF"}
                </span>
              </label>
              <input
                id="document"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 bg-secondary/30 p-6 pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {agreement.blocking ? "Cancel" : "Finish later"}
          </Button>
          <Button onClick={handleAccept} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing…
              </>
            ) : (
              "Accept & Sign"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Profile step ───────────────────────────────────── */

function ProfileStep({
  phoneComplete,
  onSaved,
  onBack,
  onNext,
}: {
  phoneComplete: boolean;
  onSaved: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(phoneComplete);

  const {
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { phone: "" },
  });

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setPhoneDisplay(formatPhoneDisplay(raw));
    setValue("phone", raw, { shouldValidate: false });
  }

  async function onSubmit(data: ProfileFormValues) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: data.phone.replace(/\D/g, "") }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not save your phone number.");
        return;
      }
      setSaved(true);
      await onSaved();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
      <h2
        className="text-xl font-bold tracking-tight text-slate-900"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        Complete your profile
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Add a phone number so your team can reach you in the field.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              className="pl-10"
              value={phoneDisplay}
              onChange={handlePhoneChange}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-red-500">{errors.phone.message}</p>
          )}
          {saved && !errors.phone && (
            <p className="flex items-center gap-1 text-xs font-medium text-green-600">
              <Check className="h-3.5 w-3.5" />
              Saved
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save phone number"
          )}
        </Button>
      </form>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!saved}>
          Continue
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Training step ──────────────────────────────────── */

function TrainingStep({
  gateComplete,
  onBack,
  onFinish,
}: {
  gateComplete: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
      <div className="flex items-center justify-between">
        <h2
          className="text-xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Quick training
        </h2>
        <button
          type="button"
          onClick={onFinish}
          disabled={!gateComplete}
          className="text-sm font-semibold text-primary hover:underline disabled:opacity-40"
        >
          Skip
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        A short orientation to get you knocking with confidence.
      </p>

      <div className="mt-6 space-y-3">
        {TRAINING_SLIDES.map(({ icon: Icon, color, title, copy }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}1A` }}
            >
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-sm leading-relaxed text-slate-500">{copy}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onFinish} disabled={!gateComplete}>
          Finish
          <Check className="h-4 w-4" />
        </Button>
      </div>
      {!gateComplete && (
        <p className="mt-3 text-right text-xs text-slate-400">
          Complete the required steps to finish onboarding.
        </p>
      )}
    </div>
  );
}
