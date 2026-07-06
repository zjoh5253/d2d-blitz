/**
 * Minimum-margin protection tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  product: { findUnique: vi.fn() },
  carrier: { findUnique: vi.fn() },
  rateSheet: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  checkMinMargin,
  checkGrantMargin,
  checkRepPayMargin,
  checkManagerGrantMargin,
} from "@/lib/services/min-margin";

const AT = new Date("2026-01-01");

beforeEach(() => vi.clearAllMocks());

describe("checkMinMargin", () => {
  it("passes immediately when override is set", async () => {
    const r = await checkMinMargin({
      carrierId: "c-1",
      companyFloorPercent: 0,
      override: true,
    });
    expect(r.ok).toBe(true);
    expect(mockDb.carrier.findUnique).not.toHaveBeenCalled();
  });

  it("uses the carrier minimum when no product is given", async () => {
    mockDb.carrier.findUnique.mockResolvedValueOnce({ name: "FiberMax", minMarginPercent: 20 });
    const below = await checkMinMargin({ carrierId: "c-1", companyFloorPercent: 15 });
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.message).toMatch(/below the 20% minimum/i);

    mockDb.carrier.findUnique.mockResolvedValueOnce({ name: "FiberMax", minMarginPercent: 20 });
    const ok = await checkMinMargin({ carrierId: "c-1", companyFloorPercent: 20 });
    expect(ok.ok).toBe(true);
  });

  it("uses the product minimum when the config is product-specific", async () => {
    mockDb.product.findUnique.mockResolvedValueOnce({
      name: "2 Gig",
      minMarginPercent: 25,
      carrier: { name: "FiberMax", minMarginPercent: 20 },
    });
    const r = await checkMinMargin({
      carrierId: "c-1",
      productId: "p-1",
      companyFloorPercent: 22,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/25% minimum for 2 Gig/i);
  });

  it("falls back to the carrier minimum when the product has none", async () => {
    mockDb.product.findUnique.mockResolvedValueOnce({
      name: "1 Gig",
      minMarginPercent: null,
      carrier: { name: "FiberMax", minMarginPercent: 20 },
    });
    const r = await checkMinMargin({
      carrierId: "c-1",
      productId: "p-2",
      companyFloorPercent: 18,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/20% minimum/i);
  });
});

describe("checkGrantMargin (OWNER rate sheet)", () => {
  it("rejects a grant that leaves the company below its minimum margin", async () => {
    // product revenue 300, min 20% → company must keep >= $60; granting $260 leaves $40 (13.3%).
    mockDb.product.findUnique.mockResolvedValueOnce({
      name: "1 Gig",
      revenue: 300,
      minMarginPercent: null,
      carrier: { name: "FiberMax", revenuePerInstall: 250, minMarginPercent: 20 },
    });
    const r = await checkGrantMargin({ carrierId: "c-1", productId: "p-1", availableRevenue: 260 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/below the 20% minimum/i);
  });

  it("accepts a grant that preserves the minimum margin", async () => {
    mockDb.product.findUnique.mockResolvedValueOnce({
      name: "1 Gig",
      revenue: 300,
      minMarginPercent: null,
      carrier: { name: "FiberMax", revenuePerInstall: 250, minMarginPercent: 20 },
    });
    const r = await checkGrantMargin({ carrierId: "c-1", productId: "p-1", availableRevenue: 240 }); // keeps $60 = 20%
    expect(r.ok).toBe(true);
  });

  it("passes immediately when override is set", async () => {
    const r = await checkGrantMargin({ carrierId: "c-1", availableRevenue: 999, override: true });
    expect(r.ok).toBe(true);
    expect(mockDb.carrier.findUnique).not.toHaveBeenCalled();
  });
});

describe("checkRepPayMargin (manager sets rep pay)", () => {
  it("rejects rep pay above the manager's available revenue", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce({ availableRevenue: 180 });
    const r = await checkRepPayMargin({
      managerId: "mgr-1",
      carrierId: "c-1",
      productId: "p-1",
      amount: 200,
      at: AT,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/exceeds your available revenue of \$180\.00/i);
  });

  it("accepts rep pay at or under the manager's available revenue", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce({ availableRevenue: 180 });
    const r = await checkRepPayMargin({ managerId: "mgr-1", carrierId: "c-1", amount: 180, at: AT });
    expect(r.ok).toBe(true);
  });

  it("does not block when the manager has no grant (cap unknown)", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce(null);
    const r = await checkRepPayMargin({ managerId: "mgr-x", carrierId: "c-1", amount: 999, at: AT });
    expect(r.ok).toBe(true);
  });

  it("passes immediately when override is set (no lookup)", async () => {
    const r = await checkRepPayMargin({
      managerId: "mgr-1",
      carrierId: "c-1",
      amount: 999,
      at: AT,
      override: true,
    });
    expect(r.ok).toBe(true);
    expect(mockDb.rateSheet.findFirst).not.toHaveBeenCalled();
  });
});

describe("checkManagerGrantMargin (owner grants manager revenue)", () => {
  it("rejects a manager grant above the owner's available revenue", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce({ availableRevenue: 250 });
    const r = await checkManagerGrantMargin({
      ownerId: "owner-1",
      carrierId: "c-1",
      productId: "p-1",
      availableRevenue: 260,
      at: AT,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/exceeds your available revenue of \$250\.00/i);
  });

  it("accepts a manager grant at or under the owner's available revenue", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce({ availableRevenue: 250 });
    const r = await checkManagerGrantMargin({
      ownerId: "owner-1",
      carrierId: "c-1",
      availableRevenue: 190,
      at: AT,
    });
    expect(r.ok).toBe(true);
  });

  it("does not block when the owner has no grant (cap unknown)", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce(null);
    const r = await checkManagerGrantMargin({
      ownerId: "owner-x",
      carrierId: "c-1",
      availableRevenue: 999,
      at: AT,
    });
    expect(r.ok).toBe(true);
  });

  it("passes immediately when override is set (no lookup)", async () => {
    const r = await checkManagerGrantMargin({
      ownerId: "owner-1",
      carrierId: "c-1",
      availableRevenue: 999,
      at: AT,
      override: true,
    });
    expect(r.ok).toBe(true);
    expect(mockDb.rateSheet.findFirst).not.toHaveBeenCalled();
  });
});
