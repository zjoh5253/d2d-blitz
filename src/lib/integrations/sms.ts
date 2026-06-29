// Fiber Blitz OS v2 — SMS channel seam (spec §6.1, §11.1: Sendify).
//
// The invite engine and onboarding verify call sendSms() through this seam so
// they can be built and tested NOW on the push channel; the real Sendify
// provider drops in once the account + A2P 10DLC template are live, with zero
// caller changes. Until SENDIFY_API_KEY is set, this no-ops (logs + reports
// not-configured) instead of throwing, so dev/push-only flows never break.

export interface SmsMessage {
  to: string; // E.164
  body: string;
  templateId?: string; // A2P-registered template, when applicable
}

export interface SmsResult {
  delivered: boolean;
  providerId?: string;
  skipped?: "not_configured";
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly configured: boolean;
  send(msg: SmsMessage): Promise<SmsResult>;
}

// Inert provider used until Sendify creds exist. Never throws.
const noopSmsProvider: SmsProvider = {
  name: "noop",
  configured: false,
  async send(msg) {
    console.info(`[sms:noop] would send to ${msg.to}: ${msg.body.slice(0, 60)}…`);
    return { delivered: false, skipped: "not_configured" };
  },
};

// TODO(sendify): implement SendifyProvider here when creds land. Read
// SENDIFY_API_KEY / SENDIFY_SENDER from env, POST to their API, map the
// response onto SmsResult. getSmsProvider() switches to it automatically.
export function getSmsProvider(): SmsProvider {
  if (process.env.SENDIFY_API_KEY) {
    // return new SendifyProvider(...)
  }
  return noopSmsProvider;
}

export function sendSms(msg: SmsMessage): Promise<SmsResult> {
  return getSmsProvider().send(msg);
}
