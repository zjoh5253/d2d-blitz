/**
 * P4e per-level self-editing — scoped authorization on the rate-sheets and
 * rep-commissions APIs. A MARKET_OWNER may only touch MANAGER grants for their
 * downline managers; a FIELD_MANAGER may only touch overrides for their downline
 * reps (capped at their own available revenue). ADMIN behavior is unchanged.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    rateSheet: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    repCommissionOverride: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    blitz: { findMany: vi.fn() },
    blitzAssignment: { findMany: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as rateSheetsGET, POST as rateSheetsPOST } from "@/app/api/rate-sheets/route";
import { PUT as rateSheetPUT } from "@/app/api/rate-sheets/[id]/route";
import {
  GET as repCommissionsGET,
  POST as repCommissionsPOST,
} from "@/app/api/rep-commissions/route";

function req(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const OWNER = { user: { id: "owner-1", role: "MARKET_OWNER", name: "Carol", email: "c@t.com" } };
const MANAGER = { user: { id: "mgr-1", role: "FIELD_MANAGER", name: "Dave", email: "d@t.com" } };
const ADMIN = { user: { id: "admin-1", role: "ADMIN", name: "Al", email: "a@t.com" } };

const RS_URL = "http://test/api/rate-sheets";
const RC_URL = "http://test/api/rep-commissions";
const DATE = "2026-01-01";

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Rate sheets — MARKET_OWNER edits downline MANAGER grants
// ---------------------------------------------------------------------------

describe("rate-sheets POST (MARKET_OWNER)", () => {
  it("creates a MANAGER grant for a downline manager (capped at owner revenue)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ managerId: "mgr-1" }] as never); // scope
    vi.mocked(db.rateSheet.findFirst).mockResolvedValue({ availableRevenue: 250 } as never); // owner grant
    vi.mocked(db.rateSheet.create).mockResolvedValue({ id: "rs-1" } as never);

    const res = await rateSheetsPOST(
      req(RS_URL, "POST", {
        level: "MANAGER",
        principalId: "mgr-1",
        availableRevenue: 190,
        effectiveDate: DATE,
      })
    );
    expect(res.status).toBe(201);
    expect(db.rateSheet.create).toHaveBeenCalled();
  });

  it("rejects a grant to a manager outside the owner's downline (403)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ managerId: "mgr-1" }] as never);

    const res = await rateSheetsPOST(
      req(RS_URL, "POST", {
        level: "MANAGER",
        principalId: "mgr-99",
        availableRevenue: 190,
        effectiveDate: DATE,
      })
    );
    expect(res.status).toBe(403);
    expect(db.rateSheet.create).not.toHaveBeenCalled();
  });

  it("rejects an OWNER-level grant (upstream is off-limits) (403)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ managerId: "mgr-1" }] as never);

    const res = await rateSheetsPOST(
      req(RS_URL, "POST", {
        level: "OWNER",
        principalId: "owner-1",
        availableRevenue: 190,
        effectiveDate: DATE,
      })
    );
    expect(res.status).toBe(403);
  });

  it("blocks a grant above the owner's own available revenue unless overridden (422)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ managerId: "mgr-1" }] as never);
    vi.mocked(db.rateSheet.findFirst).mockResolvedValue({ availableRevenue: 250 } as never);

    const res = await rateSheetsPOST(
      req(RS_URL, "POST", {
        level: "MANAGER",
        principalId: "mgr-1",
        availableRevenue: 260,
        effectiveDate: DATE,
      })
    );
    expect(res.status).toBe(422);
  });

  it("scopes the list to the owner's downline MANAGER sheets", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ managerId: "mgr-1" }] as never);
    vi.mocked(db.rateSheet.findMany).mockResolvedValue([] as never);

    const res = await rateSheetsGET();
    expect(res.status).toBe(200);
    const where = vi.mocked(db.rateSheet.findMany).mock.calls[0][0]!.where;
    expect(where).toEqual({ level: "MANAGER", principalId: { in: ["mgr-1"] } });
  });
});

describe("rate-sheets [id] PUT (MARKET_OWNER)", () => {
  it("rejects editing an OWNER-level sheet even for its own owner id (403)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER as never);
    vi.mocked(db.rateSheet.findUnique).mockResolvedValue({
      level: "OWNER",
      principalId: "owner-1",
    } as never);

    const res = await rateSheetPUT(
      req(`${RS_URL}/rs-x`, "PUT", {
        level: "MANAGER",
        principalId: "mgr-1",
        availableRevenue: 190,
        effectiveDate: DATE,
      }) as never,
      params("rs-x")
    );
    expect(res.status).toBe(403);
    expect(db.rateSheet.update).not.toHaveBeenCalled();
  });
});

describe("rate-sheets (other roles)", () => {
  it("forbids a FIELD_MANAGER from the rate-sheets API (403)", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER as never);
    const res = await rateSheetsGET();
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Rep commissions — FIELD_MANAGER edits downline rep pay
// ---------------------------------------------------------------------------

describe("rep-commissions POST (FIELD_MANAGER)", () => {
  function mockManagerScope(repId = "rep-1") {
    vi.mocked(db.blitz.findMany).mockResolvedValue([{ id: "b-1" }] as never);
    vi.mocked(db.blitzAssignment.findMany).mockResolvedValue([{ repId }] as never);
  }

  it("creates an override for a downline rep at or under the cap (201)", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER as never);
    mockManagerScope("rep-1");
    vi.mocked(db.rateSheet.findFirst).mockResolvedValue({ availableRevenue: 180 } as never);
    vi.mocked(db.repCommissionOverride.create).mockResolvedValue({ id: "rc-1" } as never);

    const res = await repCommissionsPOST(
      req(RC_URL, "POST", { repId: "rep-1", amount: 150, effectiveDate: DATE })
    );
    expect(res.status).toBe(201);
    expect(db.repCommissionOverride.create).toHaveBeenCalled();
  });

  it("rejects an override for a rep outside the manager's downline (403)", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER as never);
    mockManagerScope("rep-1");

    const res = await repCommissionsPOST(
      req(RC_URL, "POST", { repId: "rep-99", amount: 150, effectiveDate: DATE })
    );
    expect(res.status).toBe(403);
    expect(db.repCommissionOverride.create).not.toHaveBeenCalled();
  });

  it("blocks pay above the manager's own available revenue unless overridden (422)", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER as never);
    mockManagerScope("rep-1");
    vi.mocked(db.rateSheet.findFirst).mockResolvedValue({ availableRevenue: 180 } as never);

    const res = await repCommissionsPOST(
      req(RC_URL, "POST", { repId: "rep-1", amount: 200, effectiveDate: DATE })
    );
    expect(res.status).toBe(422);
    expect(db.repCommissionOverride.create).not.toHaveBeenCalled();
  });

  it("scopes the list to the manager's downline reps", async () => {
    vi.mocked(auth).mockResolvedValue(MANAGER as never);
    mockManagerScope("rep-1");
    vi.mocked(db.repCommissionOverride.findMany).mockResolvedValue([] as never);

    const res = await repCommissionsGET();
    expect(res.status).toBe(200);
    const where = vi.mocked(db.repCommissionOverride.findMany).mock.calls[0][0]!.where;
    expect(where).toEqual({ repId: { in: ["rep-1"] } });
  });
});

// ---------------------------------------------------------------------------
// ADMIN — unchanged (full access, no scoping)
// ---------------------------------------------------------------------------

describe("ADMIN paths unchanged", () => {
  it("lists all rate sheets with no scoping filter", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN as never);
    vi.mocked(db.rateSheet.findMany).mockResolvedValue([] as never);
    await rateSheetsGET();
    expect(vi.mocked(db.rateSheet.findMany).mock.calls[0][0]!.where).toBeUndefined();
  });

  it("lists all rep overrides with no scoping filter", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN as never);
    vi.mocked(db.repCommissionOverride.findMany).mockResolvedValue([] as never);
    await repCommissionsGET();
    expect(vi.mocked(db.repCommissionOverride.findMany).mock.calls[0][0]!.where).toBeUndefined();
  });
});
