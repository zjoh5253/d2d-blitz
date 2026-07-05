/**
 * Stripe Connect payout tests.
 * Exercises the payout service, the connect onboard/status routes, and the
 * webhook — all with mocked db + Stripe so CI needs no database or network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (top-level, before imports) ────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    payoutLine: { findMany: vi.fn() },
    payoutTransfer: { upsert: vi.fn(), updateMany: vi.fn() },
    stripeConnectedAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}));

const stripeMock = {
  transfers: { create: vi.fn() },
  accounts: { create: vi.fn(), retrieve: vi.fn() },
  accountLinks: { create: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => stripeMock,
  getAppOrigin: () => "http://localhost:3000",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { payBatchViaStripe } from "@/lib/services/stripe-payout";

const mockDb = db as unknown as {
  payoutLine: { findMany: ReturnType<typeof vi.fn> };
  payoutTransfer: { upsert: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  stripeConnectedAccount: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function onboardedAccount(overrides: Record<string, unknown> = {}) {
  return {
    stripeAccountId: "acct_123",
    payoutsEnabled: true,
    defaultCurrency: "usd",
    ...overrides,
  };
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    repId: "rep-1",
    netPay: 100,
    complianceVerified: true,
    rep: { id: "rep-1", name: "Rep One", stripeAccount: onboardedAccount() },
    payoutTransfer: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

// ─── payBatchViaStripe ───────────────────────────────────────────────────────

describe("payBatchViaStripe", () => {
  it("creates a Stripe transfer for an eligible, onboarded rep with an idempotency key", async () => {
    mockDb.payoutLine.findMany.mockResolvedValueOnce([line()]);
    stripeMock.transfers.create.mockResolvedValueOnce({ id: "tr_1" });
    mockDb.payoutTransfer.upsert.mockResolvedValueOnce({});

    const result = await payBatchViaStripe("batch-1");

    expect(stripeMock.transfers.create).toHaveBeenCalledTimes(1);
    const [args, opts] = stripeMock.transfers.create.mock.calls[0];
    expect(args).toMatchObject({ amount: 10000, currency: "usd", destination: "acct_123" });
    expect(opts).toEqual({ idempotencyKey: "payout-line-line-1" });
    expect(result.transferred).toHaveLength(1);
    expect(result.transferred[0].stripeTransferId).toBe("tr_1");
    expect(result.skipped).toHaveLength(0);
  });

  it("skips a rep who is not onboarded and never calls Stripe", async () => {
    mockDb.payoutLine.findMany.mockResolvedValueOnce([
      line({ rep: { id: "rep-1", name: "Rep One", stripeAccount: null } }),
    ]);

    const result = await payBatchViaStripe("batch-1");

    expect(stripeMock.transfers.create).not.toHaveBeenCalled();
    expect(result.transferred).toHaveLength(0);
    expect(result.skipped[0]).toMatchObject({ reason: "not_onboarded" });
  });

  it("skips zero-net and compliance-unverified lines", async () => {
    mockDb.payoutLine.findMany.mockResolvedValueOnce([
      line({ id: "zero", netPay: 0 }),
      line({ id: "unverified", complianceVerified: false }),
    ]);

    const result = await payBatchViaStripe("batch-1");

    expect(stripeMock.transfers.create).not.toHaveBeenCalled();
    const reasons = result.skipped.map((s) => s.reason).sort();
    expect(reasons).toEqual(["compliance_unverified", "zero_or_negative_net"]);
  });

  it("does not re-pay a line already transferred (idempotent re-run)", async () => {
    mockDb.payoutLine.findMany.mockResolvedValueOnce([
      line({ payoutTransfer: { status: "PAID", stripeTransferId: "tr_prev" } }),
    ]);

    const result = await payBatchViaStripe("batch-1");

    expect(stripeMock.transfers.create).not.toHaveBeenCalled();
    expect(result.skipped[0]).toMatchObject({ reason: "already_transferred" });
  });

  it("records a FAILED transfer when Stripe throws", async () => {
    mockDb.payoutLine.findMany.mockResolvedValueOnce([line()]);
    stripeMock.transfers.create.mockRejectedValueOnce(new Error("insufficient funds"));
    mockDb.payoutTransfer.upsert.mockResolvedValueOnce({});

    const result = await payBatchViaStripe("batch-1");

    expect(result.transferred).toHaveLength(0);
    expect(result.skipped[0]).toMatchObject({ reason: "transfer_failed", detail: "insufficient funds" });
    const upsertArg = mockDb.payoutTransfer.upsert.mock.calls[0][0];
    expect(upsertArg.create.status).toBe("FAILED");
  });
});

// ─── POST /api/stripe/connect/onboard ────────────────────────────────────────

describe("POST /api/stripe/connect/onboard", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/stripe/connect/onboard/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("creates an Express account and returns an onboarding link", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "rep-1" } });
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce(null);
    mockDb.user.findUnique.mockResolvedValueOnce({ email: "rep@example.com" });
    stripeMock.accounts.create.mockResolvedValueOnce({ id: "acct_new", default_currency: "usd" });
    mockDb.stripeConnectedAccount.create.mockResolvedValueOnce({ stripeAccountId: "acct_new" });
    stripeMock.accountLinks.create.mockResolvedValueOnce({ url: "https://connect.stripe.com/setup/x" });

    const { POST } = await import("@/app/api/stripe/connect/onboard/route");
    const res = await POST();
    const json = await res.json();

    expect(stripeMock.accounts.create).toHaveBeenCalled();
    expect(json.url).toBe("https://connect.stripe.com/setup/x");
  });

  it("reuses an existing account instead of creating a new one", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "rep-1" } });
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce({ stripeAccountId: "acct_existing" });
    stripeMock.accountLinks.create.mockResolvedValueOnce({ url: "https://connect.stripe.com/setup/y" });

    const { POST } = await import("@/app/api/stripe/connect/onboard/route");
    const res = await POST();
    await res.json();

    expect(stripeMock.accounts.create).not.toHaveBeenCalled();
    expect(stripeMock.accountLinks.create).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acct_existing", type: "account_onboarding" })
    );
  });
});

// ─── GET /api/stripe/connect/status ──────────────────────────────────────────

describe("GET /api/stripe/connect/status", () => {
  it("returns NOT_STARTED when no account exists", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "rep-1" } });
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/stripe/connect/status/route");
    const json = await (await GET()).json();

    expect(json).toMatchObject({ connected: false, onboardingStatus: "NOT_STARTED", payoutsEnabled: false });
  });

  it("refreshes flags from Stripe and reports ACTIVE when payouts enabled", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "rep-1" } });
    // status route lookup:
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce({ stripeAccountId: "acct_123" });
    stripeMock.accounts.retrieve.mockResolvedValueOnce({
      id: "acct_123",
      payouts_enabled: true,
      details_submitted: true,
      charges_enabled: true,
      default_currency: "usd",
    });
    // syncConnectedAccount's own lookup + update:
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce({ stripeAccountId: "acct_123", defaultCurrency: "usd" });
    mockDb.stripeConnectedAccount.update.mockResolvedValueOnce({
      onboardingStatus: "ACTIVE",
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    });

    const { GET } = await import("@/app/api/stripe/connect/status/route");
    const json = await (await GET()).json();

    expect(json).toMatchObject({ connected: true, onboardingStatus: "ACTIVE", payoutsEnabled: true });
  });
});

// ─── POST /api/webhooks/stripe ───────────────────────────────────────────────

describe("POST /api/webhooks/stripe", () => {
  async function invoke(req: Request) {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    // NextRequest is compatible enough with Request for these handlers.
    return POST(req as unknown as import("next/server").NextRequest);
  }

  it("rejects a request with no signature header", async () => {
    const res = await invoke(new Request("http://x/api/webhooks/stripe", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid signature", async () => {
    stripeMock.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("bad sig");
    });
    const res = await invoke(
      new Request("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bad" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
  });

  it("marks a transfer REVERSED on transfer.reversed", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      type: "transfer.reversed",
      data: { object: { id: "tr_1" } },
    });
    mockDb.payoutTransfer.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await invoke(
      new Request("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=ok" },
        body: "{}",
      })
    );

    expect(res.status).toBe(200);
    expect(mockDb.payoutTransfer.updateMany).toHaveBeenCalledWith({
      where: { stripeTransferId: "tr_1" },
      data: { status: "REVERSED" },
    });
  });

  it("syncs account flags on account.updated", async () => {
    stripeMock.webhooks.constructEvent.mockReturnValueOnce({
      type: "account.updated",
      data: { object: { id: "acct_123", payouts_enabled: true, details_submitted: true } },
    });
    mockDb.stripeConnectedAccount.findUnique.mockResolvedValueOnce({ stripeAccountId: "acct_123", defaultCurrency: "usd" });
    mockDb.stripeConnectedAccount.update.mockResolvedValueOnce({});

    const res = await invoke(
      new Request("http://x/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=ok" },
        body: "{}",
      })
    );

    expect(res.status).toBe(200);
    expect(mockDb.stripeConnectedAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeAccountId: "acct_123" },
        data: expect.objectContaining({ onboardingStatus: "ACTIVE", payoutsEnabled: true }),
      })
    );
  });
});
