// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    governanceTier: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    governancePeriod: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    sale: {
      count: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET as GET_TIERS, POST as POST_TIER } from "@/app/api/governance-tiers/route"
import {
  GET as GET_TIER_BY_ID,
  PUT as PUT_TIER,
  DELETE as DELETE_TIER,
} from "@/app/api/governance-tiers/[id]/route"
import { POST as CALCULATE } from "@/app/api/governance/calculate/route"
import { GET as GET_PERIODS } from "@/app/api/governance/periods/route"

const mockAuth = vi.mocked(auth)
const mockDb = vi.mocked(db)

const adminSession = { user: { id: "user-admin", role: "ADMIN", name: "Admin" } }
const executiveSession = { user: { id: "user-exec", role: "EXECUTIVE", name: "Exec" } }
const fieldRepSession = { user: { id: "user-rep-1", role: "FIELD_REP", name: "Rep One" } }
const recruiterSession = { user: { id: "user-recruiter", role: "RECRUITER", name: "Recruiter" } }
const fieldManagerSession = { user: { id: "user-mgr", role: "FIELD_MANAGER", name: "Manager" } }

const makeTier = (overrides = {}) => ({
  id: "tier-1",
  name: "Standard",
  rank: 1,
  minInstallRate: 0.7,
  commissionMultiplier: 1.0,
  isDefault: false,
  ...overrides,
})

const makeRequest = (body: unknown, url = "http://localhost/api/test") =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any

const makePutRequest = (body: unknown, url = "http://localhost/api/test") =>
  new Request(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET /api/governance-tiers ────────────────────────────────────────────────

describe("GET /api/governance-tiers", () => {
  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await GET_TIERS()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns list of tiers ordered by rank asc", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const tiers = [makeTier({ rank: 1 }), makeTier({ id: "tier-2", rank: 2 })]
    mockDb.governanceTier.findMany.mockResolvedValueOnce(tiers as any)

    const res = await GET_TIERS()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(tiers)
    expect(mockDb.governanceTier.findMany).toHaveBeenCalledWith({
      orderBy: { rank: "asc" },
    })
  })
})

// ─── POST /api/governance-tiers ───────────────────────────────────────────────

