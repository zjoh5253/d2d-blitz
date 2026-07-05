// @ts-nocheck
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    payoutBatch: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payoutLine: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    commissionRecord: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    overrideEarning: {
      updateMany: vi.fn(),
    },
    deduction: {
      findMany: vi.fn(),
    },
    complianceHold: {
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/posthog", () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock("@/lib/services/stripe-payout", () => ({
  payBatchViaStripe: vi.fn(),
}));

// --- Imports after mocks ---

import { PUT } from "@/app/api/payouts/[id]/route";
import { payBatchViaStripe } from "@/lib/services/stripe-payout";
import {
  createPayoutBatch,
  markPayoutBatchPaid,
} from "@/lib/services/payout";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// --- Helpers ---

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/payouts/batch-1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id = "batch-1"): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const adminSession = {
  user: { id: "user-admin", role: "ADMIN", name: "Admin" },
};

const execSession = {
  user: { id: "user-exec", role: "EXECUTIVE", name: "Exec" },
};

const repSession = {
  user: { id: "user-rep", role: "REP", name: "Rep" },
};

// --- Route handler: PUT /api/payouts/[id] ---

describe("PUT /api/payouts/[id] – state machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Auth / authorization

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await PUT(makeRequest({ status: "REVIEWED" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not ADMIN or EXECUTIVE", async () => {
    vi.mocked(auth).mockResolvedValue(repSession as never);

    const res = await PUT(makeRequest({ status: "REVIEWED" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status value", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "DRAFT",
    } as never);

    const res = await PUT(makeRequest({ status: "INVALID" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when batch does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(null);

    const res = await PUT(makeRequest({ status: "REVIEWED" }), makeParams());
    expect(res.status).toBe(404);
  });

  // Valid transitions

  it("DRAFT → REVIEWED succeeds (200)", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "DRAFT",
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "REVIEWED",
      payoutLines: [],
    } as never);

    const res = await PUT(makeRequest({ status: "REVIEWED" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("REVIEWED");
  });

  it("REVIEWED → APPROVED succeeds and sets approvedById + approvedAt", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "REVIEWED",
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
      approvedById: "user-admin",
      approvedAt: new Date(),
      payoutLines: [],
    } as never);

    const res = await PUT(makeRequest({ status: "APPROVED" }), makeParams());
    expect(res.status).toBe(200);

    const updateCall = vi.mocked(db.payoutBatch.update).mock.calls[0][0];
    expect(updateCall.data.approvedById).toBe("user-admin");
    expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
  });

  it("APPROVED → PAID succeeds (200)", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
    } as never);
    vi.mocked(payBatchViaStripe).mockResolvedValue({
      batchId: "batch-1",
      transferred: [{ repId: "rep-1" }, { repId: "rep-2" }],
      skipped: [],
    } as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({
      count: 5,
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "PAID",
      payoutLines: [],
    } as never);

    const res = await PUT(makeRequest({ status: "PAID" }), makeParams());
    expect(res.status).toBe(200);
  });

  // Invalid transitions – should all 409

  const invalidTransitions: Array<{ from: string; to: string }> = [
    { from: "DRAFT", to: "PAID" },
    { from: "DRAFT", to: "APPROVED" },
    { from: "REVIEWED", to: "DRAFT" },
    { from: "REVIEWED", to: "PAID" },
    { from: "APPROVED", to: "DRAFT" },
    { from: "APPROVED", to: "REVIEWED" },
    { from: "PAID", to: "DRAFT" },
    { from: "PAID", to: "REVIEWED" },
    { from: "PAID", to: "APPROVED" },
  ];

  for (const { from, to } of invalidTransitions) {
    it(`${from} → ${to} returns 409`, async () => {
      vi.mocked(auth).mockResolvedValue(adminSession as never);
      vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
        id: "batch-1",
        status: from,
      } as never);

      const res = await PUT(makeRequest({ status: to }), makeParams());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(new RegExp(`Cannot transition from ${from} to ${to}`));
    });
  }

  // PAID transition cascades commission status

  it("APPROVED → PAID calls commissionRecord.updateMany for reps paid via Stripe", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
    } as never);
    vi.mocked(payBatchViaStripe).mockResolvedValue({
      batchId: "batch-1",
      transferred: [{ repId: "rep-1" }, { repId: "rep-2" }],
      skipped: [],
    } as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({
      count: 3,
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "PAID",
      payoutLines: [],
    } as never);

    await PUT(makeRequest({ status: "PAID" }), makeParams());

    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { repId: { in: ["rep-1", "rep-2"] }, status: "PENDING" },
      data: { status: "PAID" },
    });
  });

  it("REVIEWED → APPROVED does NOT call commissionRecord.updateMany", async () => {
    vi.mocked(auth).mockResolvedValue(adminSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "REVIEWED",
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
      payoutLines: [],
    } as never);

    await PUT(makeRequest({ status: "APPROVED" }), makeParams());

    expect(db.commissionRecord.updateMany).not.toHaveBeenCalled();
  });

  it("EXECUTIVE role can also perform valid transitions", async () => {
    vi.mocked(auth).mockResolvedValue(execSession as never);
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "DRAFT",
    } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "REVIEWED",
      payoutLines: [],
    } as never);

    const res = await PUT(makeRequest({ status: "REVIEWED" }), makeParams());
    expect(res.status).toBe(200);
  });
});

