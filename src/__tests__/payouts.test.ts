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
    overrideEarning: {
      updateMany: vi.fn(),
    },
    payoutLine: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/services/stripe-payout", () => ({
  payBatchViaStripe: vi.fn(),
}))

vi.mock("@/lib/services/payout", () => ({
  createPayoutBatch: vi.fn(),
}))

vi.mock("@/lib/services/payroll-scope", () => ({
  getPayrollScope: vi.fn(),
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { payBatchViaStripe } from "@/lib/services/stripe-payout"
import { createPayoutBatch } from "@/lib/services/payout"
import { getPayrollScope } from "@/lib/services/payroll-scope"
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

  it("calls findMany with correct includes and ordering", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([] as never)

    await GET()

    expect(db.payoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}, // admin sees all batches
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({
          approvedBy: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, name: true } },
        }),
      })
    )
  })

  it("scopes findMany to the manager's own runs for a FIELD_MANAGER", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "mgr-1", name: "Manager", role: "FIELD_MANAGER" },
    } as never)
    vi.mocked(db.payoutBatch.findMany).mockResolvedValue([] as never)

    await GET()

    expect(db.payoutBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { initiatedById: "mgr-1" } })
    )
  })

  it("returns 403 for REP role", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)

    const response = await GET()

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
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

  it("delegates a global (unscoped) batch to createPayoutBatch for ADMIN", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique)
      .mockResolvedValueOnce(null) // duplicate check
      .mockResolvedValueOnce({ ...mockBatch }) // re-fetch
    vi.mocked(createPayoutBatch).mockResolvedValue({ id: "batch-1" } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(201)
    expect(createPayoutBatch).toHaveBeenCalledWith("2024-01", {})
    expect(getPayrollScope).not.toHaveBeenCalled()
  })

  it("delegates a scoped DRAFT batch for a FIELD_MANAGER (initiatedById + scope)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "mgr-1", name: "Manager", role: "FIELD_MANAGER" },
    } as never)
    vi.mocked(getPayrollScope).mockResolvedValue({ repIds: ["rep-1", "rep-2"] } as never)
    vi.mocked(db.payoutBatch.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...mockBatch })
    vi.mocked(createPayoutBatch).mockResolvedValue({ id: "batch-1" } as never)

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(201)
    expect(getPayrollScope).toHaveBeenCalled()
    const [period, opts] = vi.mocked(createPayoutBatch).mock.calls[0]
    expect(period).toContain("mgr-1")
    expect(opts).toEqual({ initiatedById: "mgr-1", scopeRepIds: ["rep-1", "rep-2"] })
  })

  it("returns 409 if a batch already exists for the period", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValueOnce({ ...mockBatch })

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(409)
    expect(createPayoutBatch).not.toHaveBeenCalled()
  })

  it("returns 400 when there are no eligible payouts", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValueOnce(null)
    vi.mocked(createPayoutBatch).mockRejectedValue(
      new Error("No eligible payouts for this run")
    )

    const request = new Request("http://localhost/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: "2024-01" }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/No eligible payouts/i)
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

  it("returns 403 for REP role", async () => {
    vi.mocked(auth).mockResolvedValue(mockRepSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue(mockBatch as never)

    const request = new Request("http://localhost/api/payouts/batch-1")
    const params = Promise.resolve({ id: "batch-1" })
    const response = await GET_BY_ID(request as never, { params })

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
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

  it("transitions APPROVED → PAID, pays via Stripe, and marks paid reps' commissions as PAID", async () => {
    vi.mocked(auth).mockResolvedValue(mockAdminSession as never)
    vi.mocked(db.payoutBatch.findUnique).mockResolvedValue({
      ...mockBatch,
      status: "APPROVED",
    } as never)
    // Stripe successfully transfers to both reps in the batch.
    vi.mocked(payBatchViaStripe).mockResolvedValue({
      batchId: "batch-1",
      transferred: [{ repId: "rep-1" }, { repId: "rep-2" }],
      skipped: [],
    } as never)
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

    // Real money moved via the Stripe service.
    expect(payBatchViaStripe).toHaveBeenCalledWith("batch-1")

    // Only reps who were actually paid get their commissions flipped to PAID.
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
