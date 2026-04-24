import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Module mocks ---

vi.mock("@/lib/auth-mobile", () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// --- Import after mocks ---

import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

// Helpers

function makeGetRequest(authHeader?: string) {
  return new NextRequest("http://localhost/api/user", {
    method: "GET",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

function makePatchRequest(body: Record<string, unknown>, authHeader?: string) {
  return new NextRequest("http://localhost/api/user", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
}

const mockSession = { user: { id: "user-123", email: "rep@example.com", name: "Rep User", role: "FIELD_REP" } };

const mockUserRow = {
  id: "user-123",
  email: "rep@example.com",
  name: "Rep User",
  role: "FIELD_REP",
  status: "ACTIVE",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  blitzAssignments: [],
};

const mockBlitzAssignment = {
  id: "assign-1",
  status: "ACTIVE",
  blitz: {
    id: "blitz-1",
    name: "Summer Blitz",
    status: "ACTIVE",
    startDate: new Date("2024-06-01"),
    endDate: new Date("2024-06-30"),
  },
};

// =============================================================================
// GET /api/user
// =============================================================================

describe("GET /api/user", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/user/route");
    GET = mod.GET;
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const req = makeGetRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 404 when user is not found in DB", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(null);

    const req = makeGetRequest("Bearer token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns user profile with permissions and no activeBlitz when unassigned", async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUserRow as any);

    const req = makeGetRequest("Bearer token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.id).toBe("user-123");
    expect(body.user.email).toBe("rep@example.com");
    expect(body.user.role).toBe("FIELD_REP");
    expect(body.user.status).toBe("ACTIVE");
    expect(body.user.activeBlitz).toBeNull();
    expect(body.user.permissions).toContain("read:own_profile");
    expect(body.user.permissions).toContain("read:own_sales");
    expect(body.user.permissions).toContain("read:leaderboard");
    // should not include passwordHash
    expect(body.user.passwordHash).toBeUndefined();
  });

  it("returns activeBlitz when rep has an active assignment", async () => {
    const userWithBlitz = { ...mockUserRow, blitzAssignments: [mockBlitzAssignment] };
    vi.mocked(getSessionFromRequest).mockResolvedValue(mockSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(userWithBlitz as any);

    const req = makeGetRequest("Bearer token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.activeBlitz).not.toBeNull();
    expect(body.user.activeBlitz.id).toBe("blitz-1");
    expect(body.user.activeBlitz.name).toBe("Summer Blitz");
    expect(body.user.activeBlitz.assignmentStatus).toBe("ACTIVE");
  });

  it("includes ADMIN permissions for ADMIN role", async () => {
    const adminSession = { user: { ...mockSession.user, role: "ADMIN" } };
    const adminUser = { ...mockUserRow, role: "ADMIN", blitzAssignments: [] };
    vi.mocked(getSessionFromRequest).mockResolvedValue(adminSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(adminUser as any);

    const req = makeGetRequest("Bearer admin-token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.permissions).toContain("read:all");
    expect(body.user.permissions).toContain("write:all");
    expect(body.user.permissions).toContain("manage:governance");
    expect(body.user.permissions).toContain("read:own_profile");
  });

  it("includes FIELD_MANAGER permissions for FIELD_MANAGER role", async () => {
    const fmSession = { user: { ...mockSession.user, role: "FIELD_MANAGER" } };
    const fmUser = { ...mockUserRow, role: "FIELD_MANAGER", blitzAssignments: [] };
    vi.mocked(getSessionFromRequest).mockResolvedValue(fmSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(fmUser as any);

    const req = makeGetRequest("Bearer fm-token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.permissions).toContain("read:blitzes");
    expect(body.user.permissions).toContain("write:blitzes");
    expect(body.user.permissions).toContain("read:reps");
    expect(body.user.permissions).toContain("read:compliance");
  });

  it("returns base permissions for unknown role", async () => {
    const unknownSession = { user: { ...mockSession.user, role: "UNKNOWN_ROLE" } };
    const unknownUser = { ...mockUserRow, role: "UNKNOWN_ROLE", blitzAssignments: [] };
    vi.mocked(getSessionFromRequest).mockResolvedValue(unknownSession);
    vi.mocked(db.user.findUnique).mockResolvedValue(unknownUser as any);

    const req = makeGetRequest("Bearer token");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.permissions).toEqual(["read:own_profile", "update:own_profile"]);
  });
});

// =============================================================================
// Reset-password rate limit (smoke test)
// =============================================================================

describe("POST /api/auth/reset-password — rate limiting", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Use real rate-limit module for this test (integration-style)
    vi.unmock("@/lib/rate-limit");
    const mod = await import("@/app/api/auth/reset-password/route");
    POST = mod.POST;
  });

  it("returns 429 with Retry-After header after 5 reset attempts from same IP", async () => {
    // Issue 5 requests to exhaust the per-IP limit (5 per hour)
    const makeReq = () =>
      new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "tok", password: "newpassword1" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "192.0.2.50",
        },
      });

    // The first 5 requests may fail for business reasons (bad token) but should
    // not be rate limited yet. We only care that the 6th gets 429.
    for (let i = 0; i < 5; i++) {
      await POST(makeReq());
    }

    const sixthRes = await POST(makeReq());
    expect(sixthRes.status).toBe(429);
    const retryAfter = sixthRes.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
