export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: "/dashboard/admin/carriers",
  EXECUTIVE: "/dashboard/reports/national",
  RECRUITER: "/dashboard/recruiting",
  MARKET_OWNER: "/dashboard/markets",
  FIELD_MANAGER: "/dashboard/manager/reps",
  FIELD_REP: "/dashboard/reps/dashboard",
  CALL_CENTER: "/dashboard/inbound",
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const destination =
    ROLE_REDIRECT[session.user.role] ?? "/dashboard/leaderboard";

  redirect(destination);
}
