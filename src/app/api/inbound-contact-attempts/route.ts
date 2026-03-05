import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createAttemptSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  outcome: z.enum([
    "NO_ANSWER",
    "VOICEMAIL",
    "SPOKE",
    "QUALIFIED",
    "NOT_INTERESTED",
  ]),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");

    const where: Record<string, unknown> = {};
    if (leadId) where.leadId = leadId;

    const attempts = await db.inboundContactAttempt.findMany({
      where,
      orderBy: { attemptDate: "desc" },
      include: {
        agent: { select: { id: true, name: true } },
        lead: { select: { id: true, customerName: true } },
      },
    });

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("[GET /api/inbound-contact-attempts]", error);
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
    const data = createAttemptSchema.parse(body);

    // Verify the lead exists
    const lead = await db.inboundLead.findUnique({
      where: { id: data.leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const attempt = await db.inboundContactAttempt.create({
      data: {
        leadId: data.leadId,
        agentId: session.user.id,
        attemptDate: new Date(),
        outcome: data.outcome,
        notes: data.notes || null,
      },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    // Auto-update lead status based on outcome
    let newStatus = lead.status;
    if (data.outcome === "SPOKE" || data.outcome === "QUALIFIED") {
      if (lead.status === "NEW") {
        newStatus = "CONTACTED";
      }
    }

    if (newStatus !== lead.status) {
      await db.inboundLead.update({
        where: { id: data.leadId },
        data: { status: newStatus },
      });
    }

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[POST /api/inbound-contact-attempts]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
