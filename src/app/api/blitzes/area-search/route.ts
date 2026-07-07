import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { searchBlitzAreas } from "@/lib/blitz-area"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (query.length < 2) {
    return NextResponse.json({ error: "Enter a town or 5-digit ZIP" }, { status: 400 })
  }

  try {
    const candidates = await searchBlitzAreas(query)
    return NextResponse.json({ candidates })
  } catch (error) {
    console.error("[blitz area search]", error)
    return NextResponse.json({ error: "Could not search that area" }, { status: 502 })
  }
}
