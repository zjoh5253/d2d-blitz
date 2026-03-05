import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseISO } from "date-fns"
type SaleStatus =
  | "SUBMITTED"
  | "PENDING_INSTALL"
  | "INSTALLED"
  | "VERIFIED"
  | "CANCELLED"
  | "DISPUTED"

type RouteParams = { params: Promise<{ id: string }> }

const validStatuses: SaleStatus[] = [
  "SUBMITTED",
  "PENDING_INSTALL",
  "INSTALLED",
  "VERIFIED",
  "CANCELLED",
  "DISPUTED",
]

const updateSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  customerAddress: z.string().min(1).optional(),
  customerEmail: z
    .string()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  installDate: z.string().optional(),
  orderConfirmation: z.string().optional().or(z.literal("")),
  status: z
    .enum([
      "SUBMITTED",
      "PENDING_INSTALL",
      "INSTALLED",
      "VERIFIED",
      "CANCELLED",
      "DISPUTED",
    ])
    .optional(),
  cancellationReason: z.string().optional(),
})

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const sale = await db.sale.findUnique({
      where: { id },
      include: {
        carrier: true,
        blitz: { include: { market: true } },
        rep: { select: { id: true, name: true } },
        commissionRecord: { include: { governanceTier: true } },
        matchedInstallRecord: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && sale.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error("[GET /api/sales/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const sale = await db.sale.findUnique({ where: { id } })

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    }

    const isManager =
      session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
    if (!isManager && sale.repId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { installDate, status, cancellationReason, ...rest } = parsed.data

    // Validate status transitions
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      )
    }

    // Require cancellation reason when cancelling
    if (status === "CANCELLED" && !cancellationReason) {
      return NextResponse.json(
        { error: "Cancellation reason is required when cancelling a sale." },
        { status: 400 }
      )
    }

    // Non-managers cannot set sale to VERIFIED or change certain statuses
    if (!isManager && status && ["VERIFIED", "INSTALLED"].includes(status)) {
      return NextResponse.json(
        { error: "You do not have permission to set this status." },
        { status: 403 }
      )
    }

    const updated = await db.sale.update({
      where: { id },
      data: {
        ...rest,
        customerEmail: rest.customerEmail || null,
        orderConfirmation: rest.orderConfirmation || null,
        ...(installDate ? { installDate: parseISO(installDate) } : {}),
        ...(status ? { status } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PUT /api/sales/[id]]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
