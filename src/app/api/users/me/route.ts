import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-mobile";
import { db } from "@/lib/db";
import { z } from "zod";

const ME_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  governanceTierId: true,
  createdAt: true,
  updatedAt: true,
  governanceTier: {
    select: { id: true, name: true },
  },
} as const;

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        governanceTierId: true,
        createdAt: true,
        updatedAt: true,
        governanceTier: {
          select: { id: true, name: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET /api/users/me]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Update the authenticated user's own profile (name / email / phone).
// Mobile clients PATCH this path; returns the updated user object directly
// (same shape as GET) so the client can persist it.
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateMeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone } = parsed.data;

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
      },
      select: ME_SELECT,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("[PATCH /api/users/me]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
