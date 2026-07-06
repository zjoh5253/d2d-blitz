/**
 * Role-based financial visibility for commission records (PRD §16).
 * Downstream users must not see upstream economics: a rep sees only their own
 * commission (repPay); a manager also their override; a market owner also their
 * spread; only ADMIN/EXECUTIVE see the carrier payout + company floor.
 */

export type UpstreamField =
  | "carrierPayout"
  | "companyFloor"
  | "managerOverride"
  | "marketOwnerSpread";

export const UPSTREAM_FIELDS: UpstreamField[] = [
  "carrierPayout",
  "companyFloor",
  "managerOverride",
  "marketOwnerSpread",
];

/** The upstream commission fields a role is allowed to see. */
export function visibleUpstreamFields(role: string): Set<UpstreamField> {
  switch (role) {
    case "ADMIN":
    case "EXECUTIVE":
      return new Set(UPSTREAM_FIELDS);
    case "FIELD_MANAGER":
      return new Set(["managerOverride"]);
    case "MARKET_OWNER":
      return new Set(["marketOwnerSpread"]);
    default:
      return new Set();
  }
}

/** Whether a role may see the raw carrier payout / company margin. */
export function canSeeUpstreamMargin(role: string): boolean {
  return role === "ADMIN" || role === "EXECUTIVE";
}

/**
 * Return a shallow copy of a commission record with the upstream financial
 * fields the role may NOT see removed. repPay, status, ids, and relations are
 * left untouched.
 */
export function redactCommission<T extends Record<string, unknown>>(
  record: T,
  role: string
): T {
  const allowed = visibleUpstreamFields(role);
  const out = { ...record };
  for (const field of UPSTREAM_FIELDS) {
    if (!allowed.has(field) && field in out) {
      delete (out as Record<string, unknown>)[field];
    }
  }
  return out;
}
