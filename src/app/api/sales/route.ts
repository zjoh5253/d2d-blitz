import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseISO, subDays, startOfDay, endOfDay } from "date-fns"
type SaleStatus =
  | "SUBMITTED"
  | "PENDING_INSTALL"
  | "INSTALLED"
  | "VERIFIED"
  | "CANCELLED"
  | "DISPUTED"

const saleSchema = z.object({
  blitzId: z.string().min(1, "Blitz is required"),
  carrierId: z.string().min(1, "Carrier is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerAddress: z.string().min(1, "Customer address is required"),
  customerEmail: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  installDate: z.string().min(1, "Install date is required"),
  orderConfirmation: z.string().optional().or(z.literal("")),
})

const validStatuses: SaleStatus[] = [
  "SUBMITTED",
  "PENDING_INSTALL",
  "INSTALLED",
  "VERIFIED",
  "CANCELLED",
  "DISPUTED",
]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const repIdParam = searchParams.get("repId")
    const blitzIdParam = searchParams.get("blitzId")
    const statusParam = searchParams.get("status") as SaleStatus | null
    const startParam = searchParams.get("startDate")
    const endParam = searchParams.get("endDate")

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    const repId =
      isManager && repIdParam ? repIdParam : session.user.id

    const where: Record<string, unknown> = { repId }

    if (blitzIdParam) {
      where.blitzId = blitzIdParam
    }

    if (statusParam && validStatuses.includes(statusParam)) {
      where.status = statusParam
    }

    if (startParam || endParam) {
      const dateFilter: Record<string, Date> = {}
      if (startParam) dateFilter.gte = startOfDay(parseISO(startParam))
      if (endParam) dateFilter.lte = endOfDay(parseISO(endParam))
      where.submittedAt = dateFilter
    }

    const sales = await db.sale.findMany({
      where,
      include: {
        carrier: true,
        blitz: true,
        rep: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    })

    return NextResponse.json(sales)
  } catch (error) {
    console.error("[GET /api/sales]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = saleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      blitzId,
      carrierId,
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      installDate,
      orderConfirmation,
    } = parsed.data

    const repId = session.user.id

    // Verify the rep is assigned to this blitz
    const assignment = await db.blitzAssignment.findFirst({
      where: { repId, blitzId },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "You are not assigned to this blitz." },
        { status: 403 }
      )
    }

    // Duplicate detection: check for existing sale at same address within 30 days
    const thirtyDaysAgo = subDays(new Date(), 30)
    const duplicate = await db.sale.findFirst({
      where: {
        customerAddress: {
          equals: customerAddress,
          mode: "insensitive",
        },
        submittedAt: { gte: thirtyDaysAgo },
        status: { notIn: ["CANCELLED"] },
      },
    })

    if (duplicate) {
      return NextResponse.json(
        {
          error: `A sale already exists at "${customerAddress}" submitted on ${duplicate.submittedAt.toLocaleDateString()}. Please verify this is not a duplicate.`,
          duplicateSaleId: duplicate.id,
        },
        { status: 409 }
      )
    }

    const sale = await db.sale.create({
      data: {
        repId,
        blitzId,
        carrierId,
        customerName,
        customerPhone,
        customerAddress,
        customerEmail: customerEmail || null,
        installDate: parseISO(installDate),
        orderConfirmation: orderConfirmation || null,
      },
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error("[POST /api/sales]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
