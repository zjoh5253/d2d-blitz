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
    user: {
      findUnique: vi.fn(),
    },
    agreement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    agreementAcceptance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { uploadRepDocument } from "@/lib/blob-storage"
import { GET as statusGET } from "@/app/api/onboarding/status/route"
import { GET as agreementsListGET } from "@/app/api/onboarding/agreements/route"
import { POST as acceptPOST } from "@/app/api/onboarding/agreements/[id]/accept/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockGetSession = vi.mocked(getSessionFromRequest)
const mockUserFindUnique = vi.mocked(db.user.findUnique)
const mockAgreementFindMany = vi.mocked(db.agreement.findMany)
const mockAgreementFindFirst = vi.mocked(db.agreement.findFirst)
const mockAcceptanceFindMany = vi.mocked(db.agreementAcceptance.findMany)
const mockAcceptanceFindUnique = vi.mocked(db.agreementAcceptance.findUnique)
const mockAcceptanceUpsert = vi.mocked(db.agreementAcceptance.upsert)
const mockUploadRepDocument = vi.mocked(uploadRepDocument)

function makeSession(id = "rep-1") {
  return { user: { id, email: "rep@test.com", name: "Test Rep", role: "FIELD_REP" } }
}

function makeAcceptRequest(agreementId: string, fields: Record<string, string | File> = {}) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v)
  }
  return new Request(
    `http://localhost/api/onboarding/agreements/${agreementId}/accept`,
    { method: "POST", body: fd }
  )
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ===========================================================================
// GET /api/onboarding/status
// ===========================================================================

describe("GET /api/onboarding/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("gateComplete true when phone set and all blocking+required agreements accepted at current version", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: "555-1234" } as any)
    const agreement = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      required: true,
      blocking: true,
      requiresUpload: false,
      version: 2,
    }
    mockAgreementFindMany.mockResolvedValue([agreement] as any)
    mockAcceptanceFindMany.mockResolvedValue([
      { agreementId: "agr-1", version: 2, acceptedAt: new Date("2025-01-01") },
    ] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profileComplete).toBe(true)
    expect(body.blockingComplete).toBe(true)
    expect(body.gateComplete).toBe(true)
    expect(body.allComplete).toBe(true)
  })

  it("profileComplete false when phone is null", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: null } as any)
    mockAgreementFindMany.mockResolvedValue([] as any)
    mockAcceptanceFindMany.mockResolvedValue([] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    const body = await res.json()
    expect(body.profileComplete).toBe(false)
    expect(body.gateComplete).toBe(false)
  })

  it("profileComplete false when phone is whitespace only", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: "   " } as any)
    mockAgreementFindMany.mockResolvedValue([] as any)
    mockAcceptanceFindMany.mockResolvedValue([] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    const body = await res.json()
    expect(body.profileComplete).toBe(false)
    expect(body.gateComplete).toBe(false)
  })

  it("blockingComplete false and gateComplete false when a blocking+required agreement is not accepted", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: "555-1234" } as any)
    const agreement = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      required: true,
      blocking: true,
      requiresUpload: false,
      version: 1,
    }
    mockAgreementFindMany.mockResolvedValue([agreement] as any)
    mockAcceptanceFindMany.mockResolvedValue([] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    const body = await res.json()
    expect(body.blockingComplete).toBe(false)
    expect(body.gateComplete).toBe(false)
  })

  it("gateComplete true but allComplete false when non-blocking required agreement is not accepted", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: "555-1234" } as any)
    const blockingAgr = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      required: true,
      blocking: true,
      requiresUpload: false,
      version: 1,
    }
    const nonBlockingAgr = {
      id: "agr-2",
      type: "TAX_W9",
      title: "W-9 Form",
      required: true,
      blocking: false,
      requiresUpload: true,
      version: 1,
    }
    mockAgreementFindMany.mockResolvedValue([blockingAgr, nonBlockingAgr] as any)
    // Only the blocking agreement is accepted
    mockAcceptanceFindMany.mockResolvedValue([
      { agreementId: "agr-1", version: 1, acceptedAt: new Date("2025-01-01") },
    ] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    const body = await res.json()
    expect(body.gateComplete).toBe(true)
    expect(body.blockingComplete).toBe(true)
    expect(body.allComplete).toBe(false)
  })

  it("acceptance for an older version is treated as not accepted", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockUserFindUnique.mockResolvedValue({ phone: "555-1234" } as any)
    const agreement = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      required: true,
      blocking: true,
      requiresUpload: false,
      version: 2, // current version is 2
    }
    mockAgreementFindMany.mockResolvedValue([agreement] as any)
    // Acceptance is for version 1 — stale
    mockAcceptanceFindMany.mockResolvedValue([
      { agreementId: "agr-1", version: 1, acceptedAt: new Date("2024-01-01") },
    ] as any)

    const req = new Request("http://localhost/api/onboarding/status")
    const res = await statusGET(req as any)
    const body = await res.json()
    expect(body.blockingComplete).toBe(false)
    expect(body.gateComplete).toBe(false)
    const agrState = body.agreements.find((a) => a.id === "agr-1")
    expect(agrState.accepted).toBe(false)
    expect(agrState.acceptedAt).toBeNull()
  })
})

// ===========================================================================
// GET /api/onboarding/agreements
// ===========================================================================

