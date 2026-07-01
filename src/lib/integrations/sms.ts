// Fiber Blitz OS v2 — SMS channel seam (spec §6.1). Provider: Twilio.
//
// The invite engine (and future onboarding verification) call sendSms() through
// this seam. It's live once Twilio creds are set in env; until then it no-ops
// (logs + reports not-configured) so push-only flows never break.
//
// Env (set in Vercel prod):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and ONE sender:
//     TWILIO_MESSAGING_SERVICE_SID  (preferred — ties to the A2P 10DLC campaign
//                                    + number pool), or TWILIO_FROM (a number).
// US business texting still requires A2P 10DLC brand + campaign registration.

export interface SmsMessage {
  to: string; // E.164, e.g. +15125551234
  body: string;
  templateId?: string; // unused by Twilio; kept for interface stability
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

// Inert provider used until Twilio creds exist. Never throws.
const noopSmsProvider: SmsProvider = {
  name: "noop",
  configured: false,
  async send(msg) {
    console.info(`[sms:noop] would send to ${msg.to}: ${msg.body.slice(0, 60)}…`);
    return { delivered: false, skipped: "not_configured" };
  },
};

// Twilio REST API (no SDK dependency — form-encoded POST + Basic auth).
class TwilioProvider implements SmsProvider {
  readonly name = "twilio";
  readonly configured = true;
  constructor(
    private readonly sid: string,
    private readonly token: string,
    private readonly sender: string,
    private readonly senderIsService: boolean
  ) {}

  async send(msg: SmsMessage): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
    const form = new URLSearchParams({ To: msg.to, Body: msg.body });
    // A Messaging Service (MG…) carries the 10DLC campaign + number pool; a bare
    // From number is the simpler fallback.
    form.set(this.senderIsService ? "MessagingServiceSid" : "From", this.sender);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${this.sid}:${this.token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) return { delivered: false, error: data.message ?? `Twilio HTTP ${res.status}` };
      return { delivered: true, providerId: data.sid };
    } catch (e) {
      return { delivered: false, error: e instanceof Error ? e.message : "send failed" };
    }
  }
}

export function getSmsProvider(): SmsProvider {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM;
  if (sid && token && (service || from)) {
    return new TwilioProvider(sid, token, service ?? from!, Boolean(service));
  }
  return noopSmsProvider;
}

export function sendSms(msg: SmsMessage): Promise<SmsResult> {
  return getSmsProvider().send(msg);
}
