import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-mobile';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).refine(d => d.name || d.email, "At least one field required");

// Derive role-based permissions from the user's role.
// Mirrors the RBAC matrix in src/middleware.ts.
function getPermissions(role: string): string[] {
  const base = ["read:own_profile", "update:own_profile"];
  const byRole: Record<string, string[]> = {
    ADMIN: [
      "read:all", "write:all", "manage:governance", "manage:compliance",
      "manage:compensation", "manage:installs", "manage:reports",
    ],
    EXECUTIVE: ["read:reports", "read:compliance_holds"],
    RECRUITER: ["read:recruiting", "write:recruiting"],
    MARKET_OWNER: ["read:markets", "write:markets", "read:blitzes", "write:blitzes"],
    FIELD_MANAGER: [
      "read:blitzes", "write:blitzes", "read:reps", "write:reps",
      "read:governance", "write:governance", "read:compliance",
    ],
    FIELD_REP: ["read:own_sales", "write:own_sales", "read:leaderboard"],
    CALL_CENTER: ["read:inbound", "write:inbound"],
  };
  return [...base, ...(byRole[role] ?? [])];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // Active blitz assignment (not departed/removed)
        blitzAssignments: {
          where: {
            status: { notIn: ["DEPARTED", "REMOVED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            blitz: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { blitzAssignments, ...userFields } = user;
    const activeBlitz = blitzAssignments[0]
      ? { ...blitzAssignments[0].blitz, assignmentStatus: blitzAssignments[0].status }
      : null;

    return NextResponse.json({
      user: {
        ...userFields,
        activeBlitz,
        permissions: getPermissions(user.role),
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email } = parsed.data;

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
