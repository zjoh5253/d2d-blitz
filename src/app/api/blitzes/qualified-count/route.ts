import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { qualifiedRepWhere } from "@/lib/qualification";

// Create-form "qualified rep count" preview (spec §5.1 Publish): how many reps
// match the chosen minimum readiness score, so a manager sees reach before
// publishing. Shares the matcher with the (future) invite engine.

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("minScore");
  const minScore = raw != null && raw !== "" ? Number(raw) : null;
  if (minScore != null && (isNaN(minScore) || minScore < 0 || minScore > 100)) {
    return NextResponse.json({ error: "minScore must be 0-100" }, { status: 400 });
  }

  const count = await db.user.count({ where: qualifiedRepWhere({ minScore }) });
  return NextResponse.json({ count, minScore });
}
