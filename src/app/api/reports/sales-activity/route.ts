import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Sales & Activity report — read model over door-knock dispositions.
//
// Every disposition action a rep logs writes one DoorKnockLeadEvent row
// (see /api/door-knock-leads/[id]). This endpoint rolls those events up into
// per-rep / per-blitz activity + sales metrics and can return them as JSON
// (for the on-screen preview) or as a downloadable CSV.
//
//   GET /api/reports/sales-activity
//     ?startDate=2026-06-01&endDate=2026-06-22   (defaults: last 30 days)
//     &blitzId=<id>     filter to one blitz (also the "team" selector)
//     &repId=<id>       filter to one rep
//     &groupBy=blitz|rep|team|dataset            (default blitz)
//     &format=json|csv                           (default json)
//
// Metrics are event-based (one knock = one disposition action). A knock is
// attributed to the lead's assigned rep and the lead's blitz. Conversion =
// sales / logged doors for that group.

const ALLOWED_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

type GroupBy = "blitz" | "rep" | "team" | "dataset";

const NO_BLITZ = "(no blitz)";
const UNASSIGNED = "(unassigned)";

interface Metrics {
  loggedDoors: number;
  salesSubmitted: number;
  notInterested: number;
  goBacks: number;
  notHome: number;
}

interface Cell extends Metrics {
  blitzId: string | null;
  repId: string | null;
  blitzArea: string;
  repName: string;
}

// A row in the output table. `kind` lets the preview + CSV style subtotal /
// total rows distinctly from ordinary data rows.
interface Row extends Metrics {
  kind: "data" | "subtotal" | "total";
  blitzArea: string;
  repName: string;
  conversionRate: string;
}

function emptyMetrics(): Metrics {
  return {
    loggedDoors: 0,
    salesSubmitted: 0,
    notInterested: 0,
    goBacks: 0,
    notHome: 0,
  };
}

function addInto(target: Metrics, src: Metrics) {
  target.loggedDoors += src.loggedDoors;
  target.salesSubmitted += src.salesSubmitted;
  target.notInterested += src.notInterested;
  target.goBacks += src.goBacks;
  target.notHome += src.notHome;
}

