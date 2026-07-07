import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, loginLimiter } from "@/lib/rate-limit";
import { z } from "zod";
import { captureApiError } from "@/lib/sentry";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mobile-login:${ip}`, loginLimiter);

  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later.", retryAfter: rl.retryAfterSeconds },
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
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (user.role !== "FIELD_REP") {
      return NextResponse.json(
        { error: "Mobile access is restricted to Field Reps" },
        { status: 403 }
      );
    }

    const token = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      secret: process.env.AUTH_SECRET!,
      salt: "authjs.session-token",
    });

    return NextResponse.json(
      {
        accessToken: token,
        refreshToken: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      {
        headers: {
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
        },
      }
    );
  } catch (error) {
    console.error("Mobile login error:", error);
    captureApiError(error, "Mobile login error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
