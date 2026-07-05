/**
 * Payroll-scope tests — resolving a manager/owner's downline reps.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  blitz: { findMany: vi.fn() },
  blitzAssignment: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { getPayrollScope } from "@/lib/services/payroll-scope";

beforeEach(() => vi.clearAllMocks());

describe("getPayrollScope", () => {
  it("returns reps assigned to a FIELD_MANAGER's blitzes (deduped)", async () => {
    mockDb.blitz.findMany.mockResolvedValueOnce([{ id: "b-1" }, { id: "b-2" }]);
    mockDb.blitzAssignment.findMany.mockResolvedValueOnce([
      { repId: "rep-1" },
      { repId: "rep-2" },
      { repId: "rep-1" },
    ]);

    const scope = await getPayrollScope({ id: "mgr-1", role: "FIELD_MANAGER" });

    expect(mockDb.blitz.findMany.mock.calls[0][0].where).toEqual({ managerId: "mgr-1" });
    expect(scope.repIds.sort()).toEqual(["rep-1", "rep-2"]);
  });

  it("resolves a MARKET_OWNER via market ownership", async () => {
    mockDb.blitz.findMany.mockResolvedValueOnce([{ id: "b-9" }]);
    mockDb.blitzAssignment.findMany.mockResolvedValueOnce([{ repId: "rep-9" }]);

    const scope = await getPayrollScope({ id: "owner-1", role: "MARKET_OWNER" });

    expect(mockDb.blitz.findMany.mock.calls[0][0].where).toEqual({
      market: { ownerId: "owner-1" },
    });
    expect(scope.repIds).toEqual(["rep-9"]);
  });

  it("returns an empty scope for non-manager roles", async () => {
    const scope = await getPayrollScope({ id: "rep-1", role: "FIELD_REP" });
    expect(scope.repIds).toEqual([]);
    expect(mockDb.blitz.findMany).not.toHaveBeenCalled();
  });

  it("returns empty when the manager has no blitzes", async () => {
    mockDb.blitz.findMany.mockResolvedValueOnce([]);
    const scope = await getPayrollScope({ id: "mgr-x", role: "FIELD_MANAGER" });
    expect(scope.repIds).toEqual([]);
    expect(mockDb.blitzAssignment.findMany).not.toHaveBeenCalled();
  });
});
