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
    payoutLine: {
      findMany: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { GET } from "@/app/api/mobile/payouts/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetSession = vi.mocked(getSessionFromRequest)
const mockPayoutLineFindMany = vi.mocked(db.payoutLine.findMany)

function makeSession(id = "rep-1") {
  return { user: { id, email: "rep@test.com", name: "Test Rep", role: "FIELD_REP" } }
}

// ===========================================================================
// GET /api/mobile/payouts
// ===========================================================================

describe("GET /api/mobile/payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const req = new Request("http://localhost/api/mobile/payouts")
    const res = await GET(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("scopes the db query to the authenticated rep's id", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-42"))
    mockPayoutLineFindMany.mockResolvedValue([])

    const req = new Request("http://localhost/api/mobile/payouts")
    await GET(req as any)

    expect(mockPayoutLineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-42" }),
      })
    )
  })

  it("returns 200 with mapped payout items in expected shape", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockPayoutLineFindMany.mockResolvedValue([
      {
        repId: "rep-1",
        grossPay: 1200,
        totalDeductions: 200,
        netPay: 1000,
        batch: {
          id: "batch-1",
          period: "2025-05",
          status: "PAID",
          createdAt: new Date("2025-05-31T00:00:00.000Z"),
        },
      },
    ] as any)

    const req = new Request("http://localhost/api/mobile/payouts")
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      batchId: "batch-1",
      period: "2025-05",
      batchStatus: "PAID",
      grossPay: 1200,
      totalDeductions: 200,
      netPay: 1000,
    })
  })

  it("returns empty array when rep has no payout lines", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-99"))
    mockPayoutLineFindMany.mockResolvedValue([])

    const req = new Request("http://localhost/api/mobile/payouts")
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})
