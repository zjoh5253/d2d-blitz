export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPayrollScope } from "@/lib/services/payroll-scope";
import { Card, CardContent } from "@/components/ui/card";
import { RepPayClient } from "./rep-pay-client";

const ALLOWED_ROLES = ["FIELD_MANAGER", "ADMIN"];

export default async function RepPayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) redirect("/dashboard");

  const isAdmin = session.user.role === "ADMIN";
  const { repIds } = await getPayrollScope(session.user);

  const reps = isAdmin
    ? await db.user.findMany({
        where: { role: "FIELD_REP", status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : await db.user.findMany({
        where: { id: { in: repIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  const [overrides, carriers] = await Promise.all([
    isAdmin
      ? db.repCommissionOverride.findMany({
          include: {
            rep: { select: { id: true, name: true } },
            carrier: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: [{ repId: "asc" }, { effectiveDate: "desc" }],
        })
      : db.repCommissionOverride.findMany({
          where: { repId: { in: repIds } },
          include: {
            rep: { select: { id: true, name: true } },
            carrier: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: [{ repId: "asc" }, { effectiveDate: "desc" }],
        }),
    db.carrier.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <RepPayClient
            overrides={overrides}
            reps={reps}
            carriers={carriers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
