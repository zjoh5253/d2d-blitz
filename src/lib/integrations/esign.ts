// Fiber Blitz OS v2 — e-signature seam (spec §8.1 contractor agreement, G0 terms).
//
// Onboarding and the G0 gate request a signature through this seam. The whole
// onboarding flow can be built around it now; the real provider (DocuSign /
// Dropbox Sign / etc.) AND the legal-approved contractor agreement text drop in
// later. Until configured, createSignatureRequest() returns a `not_configured`
// status so the onboarding UI can show "e-sign coming soon" rather than crash.

export type SignatureStatus = "not_configured" | "pending" | "signed" | "declined";

export interface SignatureRequest {
  documentKey: string; // which doc, e.g. "contractor_agreement" | "blitz_terms"
  signerName: string;
  signerEmail: string;
  metadata?: Record<string, string>; // e.g. { blitzId, repId }
}

export interface SignatureResult {
  status: SignatureStatus;
  requestId?: string;
  signUrl?: string; // embed / redirect target for the signer
  error?: string;
}

export interface EsignProvider {
  readonly name: string;
  readonly configured: boolean;
  createSignatureRequest(req: SignatureRequest): Promise<SignatureResult>;
  getStatus(requestId: string): Promise<SignatureStatus>;
}

const noopEsignProvider: EsignProvider = {
  name: "noop",
  configured: false,
  async createSignatureRequest() {
    return { status: "not_configured" };
  },
  async getStatus() {
    return "not_configured";
  },
};

// TODO(esign): implement the real provider when chosen + the contractor
// agreement text is finalized. Switch on ESIGN_API_KEY here.
export function getEsignProvider(): EsignProvider {
  if (process.env.ESIGN_API_KEY) {
    // return new DocuSignProvider(...) / DropboxSignProvider(...)
  }
  return noopEsignProvider;
}
