import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Comp-tier preset library (spec §5.1). The create form's compensation selector
// reads the active tiers here; admins/FMs can add new ones.

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tiers = await db.compTier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, baseCommission: true, bonusStructure: true, travelNotes: true },
  });
  return NextResponse.json(tiers);
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  baseCommission: z.coerce.number().int().nonnegative().optional(), // cents
  bonusStructure: z.unknown().optional(),
  travelNotes: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "FIELD_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const tier = await db.compTier.create({
    data: {
      name: parsed.data.name,
      baseCommission: parsed.data.baseCommission ?? null,
      bonusStructure: (parsed.data.bonusStructure as object | undefined) ?? undefined,
      travelNotes: parsed.data.travelNotes || null,
    },
  });
  return NextResponse.json(tier, { status: 201 });
}
