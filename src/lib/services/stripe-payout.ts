import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export type TransferredLine = {
  payoutLineId: string;
  repId: string;
  repName: string | null;
  amount: number;
  stripeTransferId: string;
};

export type SkippedLine = {
  payoutLineId: string;
  repId: string;
  repName: string | null;
  amount: number;
  reason:
    | "zero_or_negative_net"
    | "compliance_unverified"
    | "not_onboarded"
    | "already_transferred"
    | "transfer_failed";
  detail?: string;
};

export type PayBatchResult = {
  batchId: string;
  transferred: TransferredLine[];
  skipped: SkippedLine[];
};

/**
 * Move real money for a payout batch via Stripe Connect. For every PayoutLine
 * with a positive net, compliance verified, and an onboarded rep, create a
 * Stripe Transfer to the rep's connected account. Idempotency key = payoutLineId
 * so re-running a PAID transition never double-pays. Lines that can't be paid
 * (not onboarded, on hold, zero) are reported in `skipped` — never dropped.
 */
export async function payBatchViaStripe(batchId: string): Promise<PayBatchResult> {
  const stripe = getStripe();

  const lines = await db.payoutLine.findMany({
    where: { batchId },
    include: {
      rep: {
        select: {
          id: true,
          name: true,
          stripeAccount: true,
        },
      },
      payoutTransfer: true,
    },
  });

  const transferred: TransferredLine[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of lines) {
    const base = {
      payoutLineId: line.id,
      repId: line.repId,
      repName: line.rep.name,
      amount: line.netPay,
    };

    // Already paid on a prior run — safe re-entrancy.
    if (
      line.payoutTransfer?.status === "PAID" &&
      line.payoutTransfer.stripeTransferId
    ) {
      skipped.push({ ...base, reason: "already_transferred" });
      continue;
    }

    if (line.netPay <= 0) {
      skipped.push({ ...base, reason: "zero_or_negative_net" });
      continue;
    }

    if (!line.complianceVerified) {
      skipped.push({ ...base, reason: "compliance_unverified" });
      continue;
    }

    const account = line.rep.stripeAccount;
    if (!account || !account.payoutsEnabled) {
      skipped.push({ ...base, reason: "not_onboarded" });
      continue;
    }

    const currency = account.defaultCurrency || "usd";
    const amountInCents = Math.round(line.netPay * 100);

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountInCents,
          currency,
          destination: account.stripeAccountId,
          metadata: {
            payoutLineId: line.id,
            batchId,
            repId: line.repId,
          },
        },
        { idempotencyKey: `payout-line-${line.id}` }
      );

      await db.payoutTransfer.upsert({
        where: { payoutLineId: line.id },
        create: {
          payoutLineId: line.id,
          repId: line.repId,
          stripeAccountId: account.stripeAccountId,
          stripeTransferId: transfer.id,
          amount: line.netPay,
          currency,
          status: "PAID",
        },
        update: {
          stripeTransferId: transfer.id,
          amount: line.netPay,
          currency,
          status: "PAID",
          failureReason: null,
        },
      });

      transferred.push({
        payoutLineId: line.id,
        repId: line.repId,
        repName: line.rep.name,
        amount: line.netPay,
        stripeTransferId: transfer.id,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      await db.payoutTransfer.upsert({
        where: { payoutLineId: line.id },
        create: {
          payoutLineId: line.id,
          repId: line.repId,
          stripeAccountId: account.stripeAccountId,
          amount: line.netPay,
          currency,
          status: "FAILED",
          failureReason: detail,
        },
        update: {
          status: "FAILED",
          failureReason: detail,
        },
      });
      skipped.push({ ...base, reason: "transfer_failed", detail });
    }
  }

  return { batchId, transferred, skipped };
}
