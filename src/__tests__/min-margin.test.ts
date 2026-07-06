/**
 * Minimum-margin protection tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  product: { findUnique: vi.fn() },
  carrier: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { checkMinMargin, checkGrantMargin } from "@/lib/services/min-margin";

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
