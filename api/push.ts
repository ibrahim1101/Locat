import webpush from "web-push";
import { createHash } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { pushSubscriptions, sessions, users } from "@db/schema";

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY,
    subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
/** Limit destinations to browser push providers, never arbitrary client-supplied servers. */
export function allowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443")
    )
      return false;
    return (
      [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
      ].includes(url.hostname) || url.hostname.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
export const endpointHash = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex");
const pending = new Set<number>();
const lastNotified = new Map<number, number>();
export async function notifyUsers(userIds: number[]): Promise<void> {
  const config = pushConfiguration();
  if (!config || !userIds.length) return;
  const now = Date.now();
  if (lastNotified.size > 10000)
    for (const [id, time] of lastNotified)
      if (time < now - 10000) lastNotified.delete(id);
  const ids = [...new Set(userIds)].filter(
    id => !pending.has(id) && (lastNotified.get(id) ?? 0) < now - 10000
  );
  if (!ids.length) return;
  ids.forEach(id => {
    pending.add(id);
    lastNotified.set(id, now);
  });
  try {
    // A revoked/expired login cannot receive a new push. Message contents and names are omitted.
    const rows = await getDb()
      .select({ subscription: pushSubscriptions })
      .from(pushSubscriptions)
      .innerJoin(
        sessions,
        and(
          eq(pushSubscriptions.sessionToken, sessions.token),
          eq(pushSubscriptions.userId, sessions.userId)
        )
      )
      .innerJoin(users, eq(pushSubscriptions.userId, users.id))
      .where(
        and(
          inArray(pushSubscriptions.userId, ids),
          gt(sessions.expiresAt, new Date()),
          eq(users.disabled, false)
        )
      )
      .limit(500);
    // Bound concurrent outbound requests independently of group size.
    for (let offset = 0; offset < rows.length; offset += 5) {
      await Promise.allSettled(
        rows.slice(offset, offset + 5).map(async ({ subscription }) => {
          if (!allowedPushEndpoint(subscription.endpoint)) return;
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify({
                type: "new-message",
                userId: subscription.userId,
              }),
              {
                vapidDetails: config,
                timeout: 5000,
                TTL: 300,
                topic: "locat-new-message",
              }
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await getDb()
                .delete(pushSubscriptions)
                .where(eq(pushSubscriptions.id, subscription.id));
            // Never log endpoints, keys, or provider responses containing subscription secrets.
          }
        })
      );
    }
  } finally {
    ids.forEach(id => pending.delete(id));
  }
}
