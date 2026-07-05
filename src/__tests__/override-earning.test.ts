/**
 * Override-earning service tests (manager override / market-owner spread).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  overrideEarning: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { upsertOverrideEarnings } from "@/lib/services/override-earning";

beforeEach(() => vi.clearAllMocks());

describe("upsertOverrideEarnings", () => {
  it("creates a MANAGER_OVERRIDE and a MARKET_OWNER_SPREAD earning", async () => {
    mockDb.overrideEarning.findUnique.mockResolvedValue(null);

    await upsertOverrideEarnings({
      commissionRecordId: "c-1",
      managerId: "mgr-1",
      ownerId: "owner-1",
      managerOverride: 40,
      marketOwnerSpread: 20,
    });

    expect(mockDb.overrideEarning.create).toHaveBeenCalledTimes(2);
    const roles = mockDb.overrideEarning.create.mock.calls.map((c) => c[0].data.role).sort();
    expect(roles).toEqual(["MANAGER_OVERRIDE", "MARKET_OWNER_SPREAD"]);
    const mgr = mockDb.overrideEarning.create.mock.calls.find(
      (c) => c[0].data.role === "MANAGER_OVERRIDE"
    )![0].data;
    expect(mgr).toMatchObject({ payeeId: "mgr-1", amount: 40, status: "ELIGIBLE" });
  });

  it("skips zero amounts and null payees", async () => {
    mockDb.overrideEarning.findUnique.mockResolvedValue(null);

    await upsertOverrideEarnings({
      commissionRecordId: "c-1",
      managerId: null,
      ownerId: "owner-1",
      managerOverride: 40,
      marketOwnerSpread: 0,
    });

    // manager payee null → skip; owner spread 0 → skip
    expect(mockDb.overrideEarning.create).not.toHaveBeenCalled();
  });

  it("updates an existing ELIGIBLE earning but never a batched one", async () => {
    mockDb.overrideEarning.findUnique
      .mockResolvedValueOnce({ status: "ELIGIBLE" }) // manager → update
      .mockResolvedValueOnce({ status: "PAID" }); // owner → skip

    await upsertOverrideEarnings({
      commissionRecordId: "c-1",
      managerId: "mgr-1",
      ownerId: "owner-1",
      managerOverride: 45,
      marketOwnerSpread: 20,
    });

    expect(mockDb.overrideEarning.update).toHaveBeenCalledTimes(1);
    expect(mockDb.overrideEarning.create).not.toHaveBeenCalled();
    const upd = mockDb.overrideEarning.update.mock.calls[0][0];
    expect(upd.data).toMatchObject({ payeeId: "mgr-1", amount: 45 });
  });
});
