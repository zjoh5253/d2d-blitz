import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const expenseCreateSchema = z.object({
  category: z.enum(["HOUSING", "TRAVEL", "OPERATIONAL", "OTHER"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const expenses = await db.blitzExpense.findMany({
      where: { blitzId: id },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("[expenses GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = expenseCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { category, amount, description, date } = parsed.data

    const blitz = await db.blitz.findUnique({ where: { id }, select: { id: true } })
    if (!blitz) {
      return NextResponse.json({ error: "Blitz not found" }, { status: 404 })
    }

    const expense = await db.blitzExpense.create({
      data: {
        blitzId: id,
        category,
        amount,
        description,
        date: new Date(date),
      },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("[expenses POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