// --- Service: createPayoutBatch ---

// TODO(DDB-57): Needs updating after DDB-17 refactored payout service to use $transaction
describe.skip("createPayoutBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups commissions by rep and creates one payout line per rep", async () => {
    // rep1: $1000 gross, $100 deductions, 0 active holds
    // rep2: $500 gross, $0 deductions, 1 active hold
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([
      { id: "c-1", repId: "rep-1", repPay: 600, rep: { id: "rep-1" } },
      { id: "c-2", repId: "rep-1", repPay: 400, rep: { id: "rep-1" } },
      { id: "c-3", repId: "rep-2", repPay: 500, rep: { id: "rep-2" } },
    ] as never);

    vi.mocked(db.payoutBatch.create).mockResolvedValue({
      id: "batch-new",
      period: "2024-Q1",
    } as never);

    // Deductions: rep1 has $100 deduction, rep2 has none
    vi.mocked(db.deduction.findMany).mockImplementation(({ where }: { where: { repId: string } }) => {
      if (where.repId === "rep-1") return Promise.resolve([{ amount: 100 }]) as never;
      return Promise.resolve([]) as never;
    });

    // Compliance holds: rep1 has 0, rep2 has 1
    vi.mocked(db.complianceHold.count).mockImplementation(({ where }: { where: { repId: string } }) => {
      if (where.repId === "rep-1") return Promise.resolve(0) as never;
      return Promise.resolve(1) as never;
    });

    // Governance
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "rep-1",
      governanceTier: { id: "tier-1" },
    } as never);

    vi.mocked(db.payoutLine.create).mockResolvedValue({} as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 3 } as never);

    const batch = await createPayoutBatch("2024-Q1");

    expect(batch.id).toBe("batch-new");
    // Two payout lines should be created (one per rep)
    expect(db.payoutLine.create).toHaveBeenCalledTimes(2);
  });

  it("calculates netPay as grossPay minus totalDeductions for rep1 ($1000 - $100 = $900)", async () => {
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([
      { id: "c-1", repId: "rep-1", repPay: 600, rep: { id: "rep-1" } },
      { id: "c-2", repId: "rep-1", repPay: 400, rep: { id: "rep-1" } },
    ] as never);

    vi.mocked(db.payoutBatch.create).mockResolvedValue({
      id: "batch-new",
      period: "2024-Q1",
    } as never);

    vi.mocked(db.deduction.findMany).mockResolvedValue([{ amount: 100 }] as never);
    vi.mocked(db.complianceHold.count).mockResolvedValue(0 as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "rep-1",
      governanceTier: { id: "tier-1" },
    } as never);
    vi.mocked(db.payoutLine.create).mockResolvedValue({} as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 2 } as never);

    await createPayoutBatch("2024-Q1");

    const createLineCall = vi.mocked(db.payoutLine.create).mock.calls[0][0];
    expect(createLineCall.data.grossPay).toBe(1000);
    expect(createLineCall.data.totalDeductions).toBe(100);
    expect(createLineCall.data.netPay).toBe(900);
  });

  it("marks rep2 complianceVerified=false when they have 1 active hold", async () => {
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([
      { id: "c-3", repId: "rep-2", repPay: 500, rep: { id: "rep-2" } },
    ] as never);

    vi.mocked(db.payoutBatch.create).mockResolvedValue({
      id: "batch-new",
      period: "2024-Q1",
    } as never);

    vi.mocked(db.deduction.findMany).mockResolvedValue([] as never);
    vi.mocked(db.complianceHold.count).mockResolvedValue(1 as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "rep-2",
      governanceTier: null,
    } as never);
    vi.mocked(db.payoutLine.create).mockResolvedValue({} as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 1 } as never);

    await createPayoutBatch("2024-Q1");

    const createLineCall = vi.mocked(db.payoutLine.create).mock.calls[0][0];
    expect(createLineCall.data.complianceVerified).toBe(false);
    expect(createLineCall.data.governanceChecked).toBe(false);
  });

  it("marks commissions as PENDING after creating payout lines", async () => {
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([
      { id: "c-1", repId: "rep-1", repPay: 1000, rep: { id: "rep-1" } },
    ] as never);

    vi.mocked(db.payoutBatch.create).mockResolvedValue({
      id: "batch-new",
      period: "2024-Q1",
    } as never);

    vi.mocked(db.deduction.findMany).mockResolvedValue([{ amount: 100 }] as never);
    vi.mocked(db.complianceHold.count).mockResolvedValue(0 as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "rep-1",
      governanceTier: { id: "tier-1" },
    } as never);
    vi.mocked(db.payoutLine.create).mockResolvedValue({} as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 1 } as never);

    await createPayoutBatch("2024-Q1");

    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c-1"] } },
      data: { status: "PENDING" },
    });
  });

  it("returns early with empty payout lines when no eligible commissions exist", async () => {
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([] as never);
    vi.mocked(db.payoutBatch.create).mockResolvedValue({
      id: "batch-empty",
      period: "2024-Q1",
    } as never);

    const batch = await createPayoutBatch("2024-Q1");

    expect(batch.id).toBe("batch-empty");
    expect(db.payoutLine.create).not.toHaveBeenCalled();
  });
});

