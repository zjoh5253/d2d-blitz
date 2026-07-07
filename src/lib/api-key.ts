// Partner API-key auth for the public /api/v1 surface (Coastside integration +
// future partners). Keys are high-entropy and stored only as a sha256 hash —
// the plaintext is shown once at mint (scripts/mint-api-key.ts) and never again.
// A key carries scopes ("installs:read", "field-logs:read", "carriers:read",
// "reps:read"; "*" = all) that gate which resources it can read.

import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const API_SCOPES = ["installs:read", "field-logs:read", "carriers:read", "reps:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Mint a new key: `csk_<random>`. Returns the plaintext (show once) + what to store. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `csk_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

/** Deterministic hash for O(1) lookup. Safe unsalted: keys are 192-bit random. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export type ApiKeyIdentity = { id: string; name: string; scopes: string[] };
type Ok = { ok: true; key: ApiKeyIdentity };
type Fail = { ok: false; status: number; error: string };

/**
 * Authenticate a partner request by `Authorization: Bearer <key>` (or
 * `X-API-Key`). Optionally require a scope. Updates lastUsedAt fire-and-forget.
 */
export async function authenticateApiKey(req: NextRequest, requiredScope?: ApiScope): Promise<Ok | Fail> {
  const header = req.headers.get("authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7).trim() : req.headers.get("x-api-key")?.trim();
  if (!presented) return { ok: false, status: 401, error: "Missing API key" };

  const rec = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(presented) } });
  if (!rec || !rec.active || rec.revokedAt) return { ok: false, status: 401, error: "Invalid or revoked API key" };

  if (requiredScope && !rec.scopes.includes(requiredScope) && !rec.scopes.includes("*")) {
    return { ok: false, status: 403, error: `This key is missing the '${requiredScope}' scope` };
  }

  void db.apiKey.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, key: { id: rec.id, name: rec.name, scopes: rec.scopes } };
}

/** Convenience: run a handler only if the key authenticates for `scope`. */
export async function withApiKey(
  req: NextRequest,
  scope: ApiScope,
  handler: (key: ApiKeyIdentity) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  const auth = await authenticateApiKey(req, scope);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return handler(auth.key);
}

/** Shared pagination for /api/v1 list endpoints. */
export function pageParams(url: URL): { limit: number; since: Date | null } {
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1), 500);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;
  return { limit, since };
}
