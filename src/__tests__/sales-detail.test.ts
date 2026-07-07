// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth-mobile", () => ({
  getSessionFromRequest: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { sale: { findUnique: vi.fn() } },
}))

vi.mock("@/lib/sentry", () => ({ captureApiError: vi.fn() }))

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { GET } from "@/app/api/sales/[id]/route"

const mockSession = vi.mocked(getSessionFromRequest)
const mockFindUnique = vi.mocked(db.sale.findUnique)

const params = Promise.resolve({ id: "sale-1" })
const req = () => new Request("http://localhost/api/sales/sale-1") as any

beforeEach(() => vi.clearAllMocks())

describe("GET /api/sales/[id] (mobile auth)", () => {
  it("401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET(req(), { params })
    expect(res.status).toBe(401)
  })

  it("returns the sale for its owning rep (mobile bearer session)", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockFindUnique.mockResolvedValue({ id: "sale-1", repId: "rep-1", customerName: "Sarah" } as any)
    const res = await GET(req(), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.customerName).toBe("Sarah")
  })

  it("403 when a rep requests another rep's sale", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-2", role: "FIELD_REP" } } as any)
    mockFindUnique.mockResolvedValue({ id: "sale-1", repId: "rep-1" } as any)
    const res = await GET(req(), { params })
    expect(res.status).toBe(403)
  })

  it("404 when the sale does not exist", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(req(), { params })
    expect(res.status).toBe(404)
  })
})