function conversion(m: Metrics): string {
  if (m.loggedDoors === 0) return "0.0%";
  return ((m.salesSubmitted / m.loggedDoors) * 100).toFixed(1) + "%";
}

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const groupBy = (searchParams.get("groupBy") ?? "blitz") as GroupBy;
    const format = searchParams.get("format") ?? "json";
    const blitzId = searchParams.get("blitzId")?.trim() || null;
    const repId = searchParams.get("repId")?.trim() || null;

    // Date range — default to the trailing 30 days when unspecified.
    const now = new Date();
    const endParam = searchParams.get("endDate");
    const startParam = searchParams.get("startDate");
    const end = endParam ? new Date(endParam) : new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = startParam
      ? new Date(startParam)
      : new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    const where: Prisma.DoorKnockLeadEventWhereInput = {
      // PENDING is the initial lead state, not a knock — exclude it.
      disposition: { not: "PENDING" },
      createdAt: { gte: start, lte: end },
      lead: {
        ...(blitzId ? { blitzId } : {}),
        ...(repId ? { assignedRepId: repId } : {}),
      },
    };

    const events = await db.doorKnockLeadEvent.findMany({
      where,
      select: {
        disposition: true,
        lead: { select: { blitzId: true, assignedRepId: true } },
      },
    });

    // Roll events up into per-(blitz, rep) cells.
    const cells = new Map<string, Cell>();
    for (const ev of events) {
      const bId = ev.lead.blitzId ?? null;
      const rId = ev.lead.assignedRepId ?? null;
      const key = `${bId ?? "_"}|${rId ?? "_"}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          blitzId: bId,
          repId: rId,
          blitzArea: "",
          repName: "",
          ...emptyMetrics(),
        };
        cells.set(key, cell);
      }
      cell.loggedDoors += 1;
      switch (ev.disposition) {
        case "SOLD":
          cell.salesSubmitted += 1;
          break;
        case "NOT_INTERESTED":
          cell.notInterested += 1;
          break;
        case "GO_BACK":
          cell.goBacks += 1;
          break;
        case "NOT_HOME":
          cell.notHome += 1;
          break;
      }
    }

    const cellList = Array.from(cells.values());

    // Resolve names for the blitz / rep ids that actually appear.
    const blitzIds = [
      ...new Set(cellList.map((c) => c.blitzId).filter(Boolean)),
    ] as string[];
    const repIds = [
      ...new Set(cellList.map((c) => c.repId).filter(Boolean)),
    ] as string[];

    const [blitzes, reps] = await Promise.all([
      blitzIds.length
        ? db.blitz.findMany({
            where: { id: { in: blitzIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      repIds.length
        ? db.user.findMany({
            where: { id: { in: repIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const blitzName = new Map(blitzes.map((b) => [b.id, b.name]));
    const repName = new Map(reps.map((r) => [r.id, r.name ?? r.id]));

    for (const c of cellList) {
      c.blitzArea = c.blitzId ? blitzName.get(c.blitzId) ?? c.blitzId : NO_BLITZ;
      c.repName = c.repId ? repName.get(c.repId) ?? c.repId : UNASSIGNED;
    }

    // Build the output rows according to the requested grouping.
    const rows: Row[] = [];
    const grandTotal = emptyMetrics();
    cellList.forEach((c) => addInto(grandTotal, c));

    const toDataRow = (
      blitzArea: string,
      repNameVal: string,
      m: Metrics
    ): Row => ({
      kind: "data",
      blitzArea,
      repName: repNameVal,
      ...m,
      conversionRate: conversion(m),
    });

    if (groupBy === "blitz") {
      const byBlitz = new Map<string, { area: string; m: Metrics }>();
      for (const c of cellList) {
        const k = c.blitzId ?? "_";
        let g = byBlitz.get(k);
        if (!g) {
          g = { area: c.blitzArea, m: emptyMetrics() };
          byBlitz.set(k, g);
        }
        addInto(g.m, c);
      }
      [...byBlitz.values()]
        .sort((a, b) => a.area.localeCompare(b.area))
        .forEach((g) => rows.push(toDataRow(g.area, "(all reps)", g.m)));
    } else if (groupBy === "rep") {
      const byRep = new Map<string, { name: string; m: Metrics }>();
      for (const c of cellList) {
        const k = c.repId ?? "_";
        let g = byRep.get(k);
        if (!g) {
          g = { name: c.repName, m: emptyMetrics() };
          byRep.set(k, g);
        }
        addInto(g.m, c);
      }
      [...byRep.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((g) => rows.push(toDataRow("(all blitzes)", g.name, g.m)));
    } else if (groupBy === "team") {
      // Per-rep rows grouped under each blitz (the "team"), with a team
      // subtotal row after each blitz group.
      const sorted = [...cellList].sort(
        (a, b) =>
          a.blitzArea.localeCompare(b.blitzArea) ||
          a.repName.localeCompare(b.repName)
      );
      let i = 0;
      while (i < sorted.length) {
        const area = sorted[i].blitzArea;
        const sub = emptyMetrics();
        while (i < sorted.length && sorted[i].blitzArea === area) {
          const c = sorted[i];
          rows.push(toDataRow(area, c.repName, c));
          addInto(sub, c);
          i++;
        }
        rows.push({
          kind: "subtotal",
          blitzArea: area,
          repName: "Team subtotal",
          ...sub,
          conversionRate: conversion(sub),
        });
      }
    } else {
      // dataset — flat per-(blitz, rep) rows.
      [...cellList]
        .sort(
          (a, b) =>
            a.blitzArea.localeCompare(b.blitzArea) ||
            a.repName.localeCompare(b.repName)
        )
        .forEach((c) => rows.push(toDataRow(c.blitzArea, c.repName, c)));
    }

    // Grand total row.
    rows.push({
      kind: "total",
      blitzArea: "TOTAL",
      repName: "",
      ...grandTotal,
      conversionRate: conversion(grandTotal),
    });

    const distinctReps = repIds.length || (cellList.some((c) => !c.repId) ? 1 : 0);
    const distinctBlitzes =
      blitzIds.length || (cellList.some((c) => !c.blitzId) ? 1 : 0);
    const salesPerRep =
      distinctReps > 0
        ? +(grandTotal.salesSubmitted / distinctReps).toFixed(2)
        : 0;
    const salesPerBlitz =
      distinctBlitzes > 0
        ? +(grandTotal.salesSubmitted / distinctBlitzes).toFixed(2)
        : 0;

    const generatedAt = now.toISOString();
    const summary = {
      generatedAt,
      startDate: ymd(start),
      endDate: ymd(end),
      groupBy,
      totalReps: distinctReps,
      totalBlitzes: distinctBlitzes,
      salesPerRep,
      salesPerBlitz,
      totals: {
        ...grandTotal,
        conversionRate: conversion(grandTotal),
      },
    };

    if (format === "csv") {
      const selectedBlitzName = blitzId ? blitzName.get(blitzId) : null;
      const lines: string[] = [];

      // Metadata block (includes the export timestamp per spec).
      lines.push(["Sales & Activity Report"].map(csvCell).join(","));
      lines.push(["Generated", generatedAt].map(csvCell).join(","));
      lines.push(
        ["Date range", `${ymd(start)} to ${ymd(end)}`].map(csvCell).join(",")
      );
      lines.push(["Grouped by", groupBy].map(csvCell).join(","));
      if (selectedBlitzName) {
        lines.push(["Blitz / Team", selectedBlitzName].map(csvCell).join(","));
      }
      if (repId) {
        lines.push(
          ["Rep", repName.get(repId) ?? repId].map(csvCell).join(",")
        );
      }
      lines.push("");

      // Table.
      const header = [
        "Blitz Area",
        "Rep Name",
        "Logged Doors",
        "Sales Submitted",
        "Not Interested",
        "Go-Backs",
        "Not Home",
        "Conversion Rate",
      ];
      lines.push(header.join(","));
      for (const r of rows) {
        lines.push(
          [
            csvCell(r.blitzArea),
            csvCell(r.repName),
            csvCell(r.loggedDoors),
            csvCell(r.salesSubmitted),
            csvCell(r.notInterested),
            csvCell(r.goBacks),
            csvCell(r.notHome),
            csvCell(r.conversionRate),
          ].join(",")
        );
      }

      // Summary rows.
      lines.push("");
      lines.push(["Sales per Rep", salesPerRep].map(csvCell).join(","));
      lines.push(["Sales per Blitz", salesPerBlitz].map(csvCell).join(","));
      lines.push(["Total Reps", distinctReps].map(csvCell).join(","));
      lines.push(["Total Blitzes", distinctBlitzes].map(csvCell).join(","));

      const datePart = ymd(now);
      const filename = selectedBlitzName
        ? `Blitz_Report_${selectedBlitzName.replace(/[^A-Za-z0-9]+/g, "_")}_${datePart}.csv`
        : `Sales_Report_${datePart}.csv`;

      return new NextResponse(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ rows, summary });
  } catch (error) {
    console.error("[GET /api/reports/sales-activity]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
