// Fiber Blitz OS v2 — new-rep onboarding (spec §8, Teki #4).
//
// No e-sign — G0/onboarding is a blitz-terms CHECKBOX (Teki #4). These are the
// terms a prospective rep accepts. Background check is manual for v1 (the seam
// just records consent); phone SMS verification is deferred until Sendify.

export const BLITZ_TERMS: string[] = [
  "I commit to work the days of the blitz (Sunday optional).",
  "If any costs are fronted for me, I commit to 2 deals per week for cost recovery.",
  "I commit to work a minimum of 6 hours per workday.",
  "I understand that violating these terms may result in removal from the blitz.",
];

// Shape stored on User.onboardingData for a prospective rep.
export interface OnboardingData {
  homeMarket?: string;
  experienceMonths?: number;
  priorCarriers?: string;
  peakMonthlyDeals?: number;
  references?: string;
  backgroundCheckAuthorized: boolean;
  w9Acknowledged: boolean;
  termsAccepted: boolean;
  originBlitzId?: string | null;
  originToken?: string | null;
  submittedAt: string;
}
