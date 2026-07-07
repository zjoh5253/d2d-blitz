// Fiber Blitz OS v2 — background-check seam (spec §8.1 credentials).
//
// v1 default is MANUAL: onboarding captures the rep's authorization/consent and
// that's it — checks are run off-platform. This seam lets onboarding record
// consent now and later flip to an automated vendor (Checkr, etc.) by setting
// BACKGROUND_CHECK_PROVIDER, with no onboarding-flow changes.

export type BackgroundCheckStatus = "authorized" | "pending" | "clear" | "flagged";

export interface BackgroundCheckRequest {
  repId: string;
  fullName: string;
  email: string;
  authorizedAt: Date;
}

export interface BackgroundCheckResult {
  status: BackgroundCheckStatus;
  mode: "manual" | "automated";
  externalId?: string;
}

export interface BackgroundCheckProvider {
  readonly mode: "manual" | "automated";
  submit(req: BackgroundCheckRequest): Promise<BackgroundCheckResult>;
}

// Manual mode: just acknowledge consent was captured; a human runs the check.
const manualProvider: BackgroundCheckProvider = {
  mode: "manual",
  async submit() {
    return { status: "authorized", mode: "manual" };
  },
};

// TODO(bgcheck): add an automated provider (Checkr…) keyed on
// BACKGROUND_CHECK_PROVIDER when/if v1 needs it.
export function getBackgroundCheckProvider(): BackgroundCheckProvider {
  // if (process.env.BACKGROUND_CHECK_PROVIDER === "checkr") return new CheckrProvider(...)
  return manualProvider;
}
