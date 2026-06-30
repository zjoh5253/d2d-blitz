// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth-mobile", () => ({ getSessionFromRequest: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: { gpsSession: { findMany: vi.fn(), create: vi.fn() } },
}))
vi.mock("@/lib/sentry", () => ({ captureApiError: vi.fn() }))

import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { GET, POST } from "@/app/api/gps-sessions/route"

const mockSession = vi.mocked(getSessionFromRequest)
const mockFindMany = vi.mocked(db.gpsSession.findMany)
const mockCreate = vi.mocked(db.gpsSession.create)

beforeEach(() => vi.clearAllMocks())

const validBody = {
  startedAt: "2026-06-30T14:00:00.000Z",
  endedAt: "2026-06-30T16:30:00.000Z",
  durationSeconds: 9000,
  pausedSeconds: 300,
  knockCount: 42,
  routeMiles: 3.5,
}

function postReq(body) {
  return new Request("http://localhost/api/gps-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any
}

describe("GET /api/gps-sessions", () => {
  it("401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost/api/gps-sessions") as any)
    expect(res.status).toBe(401)
  })

  it("returns only the rep's own sessions", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockFindMany.mockResolvedValue([{ id: "g1", repId: "rep-1" }] as any)
    const res = await GET(new Request("http://localhost/api/gps-sessions") as any)
    expect(res.status).toBe(200)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ repId: "rep-1" }) })
    )
  })

  it("applies a date filter when provided", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockFindMany.mockResolvedValue([] as any)
    await GET(new Request("http://localhost/api/gps-sessions?date=2026-06-30") as any)
    const where = mockFindMany.mock.calls[0][0].where
    expect(where.startedAt).toBeDefined()
    expect(where.startedAt.gte).toBeInstanceOf(Date)
  })
})

describe("POST /api/gps-sessions", () => {
  it("401 without a session", async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates a session scoped to the authenticated rep (201)", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockCreate.mockResolvedValue({ id: "g1", repId: "rep-1", ...validBody } as any)
    const res = await POST(postReq(validBody))
    expect(res.status).toBe(201)
    const data = mockCreate.mock.calls[0][0].data
    expect(data.repId).toBe("rep-1")
    expect(data.knockCount).toBe(42)
  })

  it("defaults optional counters to 0", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    mockCreate.mockResolvedValue({ id: "g1" } as any)
    await POST(postReq({ startedAt: validBody.startedAt, endedAt: validBody.endedAt, durationSeconds: 100 }))
    const data = mockCreate.mock.calls[0][0].data
    expect(data.pausedSeconds).toBe(0)
    expect(data.knockCount).toBe(0)
    expect(data.routeMiles).toBe(0)
  })

  it("400 on invalid body", async () => {
    mockSession.mockResolvedValue({ user: { id: "rep-1", role: "FIELD_REP" } } as any)
    const res = await POST(postReq({ startedAt: "not-a-date", endedAt: "x", durationSeconds: -1 }))
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
