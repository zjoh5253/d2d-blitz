import { NextRequest, NextResponse } from "next/server";
import { encode, decode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, refreshLimiter } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`refresh:${ip}`, refreshLimiter);

  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many token refresh attempts. Please try again later.", retryAfter: rl.retryAfterSeconds },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfterSeconds),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  }

  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = await decode({
        token: refreshToken,
        secret: process.env.AUTH_SECRET!,
        salt: "authjs.session-token",
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    if (!decoded || !decoded.id) {
      return NextResponse.json(
        { error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: decoded.id as string },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "User not found or inactive" },
        { status: 401 }
      );
    }

    const newToken = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
    });

    return NextResponse.json({
      accessToken: newToken,
      refreshToken: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
