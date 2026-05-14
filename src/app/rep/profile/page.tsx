"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { LogOut, ChevronRight, User, Trophy, FileText, ArrowLeftRight } from "lucide-react";

export default function RepProfilePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = (session?.user as { role?: string })?.role ?? "—";

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg border p-4">
        <h1 className="text-lg font-semibold mb-1">{user?.name ?? "—"}</h1>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Role: {role}</p>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        <NavRow href="/rep/profile/edit" icon={User} label="Edit profile" />
        <NavRow href="/rep/leaderboard" icon={Trophy} label="Leaderboard" />
        <NavRow href="/rep/reports" icon={FileText} label="Daily reports" />
        <NavRow href="/rep/gobacks" icon={ArrowLeftRight} label="Go-backs" />
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 text-white font-medium py-3"
      >
        <LogOut className="size-4" />
        Sign out
      </button>

      <p className="text-xs text-gray-400 text-center pt-2">
        Password changes — contact your administrator.
      </p>
    </div>
  );
}

function NavRow({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 active:bg-gray-50">
      <Icon className="size-5 text-gray-500" />
      <span className="flex-1 text-sm font-medium text-gray-900">{label}</span>
      <ChevronRight className="size-4 text-gray-400" />
    </Link>
  );
}
