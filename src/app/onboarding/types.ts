/** Shared types for the onboarding wizard, matching the onboarding API shapes. */

export interface OnboardingStatusAgreement {
  id: string;
  type: string;
  title: string;
  required: boolean;
  blocking: boolean;
  requiresUpload: boolean;
  accepted: boolean;
  acceptedAt: string | null;
}

export interface OnboardingStatus {
  profileComplete: boolean;
  blockingComplete: boolean;
  allComplete: boolean;
  gateComplete: boolean;
  agreements: OnboardingStatusAgreement[];
}

export interface OnboardingAgreement {
  id: string;
  type: string;
  title: string;
  body: string;
  version: number;
  required: boolean;
  blocking: boolean;
  requiresUpload: boolean;
  accepted: boolean;
  acceptedAt: string | null;
}
