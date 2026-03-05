import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateLeadSchema = z.object({
  source: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().or(z.literal("")).optional(),
  qualificationNotes: z.string().optional(),
  status: z
    .enum(["NEW", "CONTACTED", "SUBMITTED", "INSTALLED", "VERIFIED"])
    .optional(),
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

    const lead = await db.inboundLead.findUnique({
      where: { id },
      include: {
        contactAttempts: {
          orderBy: { attemptDate: "desc" },
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
        inboundSales: {
          include: {
            carrier: { select: { id: true, name: true } },
            agent: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("[GET /api/inbound-leads/[id]]", error);
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

    const { id } = await params;
    const body = await request.json();
    const data = updateLeadSchema.parse(body);

    const lead = await db.inboundLead.update({
      where: { id },
      data: {
        ...(data.source !== undefined && { source: data.source }),
        ...(data.customerName !== undefined && {
          customerName: data.customerName,
        }),
        ...(data.customerPhone !== undefined && {
          customerPhone: data.customerPhone,
        }),
        ...(data.customerEmail !== undefined && {
          customerEmail: data.customerEmail || null,
        }),
        ...(data.qualificationNotes !== undefined && {
          qualificationNotes: data.qualificationNotes,
        }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[PUT /api/inbound-leads/[id]]", error);
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

    const { id } = await params;

    await db.inboundLead.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/inbound-leads/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
