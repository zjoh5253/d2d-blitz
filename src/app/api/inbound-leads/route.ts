import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createLeadSchema = z.object({
  source: z.string().min(1, "Source is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  qualificationNotes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // If filtering by agent, look at contact attempts
    const leads = await db.inboundLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contactAttempts: {
          orderBy: { attemptDate: "desc" },
          take: 1,
          include: {
            agent: { select: { id: true, name: true } },
          },
        },
        _count: { select: { contactAttempts: true } },
      },
    });

    // Filter by agentId if provided (agent who made last contact)
    const filtered = agentId
      ? leads.filter((l) =>
          l.contactAttempts.some((ca) => ca.agentId === agentId)
        )
      : leads;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("[GET /api/inbound-leads]", error);
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

    const body = await request.json();
    const data = createLeadSchema.parse(body);

    const lead = await db.inboundLead.create({
      data: {
        source: data.source,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || null,
        qualificationNotes: data.qualificationNotes || null,
        status: "NEW",
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[POST /api/inbound-leads]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
