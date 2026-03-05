import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateInboundSaleSchema = z.object({
  status: z
    .enum([
      "SUBMITTED",
      "PENDING_INSTALL",
      "INSTALLED",
      "VERIFIED",
      "CANCELLED",
    ])
    .optional(),
  orderConfirmation: z.string().optional(),
  installDate: z.string().optional(),
  customerAddress: z.string().optional(),
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

    const sale = await db.inboundSale.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            customerName: true,
            source: true,
            status: true,
          },
        },
        agent: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
        affiliate: { select: { id: true, name: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("[GET /api/inbound-sales/[id]]", error);
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
    const data = updateInboundSaleSchema.parse(body);

    const sale = await db.inboundSale.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.orderConfirmation !== undefined && {
          orderConfirmation: data.orderConfirmation,
        }),
        ...(data.installDate !== undefined && {
          installDate: new Date(data.installDate),
        }),
        ...(data.customerAddress !== undefined && {
          customerAddress: data.customerAddress,
        }),
      },
      include: {
        lead: { select: { id: true, customerName: true } },
        agent: { select: { id: true, name: true } },
        carrier: { select: { id: true, name: true } },
      },
    });

    // Sync lead status if sale status advances
    if (data.status === "INSTALLED") {
      await db.inboundLead.update({
        where: { id: sale.leadId },
        data: { status: "INSTALLED" },
      });
    } else if (data.status === "VERIFIED") {
      await db.inboundLead.update({
        where: { id: sale.leadId },
        data: { status: "VERIFIED" },
      });
    }

    return NextResponse.json(sale);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[PUT /api/inbound-sales/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
