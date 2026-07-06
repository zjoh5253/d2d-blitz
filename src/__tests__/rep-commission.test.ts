/**
 * Rep commission override resolver tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  repCommissionOverride: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { resolveRepOverride } from "@/lib/services/rep-commission";

beforeEach(() => vi.clearAllMocks());

describe("resolveRepOverride", () => {
  it("returns the override's id + amount when one matches", async () => {
    mockDb.repCommissionOverride.findFirst.mockResolvedValueOnce({ id: "ovr-1", amount: 150 });
    const r = await resolveRepOverride({
      repId: "rep-1",
      carrierId: "c-1",
      productId: "p-1",
      at: new Date("2025-06-01"),
    });
    expect(r).toEqual({ id: "ovr-1", amount: 150 });
  });

  it("returns null when nothing matches", async () => {
    mockDb.repCommissionOverride.findFirst.mockResolvedValueOnce(null);
    const r = await resolveRepOverride({ repId: "rep-1", carrierId: "c-1", at: new Date() });
    expect(r).toBeNull();
  });

  it("queries active + effective overrides, product-then-carrier-then-global ordering", async () => {
    mockDb.repCommissionOverride.findFirst.mockResolvedValueOnce(null);
    const at = new Date("2025-06-01");
    await resolveRepOverride({ repId: "rep-1", carrierId: "c-1", productId: "p-1", at });

    const q = mockDb.repCommissionOverride.findFirst.mock.calls[0][0];
    expect(q.where.repId).toBe("rep-1");
    expect(q.where.active).toBe(true);
    expect(q.where.effectiveDate).toEqual({ lte: at });
    // product-specific match OR global product
    expect(q.where.AND[0]).toEqual({ OR: [{ productId: "p-1" }, { productId: null }] });
    // carrier match OR global carrier
    expect(q.where.AND[1]).toEqual({ OR: [{ carrierId: "c-1" }, { carrierId: null }] });
    // most-specific first
    expect(q.orderBy[0]).toEqual({ productId: { sort: "desc", nulls: "last" } });
    expect(q.orderBy[1]).toEqual({ carrierId: { sort: "desc", nulls: "last" } });
  });

  it("restricts the product filter to global overrides when the sale has no product", async () => {
    mockDb.repCommissionOverride.findFirst.mockResolvedValueOnce(null);
    await resolveRepOverride({ repId: "rep-1", carrierId: "c-1", at: new Date() });
    const q = mockDb.repCommissionOverride.findFirst.mock.calls[0][0];
    expect(q.where.AND[0]).toEqual({ productId: null });
  });
});
