import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// In-Staffing approvals (#2): the onboarding applicants + no-penalty requests
// tied to THIS blitz, so a manager approves them without leaving the Staffing
// tab. (The standalone Approvals page stays for the cross-blitz view.)
// Admin / FIELD_MANAGER only. Decisions reuse the existing decide endpoints.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const [onboarding, waivers] = await Promise.all([
    // Prospective reps whose held spot is on this blitz.
    db.user.findMany({
      where: { status: "ONBOARDING", blitzSignups: { some: { blitzId: id, status: { in: ["CLAIMED", "WAITLISTED"] } } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true, onboardingData: true },
    }),
    db.penaltyWaiver.findMany({
      where: { blitzId: id, status: "REQUESTED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, reason: true, rep: { select: { name: true, email: true } } },
    }),
  ]);

  return NextResponse.json({ onboarding, waivers });
}
