import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { claimSpot } from "@/lib/blitz-signups";
import { getBackgroundCheckProvider } from "@/lib/integrations/background-check";
import { DEFAULT_SCORE, DEFAULT_BAND } from "@/lib/readiness-score";
import type { OnboardingData } from "@/lib/onboarding";

// Public new-rep onboarding from a shared blitz card (spec §8). Creates an
// ONBOARDING-status rep + a conditional slot hold on the origin blitz, pending
// manager/operator approval. No auth. No e-sign — terms are a checkbox (Teki #4).
const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  homeMarket: z.string().optional(),
  experienceMonths: z.coerce.number().int().nonnegative().optional(),
  priorCarriers: z.string().optional(),
  peakMonthlyDeals: z.coerce.number().int().nonnegative().optional(),
  references: z.string().optional(),
  carrierCredential: z.string().optional(),
  backgroundCheckAuthorized: z.literal(true),
  w9Acknowledged: z.literal(true),
  termsAccepted: z.literal(true),
  ref: z.string().optional(), // public card token
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Please complete all required fields and acceptances.", details: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const existing = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    // Resolve the origin blitz from the card token (best-effort — onboarding can
    // proceed even if the card expired).
    const blitz = d.ref ? await db.blitz.findFirst({ where: { publicCardToken: d.ref }, select: { id: true } }) : null;

    const bg = await getBackgroundCheckProvider().submit({ repId: "pending", fullName: d.name, email: d.email, authorizedAt: new Date() });

    const onboardingData: OnboardingData = {
      homeMarket: d.homeMarket,
      experienceMonths: d.experienceMonths,
      priorCarriers: d.priorCarriers,
      peakMonthlyDeals: d.peakMonthlyDeals,
      references: d.references,
      backgroundCheckAuthorized: true,
      w9Acknowledged: true,
      termsAccepted: true,
      originBlitzId: blitz?.id ?? null,
      originToken: d.ref ?? null,
      submittedAt: new Date().toISOString(),
    };

    const passwordHash = await bcrypt.hash(d.password, 12);
    const user = await db.user.create({
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone,
        passwordHash,
        role: "FIELD_REP",
        status: "ONBOARDING",
        blitzReadinessScore: DEFAULT_SCORE, // spec §8.2 new reps enter at Standard
        scoreBand: DEFAULT_BAND,
        referralSource: d.ref ?? null,
        carrierCredentials: d.carrierCredential ? [{ carrier: d.carrierCredential }] : undefined,
        onboardingData: { ...onboardingData, backgroundCheck: bg.status },
      },
      select: { id: true, email: true },
    });

    // Conditional slot hold on the origin blitz (reserves a spot; a manager
    // assigns territory after approval → gates begin via the existing flow).
    let held = false;
    if (blitz) {
      const r = await db.$transaction((tx) => claimSpot(tx, blitz.id, user.id, { requireOpenForSignup: false }));
      held = r.code === 200;
    }

    return NextResponse.json({ ok: true, status: "pending_approval", email: user.email, held });
  } catch (error) {
    console.error("[POST /api/onboarding/start]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
