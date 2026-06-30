// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — declared before route imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    agreement: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agreementAcceptance: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/blob-storage", () => ({
  uploadRepDocument: vi.fn(),
  deleteRepDocument: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteRepDocument } from "@/lib/blob-storage"
import { GET as agreementsGET, POST as agreementsPOST } from "@/app/api/agreements/route"
import { PUT as agreementPUT, DELETE as agreementDELETE } from "@/app/api/agreements/[id]/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAuth = vi.mocked(auth)
const mockAgreementFindMany = vi.mocked(db.agreement.findMany)
const mockAgreementCreate = vi.mocked(db.agreement.create)
const mockAgreementUpdate = vi.mocked(db.agreement.update)
const mockAgreementDelete = vi.mocked(db.agreement.delete)
const mockAcceptanceFindMany = vi.mocked(db.agreementAcceptance.findMany)
const mockDeleteRepDocument = vi.mocked(deleteRepDocument)

function makeSession(role: string, id = "admin-1") {
  return { user: { id, role, name: "Test User", email: "test@example.com" } }
}

function makeRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new Request(url, init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const VALID_AGREEMENT_BODY = {
  type: "REP_AGREEMENT",
  title: "Sales Rep Agreement",
  body: "You agree to these terms.",
  version: 1,
  required: true,
  blocking: true,
  requiresUpload: false,
  isActive: true,
}

const agreementFixture = {
  id: "agr-1",
  ...VALID_AGREEMENT_BODY,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ===========================================================================
// GET /api/agreements
// ===========================================================================

describe("GET /api/agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await agreementsGET(
      makeRequest("http://localhost/api/agreements", "GET") as any
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 for non-admin role", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const res = await agreementsGET(
      makeRequest("http://localhost/api/agreements", "GET") as any
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 200 with agreements list for ADMIN", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockAgreementFindMany.mockResolvedValue([agreementFixture] as any)
    const res = await agreementsGET(
      makeRequest("http://localhost/api/agreements", "GET") as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe("agr-1")
  })
})

// ===========================================================================
// POST /api/agreements
// ===========================================================================

describe("POST /api/agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await agreementsPOST(
      makeRequest("http://localhost/api/agreements", "POST", VALID_AGREEMENT_BODY) as any
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin role", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const res = await agreementsPOST(
      makeRequest("http://localhost/api/agreements", "POST", VALID_AGREEMENT_BODY) as any
    )
    expect(res.status).toBe(403)
  })

  it("returns 400 for invalid body (missing required type field)", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    const res = await agreementsPOST(
      makeRequest("http://localhost/api/agreements", "POST", {
        title: "No type agreement",
        body: "body text",
      }) as any
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid body (empty title)", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    const res = await agreementsPOST(
      makeRequest("http://localhost/api/agreements", "POST", {
        ...VALID_AGREEMENT_BODY,
        title: "",
      }) as any
    )
    expect(res.status).toBe(400)
  })

  it("returns 201 with created agreement for ADMIN", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockAgreementCreate.mockResolvedValue(agreementFixture as any)
    const res = await agreementsPOST(
      makeRequest("http://localhost/api/agreements", "POST", VALID_AGREEMENT_BODY) as any
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("agr-1")
    expect(mockAgreementCreate).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// PUT /api/agreements/[id]
// ===========================================================================

describe("PUT /api/agreements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await agreementPUT(
      makeRequest("http://localhost/api/agreements/agr-1", "PUT", { title: "Updated" }) as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin role", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const res = await agreementPUT(
      makeRequest("http://localhost/api/agreements/agr-1", "PUT", { title: "Updated" }) as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Forbidden")
  })

  it("returns 200 with updated agreement for ADMIN", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    const updated = { ...agreementFixture, title: "Updated Title" }
    mockAgreementUpdate.mockResolvedValue(updated as any)
    const res = await agreementPUT(
      makeRequest("http://localhost/api/agreements/agr-1", "PUT", {
        title: "Updated Title",
      }) as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe("Updated Title")
    expect(mockAgreementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "agr-1" } })
    )
  })

  it("returns 200 when toggling isActive for ADMIN (partial update)", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    const updated = { ...agreementFixture, isActive: false }
    mockAgreementUpdate.mockResolvedValue(updated as any)
    const res = await agreementPUT(
      makeRequest("http://localhost/api/agreements/agr-1", "PUT", {
        isActive: false,
      }) as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(200)
  })
})

// ===========================================================================
// DELETE /api/agreements/[id]
// ===========================================================================

describe("DELETE /api/agreements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await agreementDELETE(
      makeRequest("http://localhost/api/agreements/agr-1", "DELETE") as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-admin role", async () => {
    mockAuth.mockResolvedValue(makeSession("FIELD_REP") as any)
    const res = await agreementDELETE(
      makeRequest("http://localhost/api/agreements/agr-1", "DELETE") as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(403)
  })

  it("queries acceptances with documentUrl and calls deleteRepDocument for each before deleting", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockAcceptanceFindMany.mockResolvedValue([
      { documentUrl: "https://blob.example.com/rep-1/doc.pdf" },
    ] as any)
    mockAgreementDelete.mockResolvedValue(agreementFixture as any)

    const res = await agreementDELETE(
      makeRequest("http://localhost/api/agreements/agr-1", "DELETE") as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockAcceptanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ agreementId: "agr-1" }),
      })
    )
    expect(mockDeleteRepDocument).toHaveBeenCalledWith(
      "https://blob.example.com/rep-1/doc.pdf"
    )
    expect(mockAgreementDelete).toHaveBeenCalledWith({ where: { id: "agr-1" } })
  })

  it("succeeds and does not call deleteRepDocument when no acceptances have documents", async () => {
    mockAuth.mockResolvedValue(makeSession("ADMIN") as any)
    mockAcceptanceFindMany.mockResolvedValue([] as any)
    mockAgreementDelete.mockResolvedValue(agreementFixture as any)

    const res = await agreementDELETE(
      makeRequest("http://localhost/api/agreements/agr-1", "DELETE") as any,
      makeParams("agr-1")
    )
    expect(res.status).toBe(200)
    expect(mockDeleteRepDocument).not.toHaveBeenCalled()
    expect(mockAgreementDelete).toHaveBeenCalledWith({ where: { id: "agr-1" } })
  })
})
