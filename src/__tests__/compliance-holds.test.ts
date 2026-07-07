// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    complianceHold: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    blitz: {
      findMany: vi.fn(),
    },
    dailyReport: {
      findFirst: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "@/app/api/compliance-holds/route"
import { PUT } from "@/app/api/compliance-holds/[id]/route"
import { POST as COMPLIANCE_CHECK } from "@/app/api/compliance/check/route"

const mockAuth = vi.mocked(auth)
const mockFindMany = vi.mocked(db.complianceHold.findMany)
const mockFindUnique = vi.mocked(db.complianceHold.findUnique)
const mockFindFirst = vi.mocked(db.complianceHold.findFirst)
const mockCreate = vi.mocked(db.complianceHold.create)
const mockUpdate = vi.mocked(db.complianceHold.update)
const mockBlitzFindMany = vi.mocked(db.blitz.findMany)
const mockDailyReportFindFirst = vi.mocked(db.dailyReport.findFirst)

function makeSession(role: string, id = "user-1") {
  return { user: { id, role, name: "Test User", email: "test@example.com" } }
}

describe("GET /api/compliance-holds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValue(null)
    const request = new Request("http://localhost/api/compliance-holds")
    const response = await GET(request as any)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns list of holds for manager with no filters", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    const holds = [
      { id: "hold-1", repId: "rep-1", reason: "test", holdDate: new Date(), restoredDate: null },
    ]
    mockFindMany.mockResolvedValue(holds as any)

    const request = new Request("http://localhost/api/compliance-holds")
    const response = await GET(request as any)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("hold-1")
  })

  it("filters by activeOnly=true for managers", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?activeOnly=true")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ restoredDate: null }),
      })
    )
  })

  it("does not add restoredDate filter when activeOnly is not 'true'", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?activeOnly=false")
    await GET(request as any)

    const callArgs = mockFindMany.mock.calls[0][0] as any
    expect(callArgs.where).not.toHaveProperty("restoredDate")
  })

  it("allows manager to filter by repId", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_MANAGER") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?repId=rep-99")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-99" }),
      })
    )
  })

  it("allows EXECUTIVE role to filter by repId", async () => {
    mockAuth.mockResolvedValue(makeSession("EXECUTIVE") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?repId=rep-42")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-42" }),
      })
    )
  })

  it("allows MARKET_OWNER role to filter by repId", async () => {
    mockAuth.mockResolvedValue(makeSession("MARKET_OWNER") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?repId=rep-77")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "rep-77" }),
      })
    )
  })

  it("forces FIELD_REP to see only their own holds, ignoring repId param", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP", "user-rep-1") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds?repId=rep-99")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "user-rep-1" }),
      })
    )
  })

  it("FIELD_REP sees only their own holds even without repId param", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP", "user-rep-2") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds")
    await GET(request as any)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ repId: "user-rep-2" }),
      })
    )
  })

  it("manager with no repId param sees all holds (no repId filter)", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockFindMany.mockResolvedValue([] as any)

    const request = new Request("http://localhost/api/compliance-holds")
    await GET(request as any)

    const callArgs = mockFindMany.mock.calls[0][0] as any
    expect(callArgs.where).not.toHaveProperty("repId")
  })
})

describe("PUT /api/compliance-holds/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValue(null)
    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 if role is FIELD_REP", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 403 if role is MARKET_OWNER", async () => {
    mockAuth.mockResolvedValue(makeSession("MARKET_OWNER") as any)
    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(403)
  })

  it("returns 404 if hold not found", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockFindUnique.mockResolvedValue(null)

    const request = new Request("http://localhost/api/compliance-holds/hold-missing", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-missing" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Hold not found")
  })

  it("returns 409 if hold already restored", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockFindUnique.mockResolvedValue({ id: "hold-1", restoredDate: new Date("2024-01-01") } as any)

    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe("Hold is already restored")
  })

  it("restores hold successfully for ADMIN role", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN", "admin-1") as any)
    mockFindUnique.mockResolvedValue({ id: "hold-1", restoredDate: null } as any)
    const updatedHold = {
      id: "hold-1",
      restoredDate: new Date(),
      restoredById: "admin-1",
      rep: { id: "rep-1", name: "Rep One", email: "rep@example.com" },
      restoredBy: { id: "admin-1", name: "Admin" },
    }
    mockUpdate.mockResolvedValue(updatedHold as any)

    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe("hold-1")
    expect(body.restoredById).toBe("admin-1")
  })

  it("restores hold successfully for EXECUTIVE role", async () => {
    mockAuth.mockResolvedValue(makeSession("EXECUTIVE", "exec-1") as any)
    mockFindUnique.mockResolvedValue({ id: "hold-2", restoredDate: null } as any)
    mockUpdate.mockResolvedValue({ id: "hold-2", restoredById: "exec-1" } as any)

    const request = new Request("http://localhost/api/compliance-holds/hold-2", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-2" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(200)
  })

  it("restores hold successfully for FIELD_MANAGER role", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_MANAGER", "fm-1") as any)
    mockFindUnique.mockResolvedValue({ id: "hold-3", restoredDate: null } as any)
    mockUpdate.mockResolvedValue({ id: "hold-3", restoredById: "fm-1" } as any)

    const request = new Request("http://localhost/api/compliance-holds/hold-3", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-3" })
    const response = await PUT(request as any, { params })
    expect(response.status).toBe(200)
  })

  it("calls update with restoredDate and restoredById", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN", "admin-1") as any)
    mockFindUnique.mockResolvedValue({ id: "hold-1", restoredDate: null } as any)
    mockUpdate.mockResolvedValue({ id: "hold-1" } as any)

    const request = new Request("http://localhost/api/compliance-holds/hold-1", { method: "PUT" })
    const params = Promise.resolve({ id: "hold-1" })
    await PUT(request as any, { params })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "hold-1" },
        data: expect.objectContaining({
          restoredById: "admin-1",
          restoredDate: expect.any(Date),
        }),
      })
    )
  })
})