describe("POST /api/governance-tiers", () => {
  const validBody = {
    name: "Gold",
    rank: 2,
    minInstallRate: 0.8,
    commissionMultiplier: 1.2,
    isDefault: false,
  }

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await POST_TIER(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 403 if role is not ADMIN", async () => {
    mockAuth.mockResolvedValueOnce(fieldRepSession as any)

    const res = await POST_TIER(makeRequest(validBody))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 400 on validation failure (missing name)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await POST_TIER(makeRequest({ rank: 1, minInstallRate: 0.7, commissionMultiplier: 1 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 on validation failure (minInstallRate > 1)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await POST_TIER(makeRequest({ ...validBody, minInstallRate: 1.5 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 on validation failure (rank not positive)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await POST_TIER(makeRequest({ ...validBody, rank: 0 }))
    expect(res.status).toBe(400)
  })

  it("unsets existing defaults when isDefault=true", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const created = makeTier({ id: "tier-new", isDefault: true })
    mockDb.governanceTier.updateMany.mockResolvedValueOnce({ count: 1 } as any)
    mockDb.governanceTier.create.mockResolvedValueOnce(created as any)

    const res = await POST_TIER(makeRequest({ ...validBody, isDefault: true }))
    expect(res.status).toBe(201)
    expect(mockDb.governanceTier.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  })

  it("does not call updateMany when isDefault=false", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const created = makeTier({ id: "tier-new" })
    mockDb.governanceTier.create.mockResolvedValueOnce(created as any)

    await POST_TIER(makeRequest(validBody))
    expect(mockDb.governanceTier.updateMany).not.toHaveBeenCalled()
  })

  it("returns 201 with created tier", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const created = makeTier({ id: "tier-new", name: "Gold", rank: 2 })
    mockDb.governanceTier.create.mockResolvedValueOnce(created as any)

    const res = await POST_TIER(makeRequest(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual(created)
  })
})

// ─── GET /api/governance-tiers/[id] ──────────────────────────────────────────

describe("GET /api/governance-tiers/[id]", () => {
  const params = Promise.resolve({ id: "tier-1" })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await GET_TIER_BY_ID(new Request("http://localhost") as any, { params })
    expect(res.status).toBe(401)
  })

  it("returns 404 if tier not found", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.governanceTier.findUnique.mockResolvedValueOnce(null)

    const res = await GET_TIER_BY_ID(new Request("http://localhost") as any, { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Governance tier not found")
  })

  it("returns tier on success", async () => {
    mockAuth.mockResolvedValueOnce(fieldRepSession as any)
    const tier = makeTier()
    mockDb.governanceTier.findUnique.mockResolvedValueOnce(tier as any)

    const res = await GET_TIER_BY_ID(new Request("http://localhost") as any, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(tier)
    expect(mockDb.governanceTier.findUnique).toHaveBeenCalledWith({ where: { id: "tier-1" } })
  })
})

// ─── PUT /api/governance-tiers/[id] ──────────────────────────────────────────

describe("PUT /api/governance-tiers/[id]", () => {
  const params = Promise.resolve({ id: "tier-1" })
  const validBody = {
    name: "Updated",
    rank: 3,
    minInstallRate: 0.75,
    commissionMultiplier: 1.1,
    isDefault: false,
  }

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await PUT_TIER(makePutRequest(validBody), { params })
    expect(res.status).toBe(401)
  })

  it("returns 403 if not ADMIN", async () => {
    mockAuth.mockResolvedValueOnce(executiveSession as any)

    const res = await PUT_TIER(makePutRequest(validBody), { params })
    expect(res.status).toBe(403)
  })

  it("returns 400 on validation failure", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await PUT_TIER(makePutRequest({ name: "" }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Validation failed")
  })

  it("unsets other defaults when isDefault=true", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const updated = makeTier({ isDefault: true })
    mockDb.governanceTier.updateMany.mockResolvedValueOnce({ count: 1 } as any)
    mockDb.governanceTier.update.mockResolvedValueOnce(updated as any)

    const res = await PUT_TIER(makePutRequest({ ...validBody, isDefault: true }), { params })
    expect(res.status).toBe(200)
    expect(mockDb.governanceTier.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true, id: { not: "tier-1" } },
      data: { isDefault: false },
    })
  })

  it("returns updated tier on success", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const updated = makeTier({ name: "Updated", rank: 3 })
    mockDb.governanceTier.update.mockResolvedValueOnce(updated as any)

    const res = await PUT_TIER(makePutRequest(validBody), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(updated)
  })
})

// ─── DELETE /api/governance-tiers/[id] ───────────────────────────────────────

describe("DELETE /api/governance-tiers/[id]", () => {
  const params = Promise.resolve({ id: "tier-1" })
  const deleteRequest = new Request("http://localhost", { method: "DELETE" }) as any

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await DELETE_TIER(deleteRequest, { params })
    expect(res.status).toBe(401)
  })

  it("returns 403 if not ADMIN", async () => {
    mockAuth.mockResolvedValueOnce(fieldManagerSession as any)

    const res = await DELETE_TIER(deleteRequest, { params })
    expect(res.status).toBe(403)
  })

  it("returns 409 if users are assigned to this tier", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.count.mockResolvedValueOnce(3)

    const res = await DELETE_TIER(deleteRequest, { params })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain("3")
    expect(body.error).toContain("user")
  })

  it("deletes tier and returns success when no users assigned", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.count.mockResolvedValueOnce(0)
    mockDb.governanceTier.delete.mockResolvedValueOnce(makeTier() as any)

    const res = await DELETE_TIER(deleteRequest, { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
    expect(mockDb.governanceTier.delete).toHaveBeenCalledWith({ where: { id: "tier-1" } })
  })
})

