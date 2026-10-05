// In-memory pub/sub hub: tracks which users have an open realtime
// connection and fans out relay events (new messages, presence) to them.
// Nothing is persisted here — offline recipients are served from the
// transient DB queue on their next sync.

import type { RelayEvent } from "@contracts/types";

type Listener = (event: RelayEvent) => void;

const listeners = new Map<number, Set<Listener>>();

export function subscribe(userId: number, listener: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(listener);

  const firstConnection = set.size === 1;
  if (firstConnection) broadcastPresence();

  return () => {
    const s = listeners.get(userId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) {
      listeners.delete(userId);
      broadcastPresence();
    }
  };
}

export function onlineUserIds(): number[] {
  return [...listeners.keys()];
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

export function broadcastPresence(): void {
  const event: RelayEvent = { type: "presence", online: onlineUserIds() };
  emitToUsers(onlineUserIds(), event);
}
