import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public: minimal context for the onboarding form (which blitz they came from).
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ blitz: null });
  const blitz = await db.blitz.findFirst({
    where: { publicCardToken: token },
    select: { name: true, market: { select: { carrier: { select: { name: true } } } } },
  });
  return NextResponse.json({ blitz: blitz ? { name: blitz.name, carrier: blitz.market.carrier.name } : null });
}