// ─── POST /api/governance/calculate ──────────────────────────────────────────

describe("POST /api/governance/calculate", () => {
  const validBody = { month: 6, year: 2025 }

  const mockRep = {
    id: "rep-1",
    name: "John Rep",
    role: "FIELD_REP",
    status: "ACTIVE",
    governanceTier: makeTier({ minInstallRate: 0.7 }),
  }

  const mockTier = makeTier({ id: "tier-1", rank: 1, isDefault: true, minInstallRate: 0.7 })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 403 if role is FIELD_REP", async () => {
    mockAuth.mockResolvedValueOnce(fieldRepSession as any)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 403 if role is FIELD_MANAGER", async () => {
    mockAuth.mockResolvedValueOnce(fieldManagerSession as any)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("returns 400 on validation failure (month out of range)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await CALCULATE(makeRequest({ month: 13, year: 2025 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 on validation failure (year below 2020)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const res = await CALCULATE(makeRequest({ month: 6, year: 2019 }))
    expect(res.status).toBe(400)
  })

  it("returns 422 if no governance tiers configured", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([])
    mockDb.governanceTier.findMany.mockResolvedValueOnce([])

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("No governance tiers configured")
  })

  it("allows EXECUTIVE role to calculate", async () => {
    mockAuth.mockResolvedValueOnce(executiveSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([])
    mockDb.governanceTier.findMany.mockResolvedValueOnce([mockTier])

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(200)
  })

  it("processes reps and returns results", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([mockRep] as any)
    mockDb.governanceTier.findMany.mockResolvedValueOnce([mockTier] as any)
    // submittedInstalls count
    mockDb.sale.count
      .mockResolvedValueOnce(10) // submitted
      .mockResolvedValueOnce(8)  // verified
    // previous period
    mockDb.governancePeriod.findUnique.mockResolvedValueOnce(null)
    mockDb.governancePeriod.upsert.mockResolvedValueOnce({} as any)
    mockDb.user.update.mockResolvedValueOnce({} as any)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.month).toBe(6)
    expect(body.year).toBe(2025)
    expect(body.repsProcessed).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(body.results[0].repId).toBe("rep-1")
    expect(body.results[0].submittedInstalls).toBe(10)
    expect(body.results[0].verifiedInstalls).toBe(8)
    expect(body.results[0].installRate).toBeCloseTo(0.8)
    expect(body.results[0].isStrike).toBe(false)
  })

  it("records a strike when installRate < minInstallRate", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([mockRep] as any)
    mockDb.governanceTier.findMany.mockResolvedValueOnce([mockTier] as any)
    mockDb.sale.count
      .mockResolvedValueOnce(10) // submitted
      .mockResolvedValueOnce(5)  // verified (50% < 70%)
    mockDb.governancePeriod.findUnique.mockResolvedValueOnce(null)
    mockDb.governancePeriod.upsert.mockResolvedValueOnce({} as any)
    mockDb.user.update.mockResolvedValueOnce({} as any)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].isStrike).toBe(true)
    expect(body.results[0].consecutiveStrikes).toBe(1)
  })

  it("accumulates consecutive strikes from previous period", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([mockRep] as any)
    mockDb.governanceTier.findMany.mockResolvedValueOnce([mockTier] as any)
    mockDb.sale.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5) // strike
    mockDb.governancePeriod.findUnique.mockResolvedValueOnce({
      consecutiveStrikes: 1,
      tierId: "tier-1",
    } as any)
    mockDb.governancePeriod.upsert.mockResolvedValueOnce({} as any)
    mockDb.user.update.mockResolvedValueOnce({} as any)

    const res = await CALCULATE(makeRequest(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].consecutiveStrikes).toBe(2)
  })

  it("upserts governance period and updates user tier", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.user.findMany.mockResolvedValueOnce([mockRep] as any)
    mockDb.governanceTier.findMany.mockResolvedValueOnce([mockTier] as any)
    mockDb.sale.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8)
    mockDb.governancePeriod.findUnique.mockResolvedValueOnce(null)
    mockDb.governancePeriod.upsert.mockResolvedValueOnce({} as any)
    mockDb.user.update.mockResolvedValueOnce({} as any)

    await CALCULATE(makeRequest(validBody))

    expect(mockDb.governancePeriod.upsert).toHaveBeenCalledTimes(1)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "rep-1" },
      data: { governanceTierId: expect.any(String) },
    })
  })
})

