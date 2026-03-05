export const dynamic = "force-dynamic";

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { GoBackForm } from "../go-back-form"

export default async function NewGoBackPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Go-Back</h1>
        <p className="text-muted-foreground">
          Record a prospect for a follow-up visit.
        </p>
      </div>
      <GoBackForm mode="add" />
    </div>
  )
}
