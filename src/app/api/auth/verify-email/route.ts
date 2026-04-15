import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseQuery } from "@/lib/validate";

const verifyEmailQuerySchema = z.object({
  token: z.string().min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(searchParams, verifyEmailQuerySchema);

  if (!parsed.success) {
    return parsed.response;
  }

  const { token } = parsed.data;

  const user = await db.user.findFirst({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-verification-token", request.url)
    );
  }

  if (user.emailVerified) {
    return NextResponse.redirect(new URL("/login?verified=already", request.url));
  }

  if (
    user.emailVerificationExpires &&
    user.emailVerificationExpires < new Date()
  ) {
    return NextResponse.redirect(
      new URL("/login?error=verification-token-expired", request.url)
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return NextResponse.redirect(new URL("/login?verified=true", request.url));
}
