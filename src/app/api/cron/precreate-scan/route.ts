import { NextRequest, NextResponse } from "next/server"
import { scanKineticScannerPool } from "@/lib/kinetic/scanner-pool"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 })
  }

  const auth = request.headers.get("authorization")
  const token = new URL(request.url).searchParams.get("token")
  if (auth !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? process.env.PRECREATE_KINETIC_SCAN_BATCH ?? "300", 10) || 300))
  const concurrency = Math.min(30, Math.max(1, parseInt(url.searchParams.get("concurrency") ?? process.env.PRECREATE_KINETIC_SCAN_CONCURRENCY ?? "20", 10) || 20))
  const zipParam = url.searchParams.get("zip")
  const zipCodes = zipParam
    ?.split(",")
    .map((zip) => zip.replace(/\D/g, "").slice(0, 5))
    .filter((zip) => zip.length === 5)

  const result = await scanKineticScannerPool({ limit, concurrency, zipCodes })
  return NextResponse.json({ ok: true, ...result })
}
