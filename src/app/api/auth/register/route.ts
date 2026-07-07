import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, registerLimiter } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";
import { captureApiError } from "@/lib/sentry";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`register:${ip}`, registerLimiter);

  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later.", retryAfter: rl.retryAfterSeconds },
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
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, password } = parsed.data;

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token (24h TTL)
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create user with default FIELD_REP role
    await db.user.create({
      data: {
        name,
        email,
        phone: phone ?? null,
        passwordHash,
        role: "FIELD_REP",
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Fire-and-forget — don't fail registration if email delivery fails
    sendVerificationEmail(email, emailVerificationToken).catch((err) => {
      console.error("[register] failed to send verification email:", err);
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[register] error:", error);
    captureApiError(error, "[register] error");
    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
