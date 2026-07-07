import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-key";

// GET /api/v1/ping — validate an API key. Partners hit this to confirm their
// key works and see which scopes it carries.
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ ok: true, partner: auth.key.name, scopes: auth.key.scopes });
}
