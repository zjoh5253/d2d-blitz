// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — declared before route imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth-mobile", () => ({
  getSessionFromRequest: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    blitzAssignment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { PATCH } from "@/app/api/blitzes/my-assignment/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetSession = vi.mocked(getSessionFromRequest)
const mockFindFirst = vi.mocked(db.blitzAssignment.findFirst)
const mockUpdate = vi.mocked(db.blitzAssignment.update)

function makeSession(id = "rep-1") {
  return { user: { id, email: "rep@test.com", name: "Test Rep", role: "FIELD_REP" } }
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign-1",
    status: "ASSIGNED",
    repId: "rep-1",
    arrivalConfirmed: false,
    housingAssignment: null,
    travelCoordination: null,
    blitz: {
      id: "blitz-1",
      name: "Test Blitz",
      startDate: new Date("2025-06-01T00:00:00.000Z"),
      endDate: new Date("2025-06-07T00:00:00.000Z"),
      status: "ACTIVE",
      market: {
        name: "Phoenix",
        carrier: { name: "SunPower" },
      },
    },
    ...overrides,
  }
}

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/blitzes/my-assignment", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ===========================================================================
// PATCH /api/blitzes/my-assignment
// ===========================================================================

describe("PATCH /api/blitzes/my-assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const req = makePatchRequest({ arrivalConfirmed: true })
    const res = await PATCH(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 404 when no active assignment found for rep", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockFindFirst.mockResolvedValue(null)
    const req = makePatchRequest({ arrivalConfirmed: true })
    const res = await PATCH(req as any)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("No active assignment")
  })

  it("auto-advances status from ASSIGNED to CONFIRMED when arrivalConfirmed=true without explicit status", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockFindFirst.mockResolvedValue(makeAssignment({ status: "ASSIGNED" }) as any)
    const updated = makeAssignment({ status: "CONFIRMED", arrivalConfirmed: true })
    mockUpdate.mockResolvedValue(updated as any)

    const req = makePatchRequest({ arrivalConfirmed: true })
    const res = await PATCH(req as any)
    expect(res.status).toBe(200)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assign-1" },
        data: expect.objectContaining({
          arrivalConfirmed: true,
          status: "CONFIRMED",
        }),
      })
    )
  })

  it("does not auto-advance when arrivalConfirmed=true but explicit status override is provided", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockFindFirst.mockResolvedValue(makeAssignment({ status: "ASSIGNED" }) as any)
    const updated = makeAssignment({ status: "IN_TRANSIT", arrivalConfirmed: true })
    mockUpdate.mockResolvedValue(updated as any)

    const req = makePatchRequest({ arrivalConfirmed: true, status: "IN_TRANSIT" })
    const res = await PATCH(req as any)
    expect(res.status).toBe(200)

    // The explicit status should be used, not auto-advanced to CONFIRMED
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_TRANSIT" }),
      })
    )
  })

  it("returns activeAssignment shape with arrivalConfirmed set", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockFindFirst.mockResolvedValue(makeAssignment({ status: "CONFIRMED" }) as any)
    const updated = makeAssignment({ status: "CONFIRMED", arrivalConfirmed: true })
    mockUpdate.mockResolvedValue(updated as any)

    const req = makePatchRequest({ arrivalConfirmed: true })
    const res = await PATCH(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("activeAssignment")
    expect(body.activeAssignment.arrivalConfirmed).toBe(true)
    expect(body.activeAssignment.id).toBe("assign-1")
    expect(body.activeAssignment).toHaveProperty("blitz")
    expect(body.activeAssignment.blitz.market).toBeDefined()
  })
})
