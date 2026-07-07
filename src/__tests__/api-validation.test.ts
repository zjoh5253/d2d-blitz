import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  parseBody,
  parseQuery,
  CommissionStatusSchema,
  InstallRecordStatusSchema,
  DoorKnockDispositionSchema,
  LeaderboardPeriodSchema,
  optionalId,
} from "@/lib/validate"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function makeMalformedRequest(): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ not valid json {{",
  })
}

function makeSearchParams(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params)
}

// ─── parseBody ────────────────────────────────────────────────────────────────

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(1) })

  it("returns 400 on malformed JSON", async () => {
    const req = makeMalformedRequest()
    const result = await parseBody(req, schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const json = await result.response.json()
      expect(json.error).toBeDefined()
    }
  })

  it("returns 400 on schema mismatch", async () => {
    const req = makePostRequest({ name: "" }) // fails min(1)
    const result = await parseBody(req, schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const json = await result.response.json()
      expect(json.error).toBe("Validation failed")
      expect(json.issues).toBeDefined()
    }
  })

  it("returns data on valid input", async () => {
    const req = makePostRequest({ name: "Alice" })
    const result = await parseBody(req, schema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Alice")
    }
  })
})

// ─── parseQuery ───────────────────────────────────────────────────────────────

describe("parseQuery", () => {
  const schema = z.object({
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })

  it("returns 400 on invalid enum value", () => {
    const params = makeSearchParams({ status: "BOGUS" })
    const result = parseQuery(params, schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("returns data on valid input", () => {
    const params = makeSearchParams({ status: "ACTIVE" })
    const result = parseQuery(params, schema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("ACTIVE")
    }
  })
})

// ─── auth/mobile ──────────────────────────────────────────────────────────────

describe("auth/mobile loginSchema", () => {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({ password: "secret" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" })
    expect(result.success).toBe(false)
  })

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(false)
  })

  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "hunter2" })
    expect(result.success).toBe(true)
  })
})

// ─── auth/refresh ─────────────────────────────────────────────────────────────

describe("auth/refresh refreshSchema", () => {
  const refreshSchema = z.object({
    refreshToken: z.string().min(1),
  })

  it("rejects missing refreshToken", () => {
    const result = refreshSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects empty string", () => {
    const result = refreshSchema.safeParse({ refreshToken: "" })
    expect(result.success).toBe(false)
  })

  it("accepts valid token string", () => {
    const result = refreshSchema.safeParse({ refreshToken: "abc.def.ghi" })
    expect(result.success).toBe(true)
  })
})

// ─── auth/verify-email ────────────────────────────────────────────────────────

describe("auth/verify-email query schema", () => {
  const verifyEmailQuerySchema = z.object({
    token: z.string().min(1),
  })

  it("rejects missing token", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, verifyEmailQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid token", () => {
    const params = makeSearchParams({ token: "abc123xyz" })
    const result = parseQuery(params, verifyEmailQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.token).toBe("abc123xyz")
    }
  })
})

// ─── commissions GET query ────────────────────────────────────────────────────

describe("commissions GET query schema", () => {
  const commissionsQuerySchema = z.object({
    repId: optionalId,
    blitzId: optionalId,
    status: CommissionStatusSchema.optional(),
  })

  it("rejects invalid status enum value", () => {
    const params = makeSearchParams({ status: "INVALID_STATUS" })
    const result = parseQuery(params, commissionsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid status ELIGIBLE", () => {
    const params = makeSearchParams({ status: "ELIGIBLE" })
    const result = parseQuery(params, commissionsQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("ELIGIBLE")
    }
  })

  it("accepts empty params (all optional)", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, commissionsQuerySchema)
    expect(result.success).toBe(true)
  })
})

// ─── compliance-holds GET query ───────────────────────────────────────────────

describe("compliance-holds GET query schema", () => {
  const complianceHoldsQuerySchema = z.object({
    repId: optionalId,
    activeOnly: z.string().optional(),
  })

  it("accepts empty params (all optional)", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, complianceHoldsQuerySchema)
    expect(result.success).toBe(true)
  })

  it("accepts repId and activeOnly params", () => {
    const params = makeSearchParams({ repId: "rep-123", activeOnly: "true" })
    const result = parseQuery(params, complianceHoldsQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.repId).toBe("rep-123")
      expect(result.data.activeOnly).toBe("true")
    }
  })
})

// ─── door-knock-leads GET query ───────────────────────────────────────────────

