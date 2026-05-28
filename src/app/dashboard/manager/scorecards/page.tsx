export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { ScorecardsClient } from "./scorecards-client";

export default async function ManagerScorecardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FIELD_MANAGER") redirect("/dashboard");

  const reps = await db.user.findMany({
    where: { role: "FIELD_REP" },
    select: {
      id: true,
      name: true,
      email: true,
      blitzAssignments: {
        where: { status: { in: ["ASSIGNED", "CONFIRMED", "ACTIVE"] } },
        select: { blitz: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rep Scorecards</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hours worked, sales, and sales-per-hour for any rep — same data the rep
          sees on their home screen.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ScorecardsClient
            reps={reps.map((r) => ({
              id: r.id,
              name: r.name,
              email: r.email,
              activeBlitzName: r.blitzAssignments[0]?.blitz?.name ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
