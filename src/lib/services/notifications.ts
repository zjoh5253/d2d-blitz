/**
 * Expo Push Notification service.
 * Sends push notifications via the Expo Push API.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { db } from "@/lib/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

async function sendExpoPushMessages(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        "[notifications] Expo push API returned",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error("[notifications] Failed to send push notifications:", error);
  }
}

/**
 * Get all push tokens registered for a user.
 */
async function getTokensForUser(userId: string): Promise<string[]> {
  const tokens = await db.devicePushToken.findMany({
    where: { userId },
    select: { token: true },
  });
  return tokens.map((t) => t.token);
}

/**
 * Notify a rep they've been assigned to a blitz.
 */
export async function notifyBlitzAssigned(params: {
  repId: string;
  blitzId: string;
  blitzName: string;
}): Promise<void> {
  const tokens = await getTokensForUser(params.repId);
  if (tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title: "Blitz Assignment",
    body: `You've been assigned to "${params.blitzName}". Tap to view details.`,
    data: {
      screen: "BlitzDetail",
      blitzId: params.blitzId,
    },
    sound: "default",
    channelId: "default",
  }));

  await sendExpoPushMessages(messages);
}

/**
 * Notify a rep that a commission has been posted to their account.
 */
export async function notifyCommissionPosted(params: {
  repId: string;
  blitzId: string;
  blitzName: string;
  repPay: number;
}): Promise<void> {
  const tokens = await getTokensForUser(params.repId);
  if (tokens.length === 0) return;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(params.repPay);

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title: "Commission Posted",
    body: `${formatted} commission added from "${params.blitzName}". Tap to view.`,
    data: {
      screen: "Commissions",
      blitzId: params.blitzId,
    },
    sound: "default",
    channelId: "commissions",
  }));

  await sendExpoPushMessages(messages);
}

/**
 * Notify a rep that a payout batch has been approved and funds are on the way.
 */
export async function notifyPayoutPaid(params: {
  repId: string;
  batchId: string;
  period: string;
  netPay: number;
}): Promise<void> {
  const tokens = await getTokensForUser(params.repId);
  if (tokens.length === 0) return;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(params.netPay);

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title: "Payout Dispatched",
    body: `${formatted} payout for period "${params.period}" has been processed and is on its way.`,
    data: {
      screen: "Payouts",
      batchId: params.batchId,
    },
    sound: "default",
    channelId: "commissions",
  }));

  await sendExpoPushMessages(messages);
}
