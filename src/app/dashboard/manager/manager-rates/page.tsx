export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getManagerScope } from "@/lib/services/payroll-scope";
import { Card, CardContent } from "@/components/ui/card";
import { ManagerRatesClient } from "./manager-rates-client";

const ALLOWED_ROLES = ["MARKET_OWNER", "ADMIN"];

export default async function ManagerRatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) redirect("/dashboard");

  const isAdmin = session.user.role === "ADMIN";
  const { managerIds } = await getManagerScope(session.user);

  const principals = isAdmin
    ? await db.user.findMany({
        where: { role: "FIELD_MANAGER", status: "ACTIVE" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : await db.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      });

  const [sheets, carriers] = await Promise.all([
    isAdmin
      ? db.rateSheet.findMany({
          where: { level: "MANAGER" },
          include: {
            principal: { select: { id: true, name: true, role: true } },
            carrier: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: [{ principalId: "asc" }, { effectiveDate: "desc" }],
        })
      : db.rateSheet.findMany({
          where: { level: "MANAGER", principalId: { in: managerIds } },
          include: {
            principal: { select: { id: true, name: true, role: true } },
            carrier: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: [{ principalId: "asc" }, { effectiveDate: "desc" }],
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
          <ManagerRatesClient
            sheets={sheets}
            principals={principals}
            carriers={carriers}
          />
        </CardContent>
      </Card>
    </div>
  );
}
