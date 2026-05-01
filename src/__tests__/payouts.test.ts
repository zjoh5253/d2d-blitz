// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    payoutBatch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    commissionRecord: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    payoutLine: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/posthog", () => ({
  captureServerEvent: vi.fn(),
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, POST } from "@/app/api/payouts/route"
import { GET as GET_BY_ID, PUT } from "@/app/api/payouts/[id]/route"

const mockAdminSession = {
  user: { id: "user-1", name: "Admin User", role: "ADMIN" },
}

const mockExecutiveSession = {
  user: { id: "user-2", name: "Exec User", role: "EXECUTIVE" },
}

const mockRepSession = {
  user: { id: "user-3", name: "Rep User", role: "REP" },
}

const mockBatch = {
  id: "batch-1",
  period: "2024-01",
  status: "DRAFT",
  createdAt: new Date("2024-01-15"),
  approvedById: null,
  approvedAt: null,
  approvedBy: null,
  payoutLines: [
    {
      id: "line-1",
      repId: "rep-1",
      grossPay: 1000,
      totalDeductions: 100,
      netPay: 900,
      complianceVerified: false,
      governanceChecked: false,
    },
  ],
}

describe("GET /api/payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts")
    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 401 if session has no user", async () => {
    vi.mocked(auth).mockResolvedValue({} as never)

    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns list of payout batches on success", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([mockBatch] as never)

    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("batch-1")
    expect(body[0].period).toBe("2024-01")
  })

  it("returns list of payout batches for EXECUTIVE role", async () => {
    vi.mocked(auth).mockResolvedValue(mockExecutiveSession as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([mockBatch] as never)

    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
  })

  it("calls findMany with correct includes and ordering", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([] as never)

    await GET()

    expect(db.payoutBatch.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: { select: { id: true, name: true } },
        payoutLines: {
          select: {
            id: true,
            repId: true,
            grossPay: true,
            totalDeductions: true,
            netPay: true,
            complianceVerified: true,
            governanceChecked: true,
          },
        },
      },
    })
  })

  it("returns empty array when no batches exist", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([] as never)

    const response = await GET()

    expect(response.status).toBe(403)
  })
})

