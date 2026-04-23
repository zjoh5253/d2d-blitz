import { vi, describe, it, expect, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// --- Mocks ---

vi.mock("@/lib/auth-mobile", () => ({
  getSessionFromRequest: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    blitzAssignment: {
      findFirst: vi.fn(),
    },
    sale: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Import after mocks are registered
import { POST, GET } from "@/app/api/sales/route"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

// --- Helpers ---

const mockSession = (overrides: Partial<{ id: string; role: string }> = {}) => ({
  user: { id: "rep-1", role: "FIELD_REP", name: "Test Rep", ...overrides },
})

const validBody = {
  blitzId: "blitz-1",
  carrierId: "carrier-1",
  customerName: "Jane Doe",
  customerPhone: "555-0100",
  customerAddress: "123 Main St",
  installDate: "2026-05-01",
}

function makePostRequest(body: Record<string, unknown> = validBody) {
  return new NextRequest("http://localhost/api/sales", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/sales")
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), { method: "GET" })
}

// --- POST Tests ---

describe("POST /api/sales", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null)

    const res = await POST(makePostRequest())

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("returns 400 when required fields are missing", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)

    const res = await POST(
      makePostRequest({ blitzId: "blitz-1" }) // missing most fields
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Validation failed")
  })

  it("returns 403 when rep is not assigned to the blitz", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)
    vi.mocked(db.blitzAssignment.findFirst).mockResolvedValue(null)

    const res = await POST(makePostRequest())

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("You are not assigned to this blitz.")
  })

  it("returns 409 with duplicateSaleId when duplicate address within 30 days", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)
    vi.mocked(db.blitzAssignment.findFirst).mockResolvedValue({ id: "assign-1" } as any)
    vi.mocked(db.sale.findFirst).mockResolvedValue({
      id: "sale-dup-1",
      submittedAt: new Date(),
      customerAddress: "123 Main St",
      status: "SUBMITTED",
    } as any)

    const res = await POST(makePostRequest())

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.duplicateSaleId).toBe("sale-dup-1")
    expect(json.error).toMatch(/already exists/)
  })

  it("ignores a CANCELLED duplicate and allows the sale (returns 201)", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)
    vi.mocked(db.blitzAssignment.findFirst).mockResolvedValue({ id: "assign-1" } as any)
    // Duplicate check returns null (cancelled entries are excluded by the query)
    vi.mocked(db.sale.findFirst).mockResolvedValue(null)
    vi.mocked(db.sale.create).mockResolvedValue({ id: "sale-new-1" } as any)

    const res = await POST(makePostRequest())

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe("sale-new-1")
  })

  it("creates sale and returns 201 on success", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)
    vi.mocked(db.blitzAssignment.findFirst).mockResolvedValue({ id: "assign-1" } as any)
    vi.mocked(db.sale.findFirst).mockResolvedValue(null)
    vi.mocked(db.sale.create).mockResolvedValue({
      id: "sale-123",
      repId: "rep-1",
      blitzId: "blitz-1",
      carrierId: "carrier-1",
      customerName: "Jane Doe",
      customerPhone: "555-0100",
      customerAddress: "123 Main St",
      customerEmail: null,
      installDate: new Date("2026-05-01"),
      orderConfirmation: null,
      status: "SUBMITTED",
      submittedAt: new Date(),
    } as any)

    const res = await POST(makePostRequest())

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe("sale-123")

    // Verify create was called with the right repId
    expect(db.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repId: "rep-1",
          blitzId: "blitz-1",
          carrierId: "carrier-1",
          customerName: "Jane Doe",
        }),
      })
    )
  })
})

// --- GET Tests ---

describe("GET /api/sales", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null)

    const res = await GET(makeGetRequest())

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("returns authenticated user's own sales", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession() as any)
    vi.mocked(db.sale.findMany).mockResolvedValue([{ id: "s1" }] as any)

    const res = await GET(makeGetRequest())

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)

    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-1" }),
      })
    )
  })

  it("allows manager to filter by repId param", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(
      mockSession({ id: "manager-1", role: "FIELD_MANAGER" }) as any
    )
    vi.mocked(db.sale.findMany).mockResolvedValue([{ id: "s2" }] as any)

    const res = await GET(makeGetRequest({ repId: "rep-99" }))

    expect(res.status).toBe(200)
    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-99" }),
      })
    )
  })

  it("ADMIN can also filter by repId param", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(
      mockSession({ id: "admin-1", role: "ADMIN" }) as any
    )
    vi.mocked(db.sale.findMany).mockResolvedValue([] as any)

    const res = await GET(makeGetRequest({ repId: "rep-42" }))

    expect(res.status).toBe(200)
    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-42" }),
      })
    )
  })

  it("ignores repId param for non-manager and returns own sales", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(
      mockSession({ id: "rep-1", role: "FIELD_REP" }) as any
    )
    vi.mocked(db.sale.findMany).mockResolvedValue([{ id: "s3" }] as any)

    // Pass a repId param that should be ignored
    const res = await GET(makeGetRequest({ repId: "other-rep" }))

    expect(res.status).toBe(200)
    // Should use own id, not the param
    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-1" }),
      })
    )
  })
})
