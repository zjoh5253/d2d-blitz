import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Pending no-penalty requests for managers to review (Teki #8).
// Admin / FIELD_MANAGER / EXECUTIVE / MARKET_OWNER.
const APPROVERS = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!APPROVERS.includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const waivers = await db.penaltyWaiver.findMany({
    where: { status: "REQUESTED" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, reason: true, createdAt: true,
      rep: { select: { name: true, email: true } },
      blitz: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(waivers);
}
