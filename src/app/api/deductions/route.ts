import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  repId: z.string().min(1, "repId is required"),
  blitzId: z.string().min(1, "blitzId is required"),
  category: z.enum(["HOUSING", "TRAVEL", "SHARED", "REP_SPECIFIC"]),
  amount: z.coerce
    .number()
    .positive("Must be greater than 0"),
  description: z.string().min(1, "description is required"),
  date: z.string().min(1, "date is required"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repId = searchParams.get("repId");
    const blitzId = searchParams.get("blitzId");
    const category = searchParams.get("category");

    const deductions = await db.deduction.findMany({
      where: {
        ...(repId ? { repId } : {}),
        ...(blitzId ? { blitzId } : {}),
        ...(category ? { category: category as "HOUSING" | "TRAVEL" | "SHARED" | "REP_SPECIFIC" } : {}),
      },
      orderBy: { date: "desc" },
      include: {
        rep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(deductions);
  } catch (error) {
    console.error("[GET /api/deductions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["ADMIN", "EXECUTIVE"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { repId, blitzId, category, amount, description, date } = parsed.data;

    // Verify rep and blitz exist
    const [rep, blitz] = await Promise.all([
      db.user.findUnique({ where: { id: repId } }),
      db.blitz.findUnique({ where: { id: blitzId } }),
    ]);

    if (!rep) {
      return NextResponse.json({ error: "Rep not found" }, { status: 404 });
    }
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 });
    }

    const deduction = await db.deduction.create({
      data: {
        repId,
        blitzId,
        category,
        amount,
        description,
        date: new Date(date),
      },
      include: {
        rep: { select: { id: true, name: true } },
        blitz: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(deduction, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deductions]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
