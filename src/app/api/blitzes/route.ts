import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { inventoryForZip, importScannerInventory } from "@/lib/blitz-area"
import { applyCustomerSuppression, getProviderCheckCounts } from "@/lib/leads/customer-suppression"

export const maxDuration = 300

const blitzCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  marketId: z.string().min(1, "Market is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  repCap: z.coerce.number().int().positive("Rep cap must be a positive integer"),
  housingPlan: z.string().optional().or(z.literal("")),
  managerId: z.string().min(1, "Manager is required"),
  sourceZip: z.string().regex(/^\d{5}$/, "Select a valid address inventory").optional(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const blitzes = await db.blitz.findMany({
      where: status && status !== "ALL" ? { status: status as never } : undefined,
      include: {
        market: {
          include: { carrier: true },
        },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { assignments: true, sales: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(blitzes)
  } catch (error) {
    console.error("[blitzes GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = blitzCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, marketId, startDate, endDate, repCap, housingPlan, managerId, sourceZip } = parsed.data

    const blitz = await db.blitz.create({
      data: {
        name,
        marketId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        repCap,
        housingPlan: housingPlan || null,
        managerId,
        status: "PLANNING",
      },
      include: {
        market: { include: { carrier: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    })

    if (!sourceZip) {
      return NextResponse.json(blitz, { status: 201 })
    }

    const isKineticMarket = blitz.market.carrier.name.toLowerCase().includes("kinetic")

    // Cheap cache check — NO discovery here. Slow address-pulling (OSM) must
    // never run inside the create request (it would time out the function).
    const inv = await inventoryForZip(sourceZip)

    if (!inv || inv.addressCount === 0) {
      // DEFERRED: no pre-loaded inventory for this ZIP. Record the ZIP and let
      // the background prep (list-view poll + cron) pull addresses via the OSM
      // fallback, then filter. Create returns instantly.
      await db.blitz.update({
        where: { id: blitz.id },
        data: {
          leadPrepStatus: "FILTERING",
          leadPrepZip: sourceZip,
          leadPrepSource: "osm",
          leadPrepTotal: 0,
          leadPrepChecked: 0,
          leadPrepUpdatedAt: new Date(),
        },
      })
      return NextResponse.json({
        ...blitz,
        leadPrepStatus: "FILTERING",
        preparation: { deferred: true, source: "osm", imported: 0, suppressed: 0 },
      }, { status: 201 })
    }

    // CACHED PATH: full inventory exists — import now (fast SQL) + filter state.
    let inventory
    try {
      inventory = await importScannerInventory({
        zip: sourceZip,
        blitzId: blitz.id,
        uploadedById: session.user.id!,
      })
    } catch (error) {
      await db.blitz.delete({ where: { id: blitz.id } }).catch(() => undefined)
      throw error
    }
    if (inventory.imported === 0) {
      await db.blitz.delete({ where: { id: blitz.id } })
      return NextResponse.json(
        { error: "No complete addresses are currently loaded for that ZIP" },
        { status: 409 }
      )
    }

    let suppressed = 0
    try {
      const suppression = await applyCustomerSuppression({ blitzId: blitz.id })
      suppressed = suppression.updated
    } catch (error) {
      console.error("[blitzes POST suppression]", error)
    }

    // A Kinetic blitz with addresses still needing a provider check starts
    // FILTERING (staffing blocked until READY); everything else is READY now.
    let prepStatus: "READY" | "FILTERING" = "READY"
    let prepCounts = { total: 0, checked: 0, pending: 0 }
    if (isKineticMarket) {
      prepCounts = await getProviderCheckCounts(blitz.id)
      prepStatus = prepCounts.pending > 0 ? "FILTERING" : "READY"
    }
    await db.blitz.update({
      where: { id: blitz.id },
      data: {
        leadPrepStatus: prepStatus,
        leadPrepTotal: prepCounts.total,
        leadPrepChecked: prepCounts.checked,
        leadPrepUpdatedAt: new Date(),
        leadPrepSource: "openaddresses",
        leadPrepZip: null,
      },
    })

    return NextResponse.json({
      ...blitz,
      leadPrepStatus: prepStatus,
      preparation: {
        imported: inventory.imported,
        suppressed,
        readyToScan: inventory.imported - suppressed,
        uploadBatchId: inventory.uploadBatchId,
        source: "openaddresses",
        leadPrepStatus: prepStatus,
        leadPrepTotal: prepCounts.total,
        leadPrepChecked: prepCounts.checked,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("[blitzes POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