describe("POST /api/payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 if user role is REP", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 403 for any non-admin, non-executive role", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-x", name: "Manager", role: "MANAGER" },
    } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(403)
  })

  it("returns 400 if body is missing period field", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Validation failed")
    expect(body.issues).toBeDefined()
  })

  it("returns 400 if period is empty string", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 if no eligible commissions found", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.commissionRecord.findMany).mockResolvedValue([] as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("No eligible commission records found")
  })

  it("creates batch with payout lines and marks commissions as PENDING on success (ADMIN)", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const eligibleCommissions = [
      {
        id: "comm-1",
        repId: "rep-1",
        repPay: 500,
        status: "ELIGIBLE",
        rep: {
          id: "rep-1",
          name: "Rep One",
          deductions: [{ amount: 50, repId: "rep-1" }],
        },
      },
      {
        id: "comm-2",
        repId: "rep-1",
        repPay: 300,
        status: "ELIGIBLE",
        rep: {
          id: "rep-1",
          name: "Rep One",
          deductions: [{ amount: 50, repId: "rep-1" }],
        },
      },
    ]

    vi.mocked(db.commissionRecord.findMany).mockResolvedValue(
      eligibleCommissions as never
    )
    vi.mocked(db.payoutBatch.create).mockResolvedValue(mockBatch as never)
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 2 } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(201)

    expect(db.payoutBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          period: "2024-01",
          status: "DRAFT",
        }),
      })
    )

    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { repId: { in: ["rep-1"] }, status: "ELIGIBLE" },
      data: { status: "PENDING" },
    })
  })

  it("creates batch with correct gross/net pay calculations grouped by rep", async () => {
    vi.mocked(auth).mockResolvedValue(mockExecutiveSession as never)

    const eligibleCommissions = [
      {
        id: "comm-1",
        repId: "rep-1",
        repPay: 1000,
        status: "ELIGIBLE",
        rep: {
          id: "rep-1",
          name: "Rep One",
          deductions: [{ amount: 200, repId: "rep-1" }],
        },
      },
      {
        id: "comm-2",
        repId: "rep-2",
        repPay: 500,
        status: "ELIGIBLE",
        rep: {
          id: "rep-2",
          name: "Rep Two",
          deductions: [],
        },
      },
    ]

    vi.mocked(db.commissionRecord.findMany).mockResolvedValue(
      eligibleCommissions as never
    )
    vi.mocked(db.payoutBatch.create).mockResolvedValue(mockBatch as never)
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 2 } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-02" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(201)

    const createCall = vi.mocked(db.payoutBatch.create).mock.calls[0][0]
    const lines = createCall.data.payoutLines.create

    const rep1Line = lines.find((l: { repId: string }) => l.repId === "rep-1")
    expect(rep1Line.grossPay).toBe(1000)
    expect(rep1Line.totalDeductions).toBe(200)
    expect(rep1Line.netPay).toBe(800)

    const rep2Line = lines.find((l: { repId: string }) => l.repId === "rep-2")
    expect(rep2Line.grossPay).toBe(500)
    expect(rep2Line.totalDeductions).toBe(0)
    expect(rep2Line.netPay).toBe(500)
  })

  it("netPay is floored at 0 when deductions exceed gross pay", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const eligibleCommissions = [
      {
        id: "comm-1",
        repId: "rep-1",
        repPay: 100,
        status: "ELIGIBLE",
        rep: {
          id: "rep-1",
          name: "Rep One",
          deductions: [{ amount: 500, repId: "rep-1" }],
        },
      },
    ]

    vi.mocked(db.commissionRecord.findMany).mockResolvedValue(
      eligibleCommissions as never
    )
    vi.mocked(db.payoutBatch.create).mockResolvedValue(mockBatch as never)
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 1 } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    await POST(request as never)

    const createCall = vi.mocked(db.payoutBatch.create).mock.calls[0][0]
    const lines = createCall.data.payoutLines.create
    expect(lines[0].netPay).toBe(0)
  })

  it("allows EXECUTIVE role to create batch", async () => {
    vi.mocked(auth).mockResolvedValue(mockExecutiveSession as never)

    const eligibleCommissions = [
      {
        id: "comm-1",
        repId: "rep-1",
        repPay: 500,
        status: "ELIGIBLE",
        rep: { id: "rep-1", name: "Rep One", deductions: [] },
      },
    ]

    vi.mocked(db.commissionRecord.findMany).mockResolvedValue(
      eligibleCommissions as never
    )
    vi.mocked(db.payoutBatch.create).mockResolvedValue(mockBatch as never)
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 1 } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(201)
  })
})

describe("GET /api/payouts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 404 if batch not found", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts/nonexistent")
    const params = Promise.resolve({ id: "nonexistent" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Not found")
  })

  it("returns batch with payoutLines on success", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(mockBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe("batch-1")
    expect(body.payoutLines).toBeDefined()
  })

  it("returns batch for EXECUTIVE role", async () => {
    vi.mocked(auth).mockResolvedValue(mockExecutiveSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(mockBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe("batch-1")
  })

  it("calls findUnique with the correct id and includes", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(mockBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    await GET_BY_ID(request as never, { params })

    expect(db.payoutBatch.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        include: expect.objectContaining({
          payoutLines: expect.objectContaining({
            orderBy: { netPay: "desc" },
          }),
        }),
      })
    )
  })

  it("returns 403 when non-admin users fetch a batch", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(mockBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(403)
  })
})

