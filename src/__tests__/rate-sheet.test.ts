/**
 * Hierarchical rate-sheet resolver + derived-slice overlay tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  rateSheet: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { resolveRateSheet, applyRateSheets } from "@/lib/services/rate-sheet";

beforeEach(() => vi.clearAllMocks());

// Route the mock by the queried level so the two resolves are independent.
function setSheets(opts: { manager?: number | null; owner?: number | null }) {
  mockDb.rateSheet.findFirst.mockImplementation(async (args: { where: { level: string } }) => {
    const level = args.where.level;
    const val = level === "MANAGER" ? opts.manager : opts.owner;
    return val == null ? null : { availableRevenue: val };
  });
}

const baseline = {
  carrierPayout: 300,
  baselineCompanyFloor: 60,
  baselineManagerOverride: 40,
  baselineMarketOwnerSpread: 20,
  repPay: 140,
  managerId: "mgr-1",
  ownerId: "owner-1",
  carrierId: "c-1",
  productId: "p-1" as string | null,
  at: new Date("2025-06-01"),
};

describe("resolveRateSheet", () => {
  it("returns the grant's availableRevenue when one matches", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce({ availableRevenue: 250 });
    const r = await resolveRateSheet({ level: "OWNER", principalId: "o-1", carrierId: "c-1", productId: "p-1", at: new Date() });
    expect(r).toBe(250);
  });
  it("returns null when nothing matches", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce(null);
    const r = await resolveRateSheet({ level: "MANAGER", principalId: "m-1", carrierId: "c-1", at: new Date() });
    expect(r).toBeNull();
  });
  it("queries by level + principal + active + effective, product-then-carrier ordering", async () => {
    mockDb.rateSheet.findFirst.mockResolvedValueOnce(null);
    const at = new Date("2025-06-01");
    await resolveRateSheet({ level: "OWNER", principalId: "o-1", carrierId: "c-1", productId: "p-1", at });
    const q = mockDb.rateSheet.findFirst.mock.calls[0][0];
    expect(q.where.level).toBe("OWNER");
    expect(q.where.principalId).toBe("o-1");
    expect(q.where.active).toBe(true);
    expect(q.orderBy[0]).toEqual({ productId: { sort: "desc", nulls: "last" } });
  });
});

describe("applyRateSheets", () => {
  it("returns the baseline unchanged when no rate sheet resolves", async () => {
    setSheets({ manager: null, owner: null });
    const r = await applyRateSheets(baseline);
    expect(r).toEqual({ companyFloor: 60, managerOverride: 40, marketOwnerSpread: 20 });
  });

  it("derives from a MANAGER grant (managerOverride = managerAvailable − repPay)", async () => {
    setSheets({ manager: 180, owner: null });
    const r = await applyRateSheets(baseline);
    // ownerAvailable = 180 + baselineSpread(20) = 200
    expect(r.managerOverride).toBe(40); // 180 - 140
    expect(r.marketOwnerSpread).toBe(20); // 200 - 180
    expect(r.companyFloor).toBe(100); // 300 - 200
  });

  it("derives from an OWNER grant (companyFloor = carrierPayout − ownerAvailable)", async () => {
    setSheets({ manager: null, owner: 250 });
    const r = await applyRateSheets(baseline);
    // managerAvailable = repPay(140) + baselineMgr(40) = 180
    expect(r.managerOverride).toBe(40); // 180 - 140
    expect(r.marketOwnerSpread).toBe(70); // 250 - 180
    expect(r.companyFloor).toBe(50); // 300 - 250
  });

  it("derives the full chain from both grants", async () => {
    setSheets({ manager: 180, owner: 250 });
    const r = await applyRateSheets(baseline);
    expect(r.managerOverride).toBe(40); // 180 - 140
    expect(r.marketOwnerSpread).toBe(70); // 250 - 180
    expect(r.companyFloor).toBe(50); // 300 - 250
  });

  it("clamps a negative slice to 0", async () => {
    setSheets({ manager: 100, owner: null }); // manager available < repPay(140)
    const r = await applyRateSheets(baseline);
    expect(r.managerOverride).toBe(0);
  });
});
