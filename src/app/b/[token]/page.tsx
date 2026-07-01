import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, CalendarDays, Users, Phone, DollarSign, Hotel } from "lucide-react";
import { getPublicCardData, formatDateRange, formatComp } from "@/lib/public-card";

// Seats remaining changes as reps claim, so never cache the card.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }>; searchParams: Promise<{ ref?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const data = await getPublicCardData(token);
  if (!data) return { title: "Blitz not found · Fiber Blitz" };
  const dates = formatDateRange(data.startDate, data.endDate);
  const desc = `${data.carrierName} · ${dates} · ${data.seatsRemaining} of ${data.seatsTotal} seats open`;
  return {
    title: `${data.blitzName} · Fiber Blitz`,
    description: desc,
    openGraph: { title: data.blitzName, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: data.blitzName, description: desc },
  };
}

export default async function PublicBlitzCard({ params, searchParams }: Params) {
  const { token } = await params;
  const { ref } = await searchParams;
  const data = await getPublicCardData(token);
  if (!data) notFound();

  const dates = formatDateRange(data.startDate, data.endDate);
  const comp = data.comp ? formatComp(data.comp.baseCommissionCents) : null;
  const travel =
    data.travelModel === "company_fronted"
      ? "Company-fronted travel"
      : data.travelModel === "rep_fronted_reimburse"
        ? "Travel reimbursed"
        : null;
  // Forward referral attribution to onboarding: an explicit ?ref wins, else the
  // card token itself sources the new rep.
  const refParam = encodeURIComponent(ref || data.token);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 flex justify-center">
      <div className="w-full max-w-md space-y-4">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 p-6 text-white shadow-lg">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">{data.carrierName}</div>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{data.blitzName}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-200">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" />{dates}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{data.marketName}</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
            <Users className="size-4" />
            {data.expired
              ? "Filled — no open seats"
              : `${data.seatsRemaining} of ${data.seatsTotal} seats open`}
          </div>
        </div>

        {/* Comp + location */}
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          {comp && (
            <Row icon={<DollarSign className="size-4 text-emerald-600" />} label="Compensation">
              <div className="font-semibold text-gray-900">{comp}</div>
              {(travel || data.comp?.travelNotes) && (
                <div className="text-sm text-gray-500">{[travel, data.comp?.travelNotes].filter(Boolean).join(" · ")}</div>
              )}
            </Row>
          )}
          {data.coverageArea && (
            <Row icon={<MapPin className="size-4 text-blue-600" />} label="Territory">
              <div className="text-sm text-gray-700">{data.coverageArea}</div>
            </Row>
          )}
          {data.housingPlan && (
            <Row icon={<Hotel className="size-4 text-violet-600" />} label="Housing">
              <div className="text-sm text-gray-700">{data.housingPlan}</div>
            </Row>
          )}
        </div>

        {/* Manager signature */}
        {data.manager.name && (
          <div className="rounded-2xl bg-white p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">Run by</div>
              <div className="font-semibold text-gray-900">{data.manager.name}</div>
            </div>
            {data.manager.phone && (
              <a href={`tel:${data.manager.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800">
                <Phone className="size-4" /> Call
              </a>
            )}
          </div>
        )}

        {/* CTAs */}
        {data.expired ? (
          <Link href="/rep/board" className="block rounded-xl bg-gray-900 px-4 py-3 text-center font-semibold text-white">
            See other open blitzes
          </Link>
        ) : (
          <div className="space-y-2">
            <Link href="/rep/board" className="block rounded-xl bg-gray-900 px-4 py-3 text-center font-semibold text-white">
              Claim a slot
            </Link>
            <Link href={`/onboarding?ref=${refParam}`} className="block rounded-xl border border-gray-300 bg-white px-4 py-3 text-center font-semibold text-gray-800">
              New to Fiber Blitz? Start here
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">Fiber Blitz</p>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
        {children}
      </div>
    </div>
  );
}
