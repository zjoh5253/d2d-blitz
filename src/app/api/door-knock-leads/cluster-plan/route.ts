import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { clusterLeads } from "@/lib/cluster-leads";

const bodySchema = z.object({
  blitzId: z.string().min(1),
  numReps: z.number().int().min(1).max(50),
  // Optional: drives the "days-of-work" hint in the UI summary.
  numDays: z.number().int().min(1).max(60).optional(),
  // Optional: cluster only currently-unassigned leads (default), or
  // include already-assigned ones too if the admin wants to re-plan.
  includeAssigned: z.boolean().optional(),
  // Optional: when one rep drops out mid-blitz, pull only their
  // remaining PENDING leads and redistribute across the others. Set to
  // a rep's userId to scope the lead pool to that rep's unfinished work.
  sourceRepId: z.string().optional(),
});

const DOORS_PER_REP_PER_DAY = 100;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { blitzId, numReps, numDays, includeAssigned, sourceRepId } = parsed.data;

    // Pull all leads for this blitz that have coordinates.
    const where: {
      blitzId: string;
      lat: { not: null };
      lng: { not: null };
      assignedRepId?: null | string;
      disposition?: "PENDING";
    } = {
      blitzId,
      lat: { not: null },
      lng: { not: null },
    };
    if (sourceRepId) {
      // Rep dropped out: redistribute only their unfinished work.
      where.assignedRepId = sourceRepId;
      where.disposition = "PENDING";
    } else if (!includeAssigned) {
      where.assignedRepId = null;
    }

    const leads = await db.doorKnockLead.findMany({
      where,
      select: { id: true, lat: true, lng: true, streetName: true },
    });

    if (leads.length === 0) {
      return NextResponse.json({
        clusters: [],
        totalLeads: 0,
        leadsPerRep: 0,
        skippedNoCoords: 0,
        warning: includeAssigned
          ? "No leads with coordinates found for this blitz."
          : "No unassigned leads with coordinates found for this blitz.",
      });
    }

    // Report how many were left out for missing coords so the admin
    // knows what fraction of the blitz they're planning.
    const skipped = await db.doorKnockLead.count({
      where: {
        blitzId,
        OR: [{ lat: null }, { lng: null }],
        ...(sourceRepId
          ? { assignedRepId: sourceRepId, disposition: "PENDING" }
          : includeAssigned
          ? {}
          : { assignedRepId: null }),
      },
    });

    const points = leads.map((l) => ({ id: l.id, lat: l.lat!, lng: l.lng! }));
    const clusters = clusterLeads(points, numReps);

    // Per-cluster top streets — useful for the admin to recognize the
    // neighborhood from the table without opening the map.
    // Also enrich each per-lead point with its street name so the map
    // hover popup is meaningful.
    const streetsByLead = new Map(leads.map((l) => [l.id, l.streetName]));
    const enriched = clusters.map((c) => {
      const counts = new Map<string, number>();
      for (const id of c.leadIds) {
        const s = streetsByLead.get(id) ?? "";
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
      const topStreets = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([street, n]) => `${street} (${n})`);
      const target = numDays ? numDays * DOORS_PER_REP_PER_DAY : null;
      return {
        ...c,
        leadCount: c.leadIds.length,
        topStreets,
        daysAtTarget: target ? c.leadIds.length / DOORS_PER_REP_PER_DAY : null,
        overTarget: target !== null && c.leadIds.length > target,
        points: c.points.map((p) => ({
          ...p,
          street: streetsByLead.get(p.id) ?? "",
        })),
      };
    });

    return NextResponse.json({
      clusters: enriched,
      totalLeads: leads.length,
      leadsPerRep: Math.round(leads.length / numReps),
      skippedNoCoords: skipped,
      doorsPerRepPerDay: DOORS_PER_REP_PER_DAY,
    });
  } catch (error) {
    console.error("[POST /api/door-knock-leads/cluster-plan]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
