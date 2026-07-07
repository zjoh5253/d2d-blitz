import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";

const registerSchema = z.object({
  token: z.string().min(1, "Token is required"),
  platform: z.enum(["ios", "android"]),
});

/**
 * POST /api/user/push-token
 * Register or refresh a device push token for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, platform } = parsed.data;

    // Upsert so re-registrations (e.g. app reinstall) are idempotent.
    await db.devicePushToken.upsert({
      where: { userId_token: { userId: session.user.id, token } },
      update: { platform, updatedAt: new Date() },
      create: { userId: session.user.id, token, platform },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/user/push-token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/push-token
 * Unregister a device push token (e.g. on logout).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = z.object({ token: z.string() }).parse(body);

    await db.devicePushToken.deleteMany({
      where: { userId: session.user.id, token },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/user/push-token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
