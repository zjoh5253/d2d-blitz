// Fiber Blitz OS v2 — public blitz card data (spec §7).
//
// A blitz's shareable card lives at /b/{publicCardToken} with no auth. This
// module mints tokens and loads the card's view data. Used by the public page
// and its OG image route so both render identical info.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";

// URL-safe, unguessable token for the public card link.
export function generateCardToken(): string {
  return randomBytes(12).toString("base64url"); // ~16 chars, a-z A-Z 0-9 - _
}

export interface PublicCardData {
  token: string;
  blitzName: string;
  carrierName: string;
  marketName: string;
  startDate: Date;
  endDate: Date;
  seatsTotal: number;
  seatsRemaining: number;
  comp: { name: string; baseCommissionCents: number | null; travelNotes: string | null } | null;
  travelModel: string | null;
  housingPlan: string | null;
  coverageArea: string | null;
  manager: { name: string | null; phone: string | null };
  // Card "expires" (shows the closed state) once the blitz fills or starts.
  expired: boolean;
}

const ACTIVE_SIGNUP = ["CLAIMED", "ACTIVE"] as const;

export async function getPublicCardData(token: string): Promise<PublicCardData | null> {
  const blitz = await db.blitz.findFirst({
    where: { publicCardToken: token, publicCardEnabled: true },
    include: {
      market: { select: { name: true, coverageArea: true, carrier: { select: { name: true } } } },
      manager: { select: { name: true, phone: true } },
      compTier: { select: { name: true, baseCommission: true, travelNotes: true } },
      signups: { where: { status: { in: [...ACTIVE_SIGNUP] } }, select: { id: true } },
    },
  });
  if (!blitz) return null;

  const taken = blitz.signups.length;
  const seatsRemaining = Math.max(0, blitz.repCap - taken);
  const expired = seatsRemaining <= 0 || new Date() > blitz.startDate;

  return {
    token,
    blitzName: blitz.name,
    carrierName: blitz.market.carrier.name,
    marketName: blitz.market.name,
    startDate: blitz.startDate,
    endDate: blitz.endDate,
    seatsTotal: blitz.repCap,
    seatsRemaining,
    comp: blitz.compTier
      ? { name: blitz.compTier.name, baseCommissionCents: blitz.compTier.baseCommission, travelNotes: blitz.compTier.travelNotes }
      : null,
    travelModel: blitz.travelModel,
    housingPlan: blitz.housingPlan,
    coverageArea: blitz.market.coverageArea,
    manager: { name: blitz.manager.name, phone: blitz.manager.phone },
    expired,
  };
}

// Short date range for the hero, e.g. "Jul 1–14".
export function formatDateRange(start: Date, end: Date): string {
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  if (start.getUTCMonth() === end.getUTCMonth()) return `${mo(start)} ${day(start)}–${day(end)}`;
  return `${mo(start)} ${day(start)} – ${mo(end)} ${day(end)}`;
}

export function formatComp(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/install`;
}
