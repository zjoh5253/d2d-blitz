import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const expenseUpdateSchema = z.object({
  category: z.enum(["HOUSING", "TRAVEL", "OPERATIONAL", "OTHER"]).optional(),
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  description: z.string().min(1, "Description is required").optional(),
  date: z.string().min(1, "Date is required").optional(),
})

type RouteParams = { params: Promise<{ id: string; expenseId: string }> }

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, expenseId } = await params
    const body = await request.json()
    const parsed = expenseUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.blitzExpense.findUnique({
      where: { id: expenseId },
      select: { blitzId: true },
    })
    if (!existing || existing.blitzId !== id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const { date, ...rest } = parsed.data
    const updated = await db.blitzExpense.update({
      where: { id: expenseId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[expenses PUT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, expenseId } = await params
    const existing = await db.blitzExpense.findUnique({
      where: { id: expenseId },
      select: { blitzId: true },
    })
    if (!existing || existing.blitzId !== id) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    await db.blitzExpense.delete({ where: { id: expenseId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[expenses DELETE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
