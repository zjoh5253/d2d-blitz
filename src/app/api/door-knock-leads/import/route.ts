import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  parseCSVText,
  parseXLSXBuffer,
  normalizeRow,
  generateUploadBatchId,
  type NormalizedLead,
} from "@/lib/lead-import"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const blitzId = formData.get("blitzId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

    let rows: Record<string, unknown>[]
    if (isXlsx) {
      const buf = Buffer.from(await file.arrayBuffer())
      rows = parseXLSXBuffer(buf)
    } else {
      const text = await file.text()
      rows = parseCSVText(text)
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in file" },
        { status: 400 }
      )
    }

    const uploadBatchId = generateUploadBatchId()
    const ctx = { uploadedById: session.user.id!, uploadBatchId, blitzId: blitzId || null }

    const leads = rows
      .map((r) => normalizeRow(r, ctx))
      .filter((x): x is NormalizedLead => x !== null)

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No valid address rows found. File must include either an 'Address' column or separate 'Street Number' + 'Street Name' columns." },
        { status: 400 }
      )
    }

    const result = await db.doorKnockLead.createMany({ data: leads })

    return NextResponse.json({
      imported: result.count,
      uploadBatchId,
      message: `Successfully imported ${result.count} leads`,
    })
  } catch (error) {
    console.error("[POST /api/door-knock-leads/import]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