describe("door-knock-leads GET query schema", () => {
  const doorKnockLeadsQuerySchema = z.object({
    assignedRepId: optionalId,
    disposition: DoorKnockDispositionSchema.optional(),
    blitzId: optionalId,
    uploadBatchId: optionalId,
    unassigned: z.string().optional(),
    assigned: z.string().optional(),
  })

  it("rejects invalid disposition value", () => {
    const params = makeSearchParams({ disposition: "MAYBE" })
    const result = parseQuery(params, doorKnockLeadsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid disposition SOLD", () => {
    const params = makeSearchParams({ disposition: "SOLD" })
    const result = parseQuery(params, doorKnockLeadsQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.disposition).toBe("SOLD")
    }
  })

  it("accepts empty params", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, doorKnockLeadsQuerySchema)
    expect(result.success).toBe(true)
  })
})

// ─── door-knock-leads [id] PUT body ──────────────────────────────────────────

describe("door-knock-leads [id] PUT body schema", () => {
  const updateLeadSchema = z.object({
    disposition: DoorKnockDispositionSchema.optional(),
    notes: z.string().nullable().optional(),
    goBackId: z.string().nullable().optional(),
  })

  it("rejects invalid disposition value", () => {
    const result = updateLeadSchema.safeParse({ disposition: "UNKNOWN_VALUE" })
    expect(result.success).toBe(false)
  })

  it("accepts valid disposition NOT_HOME", () => {
    const result = updateLeadSchema.safeParse({ disposition: "NOT_HOME" })
    expect(result.success).toBe(true)
  })

  it("accepts empty object (all fields optional)", () => {
    const result = updateLeadSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts notes and goBackId without disposition", () => {
    const result = updateLeadSchema.safeParse({ notes: "Follow up Monday", goBackId: null })
    expect(result.success).toBe(true)
  })
})

// ─── install-records GET query ────────────────────────────────────────────────

describe("install-records GET query schema", () => {
  const installRecordsQuerySchema = z.object({
    uploadId: optionalId,
    status: InstallRecordStatusSchema.optional(),
    carrierId: optionalId,
  })

  it("rejects invalid status enum value", () => {
    const params = makeSearchParams({ status: "PENDING" }) // not a valid InstallRecordStatus
    const result = parseQuery(params, installRecordsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid status MATCHED", () => {
    const params = makeSearchParams({ status: "MATCHED" })
    const result = parseQuery(params, installRecordsQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("MATCHED")
    }
  })

  it("accepts empty params (all optional)", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, installRecordsQuerySchema)
    expect(result.success).toBe(true)
  })
})

// ─── leaderboard GET query ────────────────────────────────────────────────────

describe("leaderboard GET query schema", () => {
  const leaderboardQuerySchema = z.object({
    period: LeaderboardPeriodSchema.default("month"),
    marketId: optionalId,
    blitzId: optionalId,
  })

  it("rejects invalid period value", () => {
    const params = makeSearchParams({ period: "quarterly" })
    const result = parseQuery(params, leaderboardQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid period 'week'", () => {
    const params = makeSearchParams({ period: "week" })
    const result = parseQuery(params, leaderboardQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe("week")
    }
  })

  it("defaults period to 'month' when omitted", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, leaderboardQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe("month")
    }
  })
})

// ─── governance/periods GET query ────────────────────────────────────────────

describe("governance/periods GET query schema", () => {
  const governancePeriodsQuerySchema = z.object({
    repId: optionalId,
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2020).max(2100).optional(),
  })

  it("rejects month = 0 (out of range)", () => {
    const params = makeSearchParams({ month: "0" })
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("rejects month = 13 (out of range)", () => {
    const params = makeSearchParams({ month: "13" })
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("rejects year = 2019 (below min)", () => {
    const params = makeSearchParams({ year: "2019" })
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("rejects year = 2101 (above max)", () => {
    const params = makeSearchParams({ year: "2101" })
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
    }
  })

  it("accepts valid month 6 and year 2025", () => {
    const params = makeSearchParams({ month: "6", year: "2025" })
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.month).toBe(6)
      expect(result.data.year).toBe(2025)
    }
  })

  it("accepts empty params (all optional)", () => {
    const params = makeSearchParams({})
    const result = parseQuery(params, governancePeriodsQuerySchema)
    expect(result.success).toBe(true)
  })
})

// ─── user PATCH body ──────────────────────────────────────────────────────────

describe("user PATCH body schema", () => {
  const updateUserSchema = z
    .object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    })
    .refine((d) => d.name || d.email, "At least one field required")

  it("rejects empty object (refine fails)", () => {
    const result = updateUserSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects invalid email format", () => {
    const result = updateUserSchema.safeParse({ email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("accepts valid name only", () => {
    const result = updateUserSchema.safeParse({ name: "Bob" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Bob")
    }
  })

  it("accepts valid email only", () => {
    const result = updateUserSchema.safeParse({ email: "bob@example.com" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe("bob@example.com")
    }
  })

  it("accepts both name and email", () => {
    const result = updateUserSchema.safeParse({ name: "Bob", email: "bob@example.com" })
    expect(result.success).toBe(true)
  })
})
