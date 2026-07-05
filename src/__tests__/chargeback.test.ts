/**
 * Chargeback engine tests. Mocks db + notifications.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = vi.hoisted(() => ({
  chargeback: { create: vi.fn() },
  holdback: { update: vi.fn() },
  sale: { update: vi.fn() },
}));

const mockDb = vi.hoisted(() => ({
  sale: { findUnique: vi.fn() },
  chargeback: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/services/notifications", () => ({
  notifyChargeback: vi.fn(),
}));

import { recordChargeback } from "@/lib/services/chargeback";

function saleWithHoldback(holdbackStatus: string | null, heldAmount = 100) {
  return {
    id: "sale-1",
    repId: "rep-1",
    carrierId: "carrier-1",
    customerName: "Jane Doe",
    commissionRecord: holdbackStatus
      ? { id: "c-1", holdback: { id: "h-1", status: holdbackStatus, amount: heldAmount } }
      : { id: "c-1", holdback: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction runs the callback with our tx mock.
  mockDb.$transaction.mockImplementation(async (cb) => cb(tx));
  tx.chargeback.create.mockImplementation(async ({ data }) => ({ id: "cb-1", ...data }));
  tx.holdback.update.mockResolvedValue({});
  tx.sale.update.mockResolvedValue({});
  mockDb.chargeback.findUnique.mockResolvedValue(null);
});

describe("recordChargeback", () => {
  it("applies held funds and fully recovers when chargeback <= held", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(saleWithHoldback("HELD", 100));

    await recordChargeback({ saleId: "sale-1", amount: 80, reason: "churn", actorId: "admin-1" });

    const created = tx.chargeback.create.mock.calls[0][0].data;
    expect(created.heldApplied).toBe(80);
    expect(created.outstandingBalance).toBe(0);
    expect(created.status).toBe("RECOVERED");
    // holdback clawed back + linked
    expect(tx.holdback.update).toHaveBeenCalledWith({
      where: { id: "h-1" },
      data: { status: "CLAWED_BACK", chargebackId: "cb-1" },
    });
    // sale moved to CHARGEBACK
    expect(tx.sale.update).toHaveBeenCalledWith({
      where: { id: "sale-1" },
      data: { status: "CHARGEBACK" },
    });
  });

  it("records an outstanding balance when chargeback exceeds held funds", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(saleWithHoldback("HELD", 100));

    await recordChargeback({ saleId: "sale-1", amount: 250, reason: "churn" });

    const created = tx.chargeback.create.mock.calls[0][0].data;
    expect(created.heldApplied).toBe(100);
    expect(created.outstandingBalance).toBe(150);
    expect(created.status).toBe("OPEN");
  });

  it("applies no held funds when the holdback is already released", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(saleWithHoldback("RELEASED", 100));

    await recordChargeback({ saleId: "sale-1", amount: 100, reason: "churn" });

    const created = tx.chargeback.create.mock.calls[0][0].data;
    expect(created.heldApplied).toBe(0);
    expect(created.outstandingBalance).toBe(100);
    expect(tx.holdback.update).not.toHaveBeenCalled();
  });

  it("handles a sale with no holdback at all", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(saleWithHoldback(null));

    await recordChargeback({ saleId: "sale-1", amount: 60, reason: "churn" });

    const created = tx.chargeback.create.mock.calls[0][0].data;
    expect(created.heldApplied).toBe(0);
    expect(created.outstandingBalance).toBe(60);
    expect(tx.holdback.update).not.toHaveBeenCalled();
  });

  it("rejects a duplicate chargeback for the same sale", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(saleWithHoldback("HELD"));
    mockDb.chargeback.findUnique.mockResolvedValueOnce({ id: "existing" });

    await expect(
      recordChargeback({ saleId: "sale-1", amount: 50, reason: "dup" })
    ).rejects.toThrow(/already exists/);
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      recordChargeback({ saleId: "sale-1", amount: 0, reason: "bad" })
    ).rejects.toThrow(/greater than zero/);
  });

  it("throws when the sale does not exist", async () => {
    mockDb.sale.findUnique.mockResolvedValueOnce(null);
    await expect(
      recordChargeback({ saleId: "missing", amount: 50, reason: "x" })
    ).rejects.toThrow(/Sale not found/);
  });
});
