export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TimeEditsClient } from "./time-edits-client";

export default async function ManagerTimeEditsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FIELD_MANAGER") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time-Log Edits</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve rep-requested changes to their GPS time logs.
          Approving applies the change and recalculates total hours.
        </p>
      </div>
      <TimeEditsClient />
    </div>
  );
}
