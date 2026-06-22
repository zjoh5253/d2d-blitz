export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SalesActivityClient } from "./sales-activity-client";

const ALLOWED_ROLES = ["ADMIN", "EXECUTIVE", "FIELD_MANAGER", "MARKET_OWNER"];

export default async function SalesActivityReportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.role || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/dashboard");
  }

  const [blitzes, reps] = await Promise.all([
    db.blitz.findMany({
      select: { id: true, name: true, market: { select: { name: true } } },
      orderBy: { startDate: "desc" },
    }),
    db.user.findMany({
      where: { role: "FIELD_REP" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <SalesActivityClient
      blitzes={blitzes.map((b) => ({
        id: b.id,
        name: b.name,
        market: b.market?.name ?? "",
      }))}
      reps={reps.map((r) => ({ id: r.id, name: r.name ?? r.id }))}
    />
  );
}
