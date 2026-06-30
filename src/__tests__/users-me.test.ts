// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth-mobile", () => ({
  getSessionFromRequest: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { GET, PATCH } from "@/app/api/users/me/route"

const mockSession = vi.mocked(getSessionFromRequest)
const mockFindUnique = vi.mocked(db.user.findUnique)
const mockUpdate = vi.mocked(db.user.update)

function makeSession(id = "rep-1", role = "FIELD_REP") {
  return { user: { id, role, name: "Rep One", email: "rep@example.com" } }
}

beforeEach(() => vi.clearAllMocks())

describe("GET /api/users/me", () => {
  it("401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/users/me") as any)
    expect(res.status).toBe(401)
  })

  it("returns the authenticated user", async () => {
    mockSession.mockResolvedValue(makeSession() as any)
    mockFindUnique.mockResolvedValue({ id: "rep-1", email: "rep@example.com", phone: null } as any)
    const res = await GET(new Request("http://localhost/api/users/me") as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("rep-1")
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rep-1" } })
    )
  })
})

describe("PATCH /api/users/me", () => {
  function patch(body) {
    return PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as any
    )
  }

  it("401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await patch({ phone: "5551234567" })
    expect(res.status).toBe(401)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("updates the phone and returns the user object (the shape mobile expects)", async () => {
    mockSession.mockResolvedValue(makeSession() as any)
    mockUpdate.mockResolvedValue({ id: "rep-1", email: "rep@example.com", phone: "5551234567" } as any)
    const res = await patch({ phone: "5551234567" })
    expect(res.status).toBe(200)
    const body = await res.json()
    // returned directly, not wrapped in { user }
    expect(body.phone).toBe("5551234567")
    expect(body.user).toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rep-1" },
        data: expect.objectContaining({ phone: "5551234567" }),
      })
    )
  })

  it("updates only the fields provided", async () => {
    mockSession.mockResolvedValue(makeSession() as any)
    mockUpdate.mockResolvedValue({ id: "rep-1", name: "New Name" } as any)
    await patch({ name: "New Name" })
    const dataArg = mockUpdate.mock.calls[0][0].data
    expect(dataArg).toEqual({ name: "New Name" })
  })

  it("400 on an invalid email", async () => {
    mockSession.mockResolvedValue(makeSession() as any)
    const res = await patch({ email: "not-an-email" })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
