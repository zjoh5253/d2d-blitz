import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const leadCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  source: z.enum(["COLD", "SOCIAL", "REFERRAL", "PAID"]),
  travelCapable: z.boolean().default(false),
  commitmentLevel: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const source = searchParams.get("source") ?? undefined;
    const recruiterId = searchParams.get("recruiterId") ?? undefined;

    const leads = await db.lead.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(source ? { source: source as never } : {}),
        ...(recruiterId ? { recruiterId } : {}),
      },
      include: {
        recruiter: { select: { id: true, name: true } },
        fieldManager: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
        interviews: {
          orderBy: { date: "desc" },
          take: 1,
          select: { id: true, result: true, date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error("[GET /api/leads]", error);
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
    if (!["ADMIN", "RECRUITER", "FIELD_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = leadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, phone, email, source, travelCapable, commitmentLevel, notes } =
      parsed.data;

    const lead = await db.lead.create({
      data: {
        name,
        phone,
        email: email || null,
        source,
        travelCapable,
        commitmentLevel: commitmentLevel || null,
        notes: notes || null,
        recruiterId: session.user.id,
      },
      include: {
        recruiter: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("[POST /api/leads]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
