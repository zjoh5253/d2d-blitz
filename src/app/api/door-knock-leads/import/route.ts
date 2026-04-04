import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ""
    })
    rows.push(row)
  }
  return rows
}

function extractCityState(raw: string): { city: string; state: string } {
  // Handle formats like "WAYCROSS, GA" or "Waycross, GA"
  const parts = raw.split(",").map((p) => p.trim())
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] }
  }
  return { city: raw.trim(), state: "" }
}

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

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in CSV" },
        { status: 400 }
      )
    }

    const uploadBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // Map CSV columns to our model — flexible matching
    const leads = rows
      .map((row) => {
        const streetNumber =
          row["street number"] || row["streetnumber"] || row["street_number"] || row["address number"] || ""
        const streetName =
          row["street name"] || row["streetname"] || row["street_name"] || row["street"] || ""

        if (!streetNumber && !streetName) return null

        // Try to extract city/state from a combined field or separate fields
        let city = row["city"] || ""
        let state = row["state"] || ""

        // If city contains state (e.g., "WAYCROSS, GA"), split it
        if (city.includes(",")) {
          const extracted = extractCityState(city)
          city = extracted.city
          state = state || extracted.state
        }

        return {
          firstName: row["first name"] || row["firstname"] || row["first_name"] || null,
          lastName: row["last name"] || row["lastname"] || row["last_name"] || null,
          streetNumber,
          streetName,
          city,
          state,
          zip: row["zip"] || row["zipcode"] || row["zip code"] || row["zip_code"] || row["postal"] || "",
          notes: row["notes"] || null,
          disposition: "PENDING" as const,
          uploadedById: session.user.id!,
          uploadBatchId,
          blitzId: blitzId || null,
        }
      })
      .filter(Boolean) as Array<{
        firstName: string | null
        lastName: string | null
        streetNumber: string
        streetName: string
        city: string
        state: string
        zip: string
        notes: string | null
        disposition: "PENDING"
        uploadedById: string
        uploadBatchId: string
        blitzId: string | null
      }>

    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No valid address rows found. Check that your CSV has 'Street Number' and 'Street Name' columns." },
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
