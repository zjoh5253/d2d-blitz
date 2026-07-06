/**
 * Financial-visibility hardening tests: the helper + the /api/commissions
 * response redaction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helper ──────────────────────────────────────────────────────────────────

import {
  visibleUpstreamFields,
  redactCommission,
  canSeeUpstreamMargin,
} from "@/lib/services/commission-visibility";

describe("visibleUpstreamFields", () => {
  it("ADMIN and EXECUTIVE see all upstream fields", () => {
    for (const role of ["ADMIN", "EXECUTIVE"]) {
      const s = visibleUpstreamFields(role);
      expect([...s].sort()).toEqual([
        "carrierPayout",
        "companyFloor",
        "managerOverride",
        "marketOwnerSpread",
      ]);
    }
  });
  it("FIELD_MANAGER sees only their override", () => {
    expect([...visibleUpstreamFields("FIELD_MANAGER")]).toEqual(["managerOverride"]);
  });
  it("MARKET_OWNER sees only their spread", () => {
    expect([...visibleUpstreamFields("MARKET_OWNER")]).toEqual(["marketOwnerSpread"]);
  });
  it("FIELD_REP sees no upstream fields", () => {
    expect(visibleUpstreamFields("FIELD_REP").size).toBe(0);
  });
});

describe("canSeeUpstreamMargin", () => {
  it("is true only for ADMIN/EXECUTIVE", () => {
    expect(canSeeUpstreamMargin("ADMIN")).toBe(true);
    expect(canSeeUpstreamMargin("EXECUTIVE")).toBe(true);
    expect(canSeeUpstreamMargin("FIELD_MANAGER")).toBe(false);
    expect(canSeeUpstreamMargin("FIELD_REP")).toBe(false);
  });
});

describe("redactCommission", () => {
  const record = {
    id: "c-1",
    repPay: 100,
    carrierPayout: 300,
    companyFloor: 60,
    managerOverride: 40,
    marketOwnerSpread: 20,
    status: "ELIGIBLE",
  };

  it("keeps everything for ADMIN", () => {
    expect(redactCommission(record, "ADMIN")).toEqual(record);
  });
  it("for a FIELD_MANAGER keeps repPay + managerOverride, drops carrierPayout/companyFloor/spread", () => {
    const r = redactCommission(record, "FIELD_MANAGER") as Record<string, unknown>;
    expect(r.repPay).toBe(100);
    expect(r.managerOverride).toBe(40);
    expect(r.carrierPayout).toBeUndefined();
    expect(r.companyFloor).toBeUndefined();
    expect(r.marketOwnerSpread).toBeUndefined();
    expect(r.status).toBe("ELIGIBLE");
  });
  it("for a FIELD_REP drops all upstream fields but keeps repPay", () => {
    const r = redactCommission(record, "FIELD_REP") as Record<string, unknown>;
    expect(r.repPay).toBe(100);
    expect(r.carrierPayout).toBeUndefined();
    expect(r.companyFloor).toBeUndefined();
    expect(r.managerOverride).toBeUndefined();
    expect(r.marketOwnerSpread).toBeUndefined();
  });
  it("does not mutate the original record", () => {
    redactCommission(record, "FIELD_REP");
    expect(record.carrierPayout).toBe(300);
  });
});

// ─── GET /api/commissions redaction ──────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: { commissionRecord: { findMany: vi.fn() } },
}));
vi.mock("@/lib/auth-mobile", () => ({ getSessionFromRequest: vi.fn() }));

import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth-mobile";

const mockDb = db as unknown as { commissionRecord: { findMany: ReturnType<typeof vi.fn> } };
const mockSession = getSessionFromRequest as unknown as ReturnType<typeof vi.fn>;

const sampleRecords = [
  { id: "c-1", repId: "rep-1", repPay: 100, carrierPayout: 300, companyFloor: 60, managerOverride: 40, marketOwnerSpread: 20, status: "ELIGIBLE" },
];

beforeEach(() => vi.clearAllMocks());

describe("GET /api/commissions redaction", () => {
  it("strips upstream fields for a FIELD_MANAGER", async () => {
    mockSession.mockResolvedValue({ user: { id: "mgr-1", role: "FIELD_MANAGER" } });
    mockDb.commissionRecord.findMany.mockResolvedValue(sampleRecords);
    const { GET } = await import("@/app/api/commissions/route");
    const res = await GET(new Request("http://localhost/api/commissions?repId=rep-1") as never);
    const json = await res.json();
    expect(json[0].repPay).toBe(100);
    expect(json[0].managerOverride).toBe(40);
    expect(json[0].carrierPayout).toBeUndefined();
    expect(json[0].companyFloor).toBeUndefined();
  });

  it("keeps all fields for ADMIN", async () => {
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockDb.commissionRecord.findMany.mockResolvedValue(sampleRecords);
    const { GET } = await import("@/app/api/commissions/route");
    const res = await GET(new Request("http://localhost/api/commissions") as never);
    const json = await res.json();
    expect(json[0].carrierPayout).toBe(300);
    expect(json[0].companyFloor).toBe(60);
  });
});
