import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const leadUpdateSchema = z.object({
  status: z
    .enum(["NEW", "SCREENING", "INTERVIEW", "APPROVED", "REJECTED", "ONBOARDED"])
    .optional(),
  fieldManagerId: z.string().optional().or(z.literal("")),
  marketId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  commitmentLevel: z.string().optional().or(z.literal("")),
  travelCapable: z.boolean().optional(),
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

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        fieldManager: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
        interviews: {
          orderBy: { date: "desc" },
          include: {
            interviewer: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("[GET /api/leads/[id]]", error);
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

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = leadUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, fieldManagerId, marketId, notes, commitmentLevel, travelCapable } =
      parsed.data;

    // If transitioning to ONBOARDED, create a FIELD_REP user
    if (status === "ONBOARDED" && lead.status !== "ONBOARDED") {
      const existingUser = await db.user.findUnique({
        where: { email: lead.email ?? `${id}@placeholder.local` },
      });

      if (!existingUser && lead.email) {
        const tempPassword = Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        await db.user.create({
          data: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            role: "FIELD_REP",
            status: "ACTIVE",
            passwordHash,
          },
        });
      }
    }

    const updated = await db.lead.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(fieldManagerId !== undefined
          ? { fieldManagerId: fieldManagerId || null }
          : {}),
        ...(marketId !== undefined ? { marketId: marketId || null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(commitmentLevel !== undefined
          ? { commitmentLevel: commitmentLevel || null }
          : {}),
        ...(travelCapable !== undefined ? { travelCapable } : {}),
      },
      include: {
        recruiter: { select: { id: true, name: true } },
        fieldManager: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PUT /api/leads/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await db.lead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/leads/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
