/**
 * Holdback / retention-bonus service tests.
 * Mocks db + notifications so CI runs without a database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  holdbackPolicy: { findFirst: vi.fn() },
  holdback: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/services/notifications", () => ({
  notifyRetentionBonusReleased: vi.fn(),
}));

import {
  resolveHoldbackPolicy,
  splitHoldback,
  upsertHoldback,
  releaseDueHoldbacks,
} from "@/lib/services/holdback";
import { notifyRetentionBonusReleased } from "@/lib/services/notifications";

beforeEach(() => vi.clearAllMocks());

describe("resolveHoldbackPolicy", () => {
  it("returns the matching policy's percent + days", async () => {
    mockDb.holdbackPolicy.findFirst.mockResolvedValueOnce({
      holdbackPercent: 10,
      holdbackDays: 120,
    });
    const resolved = await resolveHoldbackPolicy("carrier-1", new Date("2025-01-01"));
    expect(resolved).toEqual({ percent: 10, days: 120 });
  });

  it("returns null when no policy exists", async () => {
    mockDb.holdbackPolicy.findFirst.mockResolvedValueOnce(null);
    const resolved = await resolveHoldbackPolicy("carrier-1", new Date("2025-01-01"));
    expect(resolved).toBeNull();
  });

  it("queries carrier-specific OR global-default, newest carrier match first", async () => {
    mockDb.holdbackPolicy.findFirst.mockResolvedValueOnce(null);
    await resolveHoldbackPolicy("carrier-1", new Date("2025-06-01"));
    const arg = mockDb.holdbackPolicy.findFirst.mock.calls[0][0];
    expect(arg.where.OR).toEqual([{ carrierId: "carrier-1" }, { carrierId: null }]);
    expect(arg.orderBy[0]).toEqual({ carrierId: "desc" });
  });
});

describe("splitHoldback", () => {
  it("splits 10% held / 90% immediate and sets releaseAt", () => {
    const base = new Date("2025-01-01T00:00:00Z");
    const split = splitHoldback(1000, { percent: 10, days: 120 }, base);
    expect(split.held).toBe(100);
    expect(split.immediate).toBe(900);
    expect(split.percent).toBe(10);
    const expected = new Date(base);
    expected.setDate(expected.getDate() + 120);
    expect(split.releaseAt.getTime()).toBe(expected.getTime());
  });

  it("holds nothing when policy is null", () => {
    const split = splitHoldback(1000, null, new Date("2025-01-01"));
    expect(split.held).toBe(0);
    expect(split.immediate).toBe(1000);
  });

  it("rounds to whole cents", () => {
    const split = splitHoldback(333.33, { percent: 10, days: 120 }, new Date("2025-01-01"));
    expect(split.held).toBe(33.33);
    expect(split.immediate).toBe(300);
    expect(split.held + split.immediate).toBeCloseTo(333.33, 2);
  });
});

describe("upsertHoldback", () => {
  const params = {
    commissionRecordId: "c-1",
    repId: "rep-1",
    carrierId: "carrier-1",
    amount: 100,
    percent: 10,
    releaseAt: new Date("2025-05-01"),
  };

  it("creates a HELD holdback when none exists", async () => {
    mockDb.holdback.findUnique.mockResolvedValueOnce(null);
    await upsertHoldback(params);
    expect(mockDb.holdback.create).toHaveBeenCalledTimes(1);
    const arg = mockDb.holdback.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({ commissionRecordId: "c-1", amount: 100, status: "HELD" });
  });

  it("does not create a zero-amount holdback", async () => {
    mockDb.holdback.findUnique.mockResolvedValueOnce(null);
    await upsertHoldback({ ...params, amount: 0 });
    expect(mockDb.holdback.create).not.toHaveBeenCalled();
  });

  it("never clobbers a holdback that is no longer HELD", async () => {
    mockDb.holdback.findUnique.mockResolvedValueOnce({ status: "RELEASED" });
    await upsertHoldback(params);
    expect(mockDb.holdback.update).not.toHaveBeenCalled();
    expect(mockDb.holdback.create).not.toHaveBeenCalled();
  });

  it("updates an existing HELD holdback", async () => {
    mockDb.holdback.findUnique.mockResolvedValueOnce({ status: "HELD" });
    await upsertHoldback(params);
    expect(mockDb.holdback.update).toHaveBeenCalled();
  });
});

describe("releaseDueHoldbacks", () => {
  it("releases each due holdback and notifies the rep", async () => {
    mockDb.holdback.findMany.mockResolvedValueOnce([
      { id: "h-1", repId: "rep-1", amount: 50 },
      { id: "h-2", repId: "rep-2", amount: 75 },
    ]);
    mockDb.holdback.update.mockResolvedValue({});

    const released = await releaseDueHoldbacks(new Date("2025-06-01"));

    expect(released).toHaveLength(2);
    expect(mockDb.holdback.update).toHaveBeenCalledTimes(2);
    const firstUpdate = mockDb.holdback.update.mock.calls[0][0];
    expect(firstUpdate.data.status).toBe("RELEASED");
    expect(notifyRetentionBonusReleased).toHaveBeenCalledTimes(2);
  });

  it("only considers HELD holdbacks whose sale is still VERIFIED", async () => {
    mockDb.holdback.findMany.mockResolvedValueOnce([]);
    await releaseDueHoldbacks(new Date("2025-06-01"));
    const where = mockDb.holdback.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("HELD");
    expect(where.commissionRecord).toEqual({ sale: { status: "VERIFIED" } });
  });
});
