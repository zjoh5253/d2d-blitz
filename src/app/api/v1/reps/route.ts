import { NextRequest, NextResponse } from "next/server";
import { withApiKey, pageParams } from "@/lib/api-key";
import { db } from "@/lib/db";

// GET /api/v1/reps — our field users (id/name/email/role/status) for cross-
// system rep reconciliation. Params: ?limit=1..500 (default 100) · ?role.
// Scope: reps:read. Minimal PII by design.
export async function GET(req: NextRequest) {
  return withApiKey(req, "reps:read", async () => {
    const url = new URL(req.url);
    const { limit } = pageParams(url);
    const role = url.searchParams.get("role") ?? undefined;

    const rows = await db.user.findMany({
      where: role ? { role: role as never } : {},
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });

    const reps = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
    }));

    return NextResponse.json({ count: reps.length, reps });
  });
}
