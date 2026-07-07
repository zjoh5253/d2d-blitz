"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Check } from "lucide-react";

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (session?.user && !loaded) {
      setName(session.user.name ?? "");
      setEmail(session.user.email ?? "");
      setLoaded(true);
    }
  }, [session, loaded]);

  const submit = async () => {
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? `Failed (${res.status})`);
        return;
      }
      await update?.();
      setSuccess(true);
      setTimeout(() => router.push("/rep/profile"), 700);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-3 py-3">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold">Edit Profile</h1>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3 rounded-lg border bg-white text-base" />
        </div>
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" className="w-full h-11 px-3 rounded-lg border bg-white text-base" />
        </div>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        {success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="size-4" /> Saved.
          </div>
        )}
        <button onClick={submit} disabled={submitting} className="w-full bg-blue-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg">
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
