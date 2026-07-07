import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

// Kinetic availability intelligence — read model over kinetic_address_status.
//
// Every "worth knocking?" check + the background trickle writes a full row to
// kinetic_address_status (all signals + raw JSON + checkedAt). This endpoint
// surfaces that captured data: a summary, a per-ZIP rollup, and filtered lists
// (notably "coming soon" — future-market intel). CSV export is intentionally
// the same shape the map-scanner's importers consume, so this is the handoff
// point for tying Kinetic availability into the monopoly scanner down the line.
//
//   GET /api/kinetic/intel?status=coming_soon&format=csv&zip=44087
//   status: all | worth | customer | coming_soon | unserviceable  (default all)
//   format: json | csv                                            (default json)

type StatusKey = "all" | "worth" | "customer" | "coming_soon" | "unserviceable"

// Mutually-exclusive verdict for a row, mirroring the rep-app banner logic:
// customer > worth(serviceable) > coming_soon > unserviceable.
function verdictOf(r: { serviceable: boolean; isCustomer: boolean; comingSoon: boolean }): Exclude<StatusKey, "all"> {
  if (r.isCustomer) return "customer"
  if (r.serviceable) return "worth"
  if (r.comingSoon) return "coming_soon"
  return "unserviceable"
}

// addressKey is "<canonical street>|<zip5>".
function splitKey(key: string): { street: string; zip: string } {
  const i = key.lastIndexOf("|")
  if (i < 0) return { street: key, zip: "" }
  return { street: key.slice(0, i), zip: key.slice(i + 1) }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

function csvCell(v: string | number | boolean | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user || !(role === "ADMIN" || role === "FIELD_MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get("status") ?? "all") as StatusKey
  const format = searchParams.get("format") ?? "json"
  const zipFilter = (searchParams.get("zip") ?? "").trim()

  const rows = await db.kineticAddressStatus.findMany({
    select: {
      addressKey: true,
      serviceable: true,
      isCustomer: true,
      comingSoon: true,
      maxQual: true,
      techType: true,
      estCompletionDt: true,
      checkedAt: true,
    },
    orderBy: { checkedAt: "desc" },
  })

  const enriched = rows.map((r) => {
    const { street, zip } = splitKey(r.addressKey)
    return { ...r, street: titleCase(street), zip, verdict: verdictOf(r) }
  })

  const filtered = enriched.filter(
    (r) => (status === "all" || r.verdict === status) && (!zipFilter || r.zip === zipFilter)
  )

  if (format === "csv") {
    const header = ["address", "zip", "verdict", "serviceable", "is_customer", "coming_soon", "max_qual", "tech_type", "est_completion", "checked_at"]
    const lines = [header.join(",")]
    for (const r of filtered) {
      lines.push([
        csvCell(r.street), csvCell(r.zip), csvCell(r.verdict),
        csvCell(r.serviceable), csvCell(r.isCustomer), csvCell(r.comingSoon),
        csvCell(r.maxQual), csvCell(r.techType), csvCell(r.estCompletionDt),
        csvCell(r.checkedAt.toISOString()),
      ].join(","))
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="kinetic-intel-${status}.csv"`,
      },
    })
  }

  return NextResponse.json({
    total: enriched.length,
    rows: filtered.slice(0, 5000),
  })
}