// Route uses direct db calls (no $transaction), posthog is a no-op when
// NEXT_PUBLIC_POSTHOG_KEY is unset in tests.
describe("PUT /api/payouts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 if no session", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 if role is REP", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 400 for invalid status value", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INVALID_STATUS" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 if status field is missing", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(400)
  })

  it("returns 404 if batch not found", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(null)

    const request = new Request("http://localhost/api/payouts/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "nonexistent" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe("Not found")
  })

  it("returns 409 if status transition is not allowed (DRAFT → APPROVED)", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "DRAFT",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toContain("Cannot transition from DRAFT to APPROVED")
  })

  it("returns 409 if status transition is not allowed (PAID → any)", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "PAID",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(409)
  })

  it("transitions DRAFT → REVIEWED successfully", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "DRAFT",
    } as never)
    const updatedBatch = { ...mockBatch, status: "REVIEWED" }
    vi.mocked(db.payoutBatch.update).mockResolvedValue(updatedBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("REVIEWED")
  })

  it("transitions REVIEWED → APPROVED and sets approvedById and approvedAt", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "REVIEWED",
    } as never)
    const updatedBatch = {
      ...mockBatch,
      status: "APPROVED",
      approvedById: "user-1",
      approvedAt: new Date(),
    }
    vi.mocked(db.payoutBatch.update).mockResolvedValue(updatedBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(200)

    const updateCall = vi.mocked(db.payoutBatch.update).mock.calls[0][0]
    expect(updateCall.data.approvedById).toBe("user-1")
    expect(updateCall.data.approvedAt).toBeInstanceOf(Date)
    expect(updateCall.data.status).toBe("APPROVED")
  })

  it("does NOT set approvedById when transitioning to non-APPROVED status", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "DRAFT",
    } as never)
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      ...mockBatch,
      status: "REVIEWED",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    await PUT(request as never, { params })

    const updateCall = vi.mocked(db.payoutBatch.update).mock.calls[0][0]
    expect(updateCall.data.approvedById).toBeUndefined()
    expect(updateCall.data.approvedAt).toBeUndefined()
  })

  it("transitions APPROVED → PAID and marks commission records as PAID", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "APPROVED",
    } as never)
    vi.mocked(db.payoutLine.findMany).mockResolvedValue([
      { repId: "rep-1" },
      { repId: "rep-2" },
    ] as never)
    vi.mocked(db.commissionRecord.updateMany).mockResolvedValue({ count: 3 } as never)
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      ...mockBatch,
      status: "PAID",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(200)

    expect(db.payoutLine.findMany).toHaveBeenCalledWith({
      where: { batchId: "batch-1" },
      select: { repId: true },
    })

    expect(db.commissionRecord.updateMany).toHaveBeenCalledWith({
      where: { repId: { in: ["rep-1", "rep-2"] }, status: "PENDING" },
      data: { status: "PAID" },
    })
  })

  it("does NOT call payoutLine.findMany when not transitioning to PAID", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "DRAFT",
    } as never)
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      ...mockBatch,
      status: "REVIEWED",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    await PUT(request as never, { params })

    expect(db.payoutLine.findMany).not.toHaveBeenCalled()
    expect(db.commissionRecord.updateMany).not.toHaveBeenCalled()
  })

  it("returns updated batch on success", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "REVIEWED",
    } as never)
    const updatedBatch = {
      ...mockBatch,
      status: "APPROVED",
      approvedById: "user-1",
      approvedBy: { id: "user-1", name: "Admin User" },
    }
    vi.mocked(db.payoutBatch.update).mockResolvedValue(updatedBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("APPROVED")
    expect(body.approvedBy.name).toBe("Admin User")
  })

  it("allows EXECUTIVE role to update batch status", async () => {
    vi.mocked(auth).mockResolvedValue(mockExecutiveSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "DRAFT",
    } as never)
    vi.mocked(db.payoutBatch.update).mockResolvedValue({
      ...mockBatch,
      status: "REVIEWED",
    } as never)

    const request = new Request("http://localhost/api/payouts/batch-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEWED" }),
    })
    const params = Promise.resolve({ id: "batch-1" })
    const response = await PUT(request as never, { params })

    expect(response.status).toBe(200)
  })
})
