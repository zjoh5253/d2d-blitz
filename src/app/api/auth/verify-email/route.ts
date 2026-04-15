import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

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