// ─── GET /api/governance/periods ─────────────────────────────────────────────

describe("GET /api/governance/periods", () => {
  const makePeriod = (overrides = {}) => ({
    id: "period-1",
    repId: "rep-1",
    month: 6,
    year: 2025,
    submittedInstalls: 10,
    verifiedInstalls: 8,
    installRate: 0.8,
    tierId: "tier-1",
    isStrike: false,
    consecutiveStrikes: 0,
    rep: { id: "rep-1", name: "Rep One", email: "rep@test.com" },
    tier: { id: "tier-1", name: "Standard", rank: 1 },
    ...overrides,
  })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValueOnce(null)

    const request = new Request("http://localhost/api/governance/periods") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid query params (month out of range)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const request = new Request("http://localhost/api/governance/periods?month=13&year=2025") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(400)
  })

  it("returns 400 on invalid query params (year out of range)", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)

    const request = new Request("http://localhost/api/governance/periods?month=6&year=2019") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(400)
  })

  it("managers can filter by repId", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const periods = [makePeriod()]
    mockDb.governancePeriod.findMany.mockResolvedValueOnce(periods as any)

    const request = new Request("http://localhost/api/governance/periods?repId=rep-1&month=6&year=2025") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(200)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-1" }),
      })
    )
  })

  it("EXECUTIVE can also filter by repId", async () => {
    mockAuth.mockResolvedValueOnce(executiveSession as any)
    mockDb.governancePeriod.findMany.mockResolvedValueOnce([])

    const request = new Request("http://localhost/api/governance/periods?repId=rep-2") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(200)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-2" }),
      })
    )
  })

  it("FIELD_MANAGER can filter by repId", async () => {
    mockAuth.mockResolvedValueOnce(fieldManagerSession as any)
    mockDb.governancePeriod.findMany.mockResolvedValueOnce([])

    const request = new Request("http://localhost/api/governance/periods?repId=rep-3") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(200)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-3" }),
      })
    )
  })

  it("non-managers (FIELD_REP) are forced to their own repId", async () => {
    mockAuth.mockResolvedValueOnce(fieldRepSession as any)
    const periods = [makePeriod({ repId: "user-rep-1" })]
    mockDb.governancePeriod.findMany.mockResolvedValueOnce(periods as any)

    // Even if they pass a different repId, it's ignored
    const request = new Request("http://localhost/api/governance/periods?repId=some-other-rep") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(200)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "user-rep-1" }),
      })
    )
  })

  it("non-managers (RECRUITER) are forced to their own repId", async () => {
    mockAuth.mockResolvedValueOnce(recruiterSession as any)
    mockDb.governancePeriod.findMany.mockResolvedValueOnce([])

    const request = new Request("http://localhost/api/governance/periods") as any
    await GET_PERIODS(request)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "user-recruiter" }),
      })
    )
  })

  it("returns periods array on success", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    const periods = [makePeriod(), makePeriod({ id: "period-2", month: 5 })]
    mockDb.governancePeriod.findMany.mockResolvedValueOnce(periods as any)

    const request = new Request("http://localhost/api/governance/periods?month=6&year=2025") as any
    const res = await GET_PERIODS(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(periods)
  })

  it("filters by month and year when provided", async () => {
    mockAuth.mockResolvedValueOnce(adminSession as any)
    mockDb.governancePeriod.findMany.mockResolvedValueOnce([])

    const request = new Request("http://localhost/api/governance/periods?month=3&year=2024") as any
    await GET_PERIODS(request)
    expect(mockDb.governancePeriod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ month: 3, year: 2024 }),
      })
    )
  })
})
