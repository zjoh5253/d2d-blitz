import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Prospective reps awaiting approval (spec §8.1). Admin / EXECUTIVE / FIELD_MANAGER.
const APPROVERS = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!APPROVERS.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reps = await db.user.findMany({
    where: { status: "ONBOARDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, phone: true, createdAt: true,
      onboardingData: true, referralSource: true,
      blitzSignups: {
        where: { status: { in: ["CLAIMED", "WAITLISTED"] } },
        select: { status: true, blitz: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json(reps);
}
