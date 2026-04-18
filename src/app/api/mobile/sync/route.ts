/**
 * POST /api/mobile/sync
 *
 * Bulk endpoint for replaying offline-queued actions from the mobile app.
 * Accepts an array of queued actions, processes each one, and returns a
 * per-action result so the client can remove only the successfully processed
 * items from its local queue.
 *
 * Supported action types:
 *   - CREATE_SALE        → creates a sale record
 *   - CREATE_DAILY_REPORT → upserts a daily report for the rep
 *
 * Auth: mobile Bearer token (same JWT used by all /api/mobile/* routes).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseISO, startOfDay, endOfDay } from "date-fns";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createSaleDataSchema = z.object({
  blitzId: z.string().min(1),
  carrierId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerAddress: z.string().min(1),
  customerEmail: z.string().email().optional().or(z.literal("")),
  installDate: z.string().min(1),
  orderConfirmation: z.string().optional().or(z.literal("")),
});

const createDailyReportDataSchema = z.object({
  date: z.string().min(1),
  blitzId: z.string().min(1),
  doorsKnocked: z.number().int().min(0),
  conversations: z.number().int().min(0),
  goBacksRecorded: z.number().int().min(0).optional(),
  appointmentsScheduled: z.number().int().min(0).optional(),
  salesCount: z.number().int().min(0).optional(),
});

const syncActionSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("CREATE_SALE"), data: createSaleDataSchema }),
  z.object({ id: z.string(), type: z.literal("CREATE_DAILY_REPORT"), data: createDailyReportDataSchema }),
]);

const syncRequestSchema = z.object({
  actions: z.array(syncActionSchema).min(1).max(100),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

type ActionResult =
  | { id: string; success: true; resourceId: string }
  | { id: string; success: false; error: string };

async function processCreateSale(
  repId: string,
  actionId: string,
  data: z.infer<typeof createSaleDataSchema>
): Promise<ActionResult> {
  const { blitzId, carrierId, customerName, customerPhone, customerAddress, customerEmail, installDate, orderConfirmation } = data;

  const assignment = await db.blitzAssignment.findFirst({
    where: {
      repId,
      blitzId,
      status: { in: ["ASSIGNED", "CONFIRMED", "IN_TRANSIT", "ACTIVE"] },
    },
  });

  if (!assignment) {
    return { id: actionId, success: false, error: "Not assigned to this blitz" };
  }

  const sale = await db.sale.create({
    data: {
      repId,
      blitzId,
      carrierId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      customerAddress,
      installDate: parseISO(installDate),
      orderConfirmation: orderConfirmation || null,
      status: "SUBMITTED",
    },
  });

  return { id: actionId, success: true, resourceId: sale.id };
}

async function processCreateDailyReport(
  repId: string,
  actionId: string,
  data: z.infer<typeof createDailyReportDataSchema>
): Promise<ActionResult> {
  const { date, blitzId, doorsKnocked, conversations, goBacksRecorded, appointmentsScheduled, salesCount } = data;

  const assignment = await db.blitzAssignment.findFirst({
    where: { repId, blitzId },
  });

  if (!assignment) {
    return { id: actionId, success: false, error: "Not assigned to this blitz" };
  }

  const reportDate = startOfDay(parseISO(date));

  const existing = await db.dailyReport.findFirst({
    where: {
      repId,
      blitzId,
      date: { gte: reportDate, lte: endOfDay(reportDate) },
    },
  });

  let resourceId: string;
  if (existing) {
    await db.dailyReport.update({
      where: { id: existing.id },
      data: { doorsKnocked, conversations, goBacksRecorded, appointmentsScheduled, salesCount, submittedAt: new Date() },
    });
    resourceId = existing.id;
  } else {
    const report = await db.dailyReport.create({
      data: { repId, blitzId, date: reportDate, doorsKnocked, conversations, goBacksRecorded, appointmentsScheduled, salesCount },
    });
    resourceId = report.id;
  }

  return { id: actionId, success: true, resourceId };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const results: ActionResult[] = [];

  for (const action of parsed.data.actions) {
    try {
      if (action.type === "CREATE_SALE") {
        results.push(await processCreateSale(repId, action.id, action.data));
      } else if (action.type === "CREATE_DAILY_REPORT") {
        results.push(await processCreateDailyReport(repId, action.id, action.data));
      }
    } catch (error) {
      console.error(`[mobile/sync] Action ${action.id} (${action.type}) failed:`, error);
      results.push({ id: action.id, success: false, error: "Internal error processing action" });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return NextResponse.json({ results, successCount, failureCount }, { status: 200 });
}