describe("GET /api/onboarding/agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const req = new Request("http://localhost/api/onboarding/agreements")
    const res = await agreementsListGET(req as any)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 200 with accepted=true when acceptance version matches agreement version", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    const agreement = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      body: "Sign here",
      version: 1,
      required: true,
      blocking: true,
      requiresUpload: false,
    }
    mockAgreementFindMany.mockResolvedValue([agreement] as any)
    mockAcceptanceFindMany.mockResolvedValue([
      { agreementId: "agr-1", version: 1, acceptedAt: new Date("2025-01-01") },
    ] as any)

    const req = new Request("http://localhost/api/onboarding/agreements")
    const res = await agreementsListGET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0].id).toBe("agr-1")
    expect(body[0].accepted).toBe(true)
    expect(body[0].acceptedAt).toBeTruthy()
  })

  it("returns accepted=false when acceptance version does not match agreement version", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    const agreement = {
      id: "agr-1",
      type: "REP_AGREEMENT",
      title: "Rep Agreement",
      body: "Sign here",
      version: 2,
      required: true,
      blocking: true,
      requiresUpload: false,
    }
    mockAgreementFindMany.mockResolvedValue([agreement] as any)
    mockAcceptanceFindMany.mockResolvedValue([
      { agreementId: "agr-1", version: 1, acceptedAt: new Date("2025-01-01") },
    ] as any)

    const req = new Request("http://localhost/api/onboarding/agreements")
    const res = await agreementsListGET(req as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].accepted).toBe(false)
    expect(body[0].acceptedAt).toBeNull()
  })
})

// ===========================================================================
// POST /api/onboarding/agreements/[id]/accept
// ===========================================================================

describe("POST /api/onboarding/agreements/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const req = makeAcceptRequest("agr-1", { signatureName: "Jane Rep" })
    const res = await acceptPOST(req as any, makeParams("agr-1"))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 400 when signatureName is absent", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    // FormData with no signatureName field at all
    const req = makeAcceptRequest("agr-1")
    const res = await acceptPOST(req as any, makeParams("agr-1"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/signatureName/i)
  })

  it("returns 400 when signatureName is whitespace only", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    const req = makeAcceptRequest("agr-1", { signatureName: "   " })
    const res = await acceptPOST(req as any, makeParams("agr-1"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when agreement is not found or not active", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockAgreementFindFirst.mockResolvedValue(null)
    const req = makeAcceptRequest("agr-missing", { signatureName: "Jane Rep" })
    const res = await acceptPOST(req as any, makeParams("agr-missing"))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Agreement not found")
  })

  it("returns 400 when agreement requiresUpload=true but no document is provided", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockAgreementFindFirst.mockResolvedValue({
      id: "agr-2",
      type: "TAX_W9",
      version: 1,
      requiresUpload: true,
      isActive: true,
    } as any)
    // No document field in form data
    const req = makeAcceptRequest("agr-2", { signatureName: "Jane Rep" })
    const res = await acceptPOST(req as any, makeParams("agr-2"))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Document/i)
  })

  it("happy path (requiresUpload=false) → upsert called and returns accepted:true", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockAgreementFindFirst.mockResolvedValue({
      id: "agr-1",
      type: "REP_AGREEMENT",
      version: 1,
      requiresUpload: false,
      isActive: true,
    } as any)
    mockAcceptanceFindUnique.mockResolvedValue(null)
    const acceptedAt = new Date("2025-06-01T12:00:00.000Z")
    mockAcceptanceUpsert.mockResolvedValue({
      agreementId: "agr-1",
      userId: "rep-1",
      version: 1,
      signatureName: "Jane Rep",
      documentUrl: null,
      acceptedAt,
    } as any)

    const req = makeAcceptRequest("agr-1", { signatureName: "Jane Rep" })
    const res = await acceptPOST(req as any, makeParams("agr-1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(body.hasDocument).toBe(false)
    expect(body.documentUrl).toBeNull()
    expect(mockAcceptanceUpsert).toHaveBeenCalledOnce()
    expect(mockUploadRepDocument).not.toHaveBeenCalled()
  })

  it("happy path with requiresUpload=true + document File → calls uploadRepDocument and returns hasDocument:true", async () => {
    mockGetSession.mockResolvedValue(makeSession("rep-1"))
    mockAgreementFindFirst.mockResolvedValue({
      id: "agr-2",
      type: "TAX_W9",
      version: 1,
      requiresUpload: true,
      isActive: true,
    } as any)
    mockAcceptanceFindUnique.mockResolvedValue(null)
    mockUploadRepDocument.mockResolvedValue("https://blob.example.com/rep-1/tax-w9.pdf")
    const acceptedAt = new Date("2025-06-01T12:00:00.000Z")
    mockAcceptanceUpsert.mockResolvedValue({
      agreementId: "agr-2",
      userId: "rep-1",
      version: 1,
      signatureName: "Jane Rep",
      documentUrl: "https://blob.example.com/rep-1/tax-w9.pdf",
      acceptedAt,
    } as any)

    const docFile = new File(["pdf content"], "w9.pdf", { type: "application/pdf" })
    const req = makeAcceptRequest("agr-2", { signatureName: "Jane Rep", document: docFile })
    const res = await acceptPOST(req as any, makeParams("agr-2"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(body.hasDocument).toBe(true)
    expect(mockUploadRepDocument).toHaveBeenCalledOnce()
    expect(mockAcceptanceUpsert).toHaveBeenCalledOnce()
  })
})
