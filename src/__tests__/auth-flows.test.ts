import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Module mocks (must be top-level) ---

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock("next-auth/jwt", () => ({
  encode: vi.fn(),
  decode: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => "127.0.0.1"),
  loginLimiter: { limit: 5, windowMs: 900000 },
  refreshLimiter: { limit: 20, windowMs: 900000 },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  captureServerEvent: vi.fn(),
}));

// --- Import after mocks ---

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { encode, decode } from "next-auth/jwt";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

// Helpers

function makeLoginRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeRefreshRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const mockRateLimitOk = {
  success: true,
  limit: 5,
  remaining: 4,
  resetAt: Date.now() + 900000,
  retryAfterSeconds: 0,
};

const mockRateLimitExceeded = {
  success: false,
  limit: 5,
  remaining: 0,
  resetAt: Date.now() + 900000,
  retryAfterSeconds: 60,
};

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  passwordHash: "$2a$10$hashedpassword",
  status: "ACTIVE",
};

// =============================================================================
// Login route tests
// =============================================================================

describe("POST /api/auth/login", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Re-import after reset so mocks are fresh
    const mod = await import("@/app/api/auth/login/route");
    POST = mod.POST;
    vi.mocked(checkRateLimit).mockReturnValue(mockRateLimitOk);
  });

  it("returns 200 with accessToken and user on successful login", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(encode).mockResolvedValue("mock-access-token");

    const req = makeLoginRequest({ email: "test@example.com", password: "password123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.accessToken).toBe("mock-access-token");
    expect(body.user).toMatchObject({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "USER",
    });
  });

  it("returns 400 when email is missing", async () => {
    const req = makeLoginRequest({ password: "password123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  it("returns 400 when password is missing", async () => {
    const req = makeLoginRequest({ email: "test@example.com" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/required/i);
  });

  it("returns 401 when user is not found", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeLoginRequest({ email: "nobody@example.com", password: "password123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/invalid credentials/i);
  });

  it("returns 401 when user has no passwordHash", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...mockUser, passwordHash: null } as any);

    const req = makeLoginRequest({ email: "test@example.com", password: "password123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/invalid credentials/i);
  });

  it("returns 401 when password is wrong", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const req = makeLoginRequest({ email: "test@example.com", password: "wrongpassword" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/invalid credentials/i);
  });

  it("returns 429 with Retry-After header when rate limited", async () => {
    vi.mocked(checkRateLimit).mockReturnValue(mockRateLimitExceeded);

    const req = makeLoginRequest({ email: "test@example.com", password: "password123" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

// =============================================================================
// Refresh route tests
// =============================================================================

describe("POST /api/auth/refresh", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/auth/refresh/route");
    POST = mod.POST;
    vi.mocked(checkRateLimit).mockReturnValue(mockRateLimitOk);
  });

  it("returns 200 with new accessToken and refreshToken on valid refresh", async () => {
    vi.mocked(decode).mockResolvedValue({ id: "user-123", email: "test@example.com" } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(encode).mockResolvedValue("new-access-token");

    const req = makeRefreshRequest({ refreshToken: "valid-refresh-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.accessToken).toBe("new-access-token");
    expect(body.refreshToken).toBe("new-access-token");
  });

  it("returns 401 when token is invalid (decode throws)", async () => {
    vi.mocked(decode).mockRejectedValue(new Error("invalid token"));

    const req = makeRefreshRequest({ refreshToken: "bad-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/invalid refresh token/i);
  });

  it("returns 401 when decoded token has no id", async () => {
    vi.mocked(decode).mockResolvedValue({ email: "test@example.com" } as any);

    const req = makeRefreshRequest({ refreshToken: "malformed-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/invalid refresh token/i);
  });

  it("returns 401 when user is inactive", async () => {
    vi.mocked(decode).mockResolvedValue({ id: "user-123", email: "test@example.com" } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...mockUser, status: "INACTIVE" } as any);

    const req = makeRefreshRequest({ refreshToken: "valid-refresh-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/not found or inactive/i);
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(decode).mockResolvedValue({ id: "ghost-user", email: "ghost@example.com" } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeRefreshRequest({ refreshToken: "valid-refresh-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/not found or inactive/i);
  });

  it("returns 400 when refreshToken is missing from body", async () => {
    const req = makeRefreshRequest({});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/validation failed/i);
  });

  it("returns 429 with Retry-After header when rate limited", async () => {
    vi.mocked(checkRateLimit).mockReturnValue(mockRateLimitExceeded);

    const req = makeRefreshRequest({ refreshToken: "some-token" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

// =============================================================================
// getSessionFromRequest tests
// =============================================================================

describe("getSessionFromRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns decoded session when a valid Bearer token is present", async () => {
    vi.mocked(decode).mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "USER",
    } as any);

    const { getSessionFromRequest } = await import("@/lib/auth-mobile");

    const req = new NextRequest("http://localhost/api/protected", {
      headers: { Authorization: "Bearer valid-jwt-token" },
    });

    const session = await getSessionFromRequest(req);

    expect(session).toEqual({
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "USER",
      },
    });
  });

  it("returns null when Bearer token is invalid (decode throws)", async () => {
    vi.mocked(decode).mockRejectedValue(new Error("invalid token"));

    const { getSessionFromRequest } = await import("@/lib/auth-mobile");

    const req = new NextRequest("http://localhost/api/protected", {
      headers: { Authorization: "Bearer bad-token" },
    });

    const session = await getSessionFromRequest(req);

    expect(session).toBeNull();
  });

  it("falls back to auth() when no Authorization header is present", async () => {
    const mockNextAuthSession = { user: { id: "next-auth-user", email: "na@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockNextAuthSession as any);

    const { getSessionFromRequest } = await import("@/lib/auth-mobile");

    const req = new NextRequest("http://localhost/api/protected");

    const session = await getSessionFromRequest(req);

    expect(auth).toHaveBeenCalledOnce();
    expect(session).toEqual(mockNextAuthSession);
  });
});
