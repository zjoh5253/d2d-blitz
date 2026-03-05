import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const interviewCreateSchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  cultureFit: z.coerce.number().int().min(1).max(5),
  workEthic: z.coerce.number().int().min(1).max(5),
  travelReadiness: z.coerce.number().int().min(1).max(5),
  performanceExpectations: z.coerce.number().int().min(1).max(5),
  notes: z.string().optional().or(z.literal("")),
  result: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  date: z.string().min(1, "Date is required"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId") ?? undefined;

    const interviews = await db.interview.findMany({
      where: { ...(leadId ? { leadId } : {}) },
      include: {
        lead: { select: { id: true, name: true } },
        interviewer: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(interviews);
  } catch (error) {
    console.error("[GET /api/interviews]", error);
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
    const parsed = interviewCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      leadId,
      cultureFit,
      workEthic,
      travelReadiness,
      performanceExpectations,
      notes,
      result,
      date,
    } = parsed.data;

    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const interview = await db.interview.create({
      data: {
        leadId,
        interviewerId: session.user.id,
        cultureFit,
        workEthic,
        travelReadiness,
        performanceExpectations,
        notes: notes || null,
        result,
        date: new Date(date),
      },
      include: {
        lead: { select: { id: true, name: true } },
        interviewer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(interview, { status: 201 });
  } catch (error) {
    console.error("[POST /api/interviews]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
