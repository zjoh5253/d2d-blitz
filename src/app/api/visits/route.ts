import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createVisitSchema = z.object({
  address: z.string().min(1, "Address is required"),
  outcome: z.enum(["NOT_HOME", "NOT_INTERESTED", "CALLBACK", "SALE"]),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createVisitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, teamId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const visit = await db.visit.create({
    data: {
      repId: user.id,
      teamId: user.teamId ?? null,
      address: parsed.data.address,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json(visit, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as string;
  const isManager = ["ADMIN", "FIELD_MANAGER", "EXECUTIVE", "MARKET_OWNER"].includes(role);

  const { searchParams } = new URL(req.url);
  const repId = searchParams.get("repId");
  const date = searchParams.get("date"); // YYYY-MM-DD

  const where: Record<string, unknown> = {};

  if (isManager) {
    if (repId) where.repId = repId;
  } else {
    where.repId = session.user.id;
  }

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  const visits = await db.visit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      rep: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  return NextResponse.json(visits);
}
