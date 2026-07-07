import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "D2D Blitz <noreply@d2dblitz.com>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

export async function sendVerificationEmail(email: string, token: string) {
  const resend = getResendClient();
  const url = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your D2D Blitz account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your D2D Blitz account. This link expires in 24 hours.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Verify Email
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:14px">
          Or copy this link: ${url}
        </p>
        <p style="color:#6b7280;font-size:12px">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPayoutBatchCreatedEmail(params: {
  to: string;
  recipientName: string;
  batchId: string;
  period: string;
  repCount: number;
  totalPayout: number;
  reconciliationRate: number;
  matchedInstalls: number;
  totalInstalls: number;
  slaDeadline: Date;
}) {
  const resend = getResendClient();
  const batchUrl = `${APP_URL}/dashboard/payouts/${params.batchId}`;
  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(params.totalPayout);
  const reconPct = (params.reconciliationRate * 100).toFixed(1);
  const slaStr = params.slaDeadline.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const reconBadge =
    params.reconciliationRate >= 0.95
      ? `<span style="color:#16a34a;font-weight:600">✓ ${reconPct}%</span>`
      : `<span style="color:#dc2626;font-weight:600">⚠ ${reconPct}% — needs resolution before approval</span>`;

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `[Action Required] Payout batch ready for review — ${params.period}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#1e293b">Payout Batch Ready for Approval</h2>
        <p>Hi ${params.recipientName},</p>
        <p>A new payout batch has been created for period <strong>${params.period}</strong> and is awaiting your review.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#6b7280">Reps included</td><td style="padding:8px 0;font-weight:600">${params.repCount}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Total net payout</td><td style="padding:8px 0;font-weight:600">${totalFormatted}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Install reconciliation</td><td style="padding:8px 0">${reconBadge} (${params.matchedInstalls}/${params.totalInstalls} installs matched)</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Approval SLA deadline</td><td style="padding:8px 0;font-weight:600;color:#d97706">${slaStr}</td></tr>
        </table>
        <a href="${batchUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Review &amp; Approve Batch
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px">
          This batch must be approved by <strong>${slaStr}</strong> to meet the &lt;3 business day SLA.
        </p>
      </div>
    `,
  });
}

export async function sendPayoutSLAAlertEmail(params: {
  to: string;
  recipientName: string;
  batchId: string;
  period: string;
  totalPayout: number;
  slaDeadline: Date;
  currentStatus: string;
}) {
  const resend = getResendClient();
  const batchUrl = `${APP_URL}/dashboard/payouts/${params.batchId}`;
  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(params.totalPayout);
  const slaStr = params.slaDeadline.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `⚠ SLA BREACH: Payout batch for ${params.period} is overdue`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#dc2626">⚠ Payout SLA Breach</h2>
        <p>Hi ${params.recipientName},</p>
        <p>The payout batch for period <strong>${params.period}</strong> has not been approved within the required 2-business-day window.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#6b7280">Current status</td><td style="padding:8px 0;font-weight:600">${params.currentStatus}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Total net payout</td><td style="padding:8px 0;font-weight:600">${totalFormatted}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">SLA deadline was</td><td style="padding:8px 0;font-weight:600;color:#dc2626">${slaStr}</td></tr>
        </table>
        <a href="${batchUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Approve Now
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px">
          Reps are waiting for payment. Please approve this batch immediately to meet your &lt;3 business day commitment.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resend = getResendClient();
  const webUrl = `${APP_URL}/reset-password?token=${token}`;
  // Deep link for mobile (d2dblitz://reset-password?token=...)
  const deepLink = `d2dblitz://reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your D2D Blitz password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour and can only be used once.</p>
        <a href="${webUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
          Reset Password
        </a>
        <p style="margin-top:16px;color:#6b7280;font-size:14px">
          On mobile? <a href="${deepLink}">Open in D2D Blitz app</a>
        </p>
        <p style="color:#6b7280;font-size:12px">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
