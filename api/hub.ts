// In-memory pub/sub hub: tracks which users have an open realtime
// connection and fans out relay events (new messages, presence) to them.
// Nothing is persisted here — offline recipients are served from the
// transient DB queue on their next sync.

import type { RelayEvent } from "@contracts/types";
import { getDb } from "./queries/connection";
import { contactRelationships, users } from "@db/schema";
import { and, eq, inArray, or } from "drizzle-orm";

type Listener = (event: RelayEvent) => void;

const listeners = new Map<number, Set<Listener>>();
// HTTP polling clients (including native WebViews) also count as online.
// Expire stale heartbeats so closed/crashed clients don't remain online.
const heartbeats = new Map<number, number>();
const HEARTBEAT_TTL_MS = 65_000;

export function heartbeat(userId: number): void {
  const wasOnline = onlineUserIds().includes(userId);
  heartbeats.set(userId, Date.now() + HEARTBEAT_TTL_MS);
  if (!wasOnline) void broadcastPresence().catch(() => {});
}


export function subscribe(userId: number, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);

  const firstConnection = set.size === 1;
  if (firstConnection) void broadcastPresence().catch(() => {});

  return () => {
    const s = listeners.get(userId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) {
      listeners.delete(userId);
      void broadcastPresence().catch(() => {});
    }
  };
}

export function onlineUserIds(): number[] {
  const now = Date.now();
  for (const [id, expiry] of heartbeats) if (expiry <= now) heartbeats.delete(id);
  return [...new Set([...listeners.keys(), ...heartbeats.keys()])];
}

export async function visibleOnlineUserIds(viewerId: number): Promise<number[]> {
  const online = onlineUserIds();
  if (!online.length) return [];
  const relationships = await getDb().select().from(contactRelationships).where(and(
    eq(contactRelationships.status, "accepted"),
    or(eq(contactRelationships.userLowId, viewerId), eq(contactRelationships.userHighId, viewerId)),
  ));
  const contacts = new Set(relationships.map(row => row.userLowId === viewerId ? row.userHighId : row.userLowId));
  const rows = await getDb().select({ id: users.id, visibility: users.presenceVisibility })
    .from(users).where(inArray(users.id, online));
  return rows.filter(row => row.id === viewerId || row.visibility === "everyone" ||
    (row.visibility === "contacts" && contacts.has(row.id))).map(row => row.id);
}

export function emitToUsers(userIds: number[], event: RelayEvent): void {
  for (const id of userIds) {
    const set = listeners.get(id);
    if (!set) continue;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        // a broken listener must not break delivery to others
      }
    }
  }
}

export async function broadcastPresence(): Promise<void> {
  await Promise.all(onlineUserIds().map(async viewerId => {
    emitToUsers([viewerId], { type: "presence", online: await visibleOnlineUserIds(viewerId) });
  }));
}