describe("POST /api/compliance/check", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    mockAuth.mockResolvedValue(null)
    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 if role is FIELD_REP", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 403 if role is MARKET_OWNER", async () => {
    mockAuth.mockResolvedValue(makeSession("MARKET_OWNER") as any)
    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(403)
  })

  it("returns holdsCreated/holdsRestored/checkedAt when no active blitzes", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockBlitzFindMany.mockResolvedValue([])

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("holdsCreated", 0)
    expect(body).toHaveProperty("holdsRestored", 0)
    expect(body).toHaveProperty("checkedAt")
  })

  it("creates a hold when daily report is missing and no existing hold", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)

    const today = new Date()
    today.setHours(12, 0, 0, 0)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Test Blitz",
        status: "ACTIVE",
        startDate: today,
        endDate: today,
        assignments: [
          {
            id: "assign-1",
            status: "ASSIGNED",
            rep: { id: "rep-1", name: "Rep One" },
          },
        ],
      },
    ] as any)

    // No daily report found
    mockDailyReportFindFirst.mockResolvedValue(null)
    // No existing hold
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: "hold-new" } as any)

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.holdsCreated).toBe(1)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it("does not create a hold when daily report exists", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)

    const today = new Date()
    today.setHours(12, 0, 0, 0)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Test Blitz",
        status: "ACTIVE",
        startDate: today,
        endDate: today,
        assignments: [
          {
            id: "assign-1",
            status: "ASSIGNED",
            rep: { id: "rep-1", name: "Rep One" },
          },
        ],
      },
    ] as any)

    // Daily report found
    mockDailyReportFindFirst.mockResolvedValue({ id: "report-1" } as any)

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.holdsCreated).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("does not create a duplicate hold when an active hold already exists for same reason", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)

    const today = new Date()
    today.setHours(12, 0, 0, 0)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Test Blitz",
        status: "ACTIVE",
        startDate: today,
        endDate: today,
        assignments: [
          {
            id: "assign-1",
            status: "ASSIGNED",
            rep: { id: "rep-1", name: "Rep One" },
          },
        ],
      },
    ] as any)

    mockDailyReportFindFirst.mockResolvedValue(null)
    // Existing active hold found
    mockFindFirst.mockResolvedValue({ id: "hold-existing", restoredDate: null } as any)

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.holdsCreated).toBe(0)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates holds for each missing day across multiple days", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_MANAGER") as any)

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Multi-Day Blitz",
        status: "ACTIVE",
        startDate: yesterday,
        endDate: today,
        assignments: [
          {
            id: "assign-1",
            status: "CONFIRMED",
            rep: { id: "rep-1", name: "Rep One" },
          },
        ],
      },
    ] as any)

    mockDailyReportFindFirst.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: "hold-new" } as any)

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    // 2 days, 1 rep = 2 holds
    expect(body.holdsCreated).toBe(2)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it("creates holds for multiple assignments", async () => {
    mockAuth.mockResolvedValue(makeSession("EXECUTIVE") as any)

    const today = new Date()
    today.setHours(12, 0, 0, 0)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Team Blitz",
        status: "ACTIVE",
        startDate: today,
        endDate: today,
        assignments: [
          { id: "assign-1", status: "ACTIVE", rep: { id: "rep-1", name: "Rep One" } },
          { id: "assign-2", status: "ACTIVE", rep: { id: "rep-2", name: "Rep Two" } },
        ],
      },
    ] as any)

    mockDailyReportFindFirst.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: "hold-new" } as any)

    const response = await COMPLIANCE_CHECK()
    expect(response.status).toBe(200)
    const body = await response.json()
    // 1 day, 2 reps = 2 holds
    expect(body.holdsCreated).toBe(2)
  })

  it("creates hold with correct reason string referencing blitz name and date", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)

    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const todayStr = new Date(new Date(today).setHours(0, 0, 0, 0)).toISOString().slice(0, 10)

    mockBlitzFindMany.mockResolvedValue([
      {
        id: "blitz-1",
        name: "Named Blitz",
        status: "ACTIVE",
        startDate: today,
        endDate: today,
        assignments: [
          { id: "assign-1", status: "ASSIGNED", rep: { id: "rep-1", name: "Rep One" } },
        ],
      },
    ] as any)

    mockDailyReportFindFirst.mockResolvedValue(null)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: "hold-new" } as any)

    await COMPLIANCE_CHECK()

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repId: "rep-1",
          reason: `Missing daily report for blitz "Named Blitz" on ${todayStr}`,
        }),
      })
    )
  })

  it("response includes checkedAt as ISO string", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockBlitzFindMany.mockResolvedValue([])

    const response = await COMPLIANCE_CHECK()
    const body = await response.json()
    expect(() => new Date(body.checkedAt)).not.toThrow()
    expect(body.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