// --- Service: markPayoutBatchPaid ---

// TODO(DDB-57): Needs updating after DDB-17 refactored payout service to use $transaction
describe.skip("markPayoutBatchPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when batch is not APPROVED (DRAFT status)", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "DRAFT",
      payoutLines: [],
    } as never);

    await expect(markPayoutBatchPaid("batch-1")).rejects.toThrow(
      "Batch must be approved before marking as paid"
    );
  });

  it("throws when batch is not APPROVED (REVIEWED status)", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "REVIEWED",
      payoutLines: [],
    } as never);

    await expect(markPayoutBatchPaid("batch-1")).rejects.toThrow(
      "Batch must be approved before marking as paid"
    );
  });

  it("throws when batch is not APPROVED (PAID status)", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "PAID",
      payoutLines: [],
    } as never);

    await expect(markPayoutBatchPaid("batch-1")).rejects.toThrow(
      "Batch must be approved before marking as paid"
    );
  });

  it("throws when batch does not exist", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(null);

    await expect(markPayoutBatchPaid("nonexistent")).rejects.toThrow(
      "Batch must be approved before marking as paid"
    );
  });

  it("marks all PENDING commissions PAID for each payout line rep", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
      payoutLines: [{ repId: "rep-1" }, { repId: "rep-2" }],
    } as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 5 } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "PAID",
    } as never);

    await markPayoutBatchPaid("batch-1");

    // Called once per payout line
    expect(db.commissionRecord.updateMany).toHaveBeenCalledTimes(2);
    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { repId: "rep-1", status: "PENDING" },
      data: { status: "PAID" },
    });
    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { repId: "rep-2", status: "PENDING" },
      data: { status: "PAID" },
    });
  });

  it("updates batch status to PAID", async () => {
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      id: "batch-1",
      status: "APPROVED",
      payoutLines: [{ repId: "rep-1" }],
    } as never);
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      id: "batch-1",
      status: "PAID",
    } as never);

    const result = await markPayoutBatchPaid("batch-1");

    expect(db.payoutBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: { status: "PAID" },
    });
    expect(result.status).toBe("PAID");
  });
});
