import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const interviewUpdateSchema = z.object({
  cultureFit: z.coerce.number().int().min(1).max(5).optional(),
  workEthic: z.coerce.number().int().min(1).max(5).optional(),
  travelReadiness: z.coerce.number().int().min(1).max(5).optional(),
  performanceExpectations: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().optional().or(z.literal("")),
  result: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  date: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, email: true, phone: true } },
        interviewer: { select: { id: true, name: true } },
      },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    return NextResponse.json(interview);
  } catch (error) {
    console.error("[GET /api/interviews/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "RECRUITER", "FIELD_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const interview = await db.interview.findUnique({ where: { id } });
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = interviewUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { cultureFit, workEthic, travelReadiness, performanceExpectations, notes, result, date } =
      parsed.data;

    const updated = await db.interview.update({
      where: { id },
      data: {
        ...(cultureFit !== undefined ? { cultureFit } : {}),
        ...(workEthic !== undefined ? { workEthic } : {}),
        ...(travelReadiness !== undefined ? { travelReadiness } : {}),
        ...(performanceExpectations !== undefined ? { performanceExpectations } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(result ? { result } : {}),
        ...(date ? { date: new Date(date) } : {}),
      },
      include: {
        lead: { select: { id: true, name: true } },
        interviewer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/interviews/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
