import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createInboundSaleSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  carrierId: z.string().min(1, "Carrier ID is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerAddress: z.string().min(1, "Customer address is required"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  installDate: z.string().min(1, "Install date is required"),
  orderConfirmation: z.string().optional(),
  affiliateId: z.string().optional(),
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
    if (agentId) where.agentId = agentId;

    const sales = await db.inboundSale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        lead: {
          select: { id: true, customerName: true, source: true },
        },
        agent: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
        affiliate: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(sales);
  } catch (error) {
    console.error("[GET /api/inbound-sales]", error);
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
    const data = createInboundSaleSchema.parse(body);

    // Verify lead exists
    const lead = await db.inboundLead.findUnique({
      where: { id: data.leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const sale = await db.inboundSale.create({
      data: {
        leadId: data.leadId,
        agentId: session.user.id,
        carrierId: data.carrierId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        customerEmail: data.customerEmail || null,
        installDate: new Date(data.installDate),
        orderConfirmation: data.orderConfirmation || null,
        affiliateId: data.affiliateId || null,
        status: "SUBMITTED",
      },
      include: {
        lead: { select: { id: true, customerName: true } },
        agent: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
      },
    });

    // Update lead status to SUBMITTED
    await db.inboundLead.update({
      where: { id: data.leadId },
      data: { status: "SUBMITTED" },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[POST /api/inbound-sales]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
