// ─── On-device storage (IndexedDB) ──────────────────────────────────────────
// This is where chat history and identity keys actually live — the server
// only relays. Clearing site data wipes the local archive (by design).
import { openDB, type IDBPDatabase } from "idb";
import type { MessagePayload } from "@contracts/types";

export type LocalMessage = {
  lid?: number; // local autoincrement id
  mid: number; // server message id (globally unique) — dedupe key
  conversationId: number;
  senderId: number;
  senderName: string;
  outgoing: boolean;
  payload: MessagePayload;
  createdAt: number; // epoch ms
};

type KvValue = string | number | Record<string, unknown>;

const databases = new Map<number, Promise<IDBPDatabase>>();

async function legacyDb(): Promise<IDBPDatabase | undefined> {
  try {
    return await openDB("relaychat", undefined, {
      upgrade(_db, oldVersion, _newVersion, tx) {
        // Looking for old data must not create a new empty legacy database.
        if (oldVersion === 0) tx.abort();
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return undefined;
    throw error;
  }
}

function db(userId: number): Promise<IDBPDatabase> {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid account");
  let promise = databases.get(userId);
  if (!promise) {
    promise = openDB(`locat-account-${userId}`, 1, {
      upgrade(d) {
        d.createObjectStore("kv");
        d.createObjectStore("identity");
        const msgs = d.createObjectStore("messages", { keyPath: "lid", autoIncrement: true });
        msgs.createIndex("byConv", "conversationId");
        msgs.createIndex("byMid", "mid", { unique: true });
      },
    });
    databases.set(userId, promise);
  }
  return promise;
}

// ─── kv ──────────────────────────────────────────────────────────────────────

export async function kvGet<T = KvValue>(userId: number, key: string): Promise<T | undefined> {
  return (await (await db(userId)).get("kv", key)) as T | undefined;
}

export async function kvSet(userId: number, key: string, value: KvValue): Promise<void> {
  await (await db(userId)).put("kv", value, key);
}

export async function kvDel(userId: number, key: string): Promise<void> {
  await (await db(userId)).delete("kv", key);
}

// ─── identity keys ───────────────────────────────────────────────────────────

export async function saveIdentity(
  userId: number,
  keys: { privateKey: CryptoKey; publicKey: CryptoKey },
): Promise<void> {
  await (await db(userId)).put("identity", keys, userId);
}

export async function loadIdentity(
  userId: number,
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey } | undefined> {
  const current = await (await db(userId)).get("identity", userId);
  if (current) return current;
  // Existing identity is unambiguous because the old store was keyed by account.
  const legacy = await legacyDb();
  if (!legacy) return undefined;
  try {
    if (!legacy.objectStoreNames.contains("identity")) return undefined;
    const keys = await legacy.get("identity", userId);
    if (keys) await saveIdentity(userId, keys);
    return keys;
  } finally { legacy.close(); }

}

// ─── messages ────────────────────────────────────────────────────────────────

/** Insert if the server message id is new. Returns true when inserted. */
export async function storeMessage(userId: number, msg: LocalMessage): Promise<boolean> {
  const d = await db(userId);
  const tx = d.transaction("messages", "readwrite");
  const existing = await tx.store.index("byMid").getKey(msg.mid);
  if (existing !== undefined) {
    await tx.done;
    return false;
  }
  await tx.store.add(msg);
  await tx.done;
  return true;
}

export async function getMessages(userId: number, conversationId: number): Promise<LocalMessage[]> {
  const rows: LocalMessage[] = await (await db(userId)).getAllFromIndex(
    "messages",
    "byConv",
    conversationId,
  );
  return rows.sort((a, b) => a.createdAt - b.createdAt || a.mid - b.mid);
}

export async function latestMessagePerConversation(userId: number): Promise<Map<number, LocalMessage>> {
  const all: LocalMessage[] = await (await db(userId)).getAll("messages");
  const map = new Map<number, LocalMessage>();
  for (const m of all) {
    const cur = map.get(m.conversationId);
    if (!cur || m.mid > cur.mid) map.set(m.conversationId, m);
  }
  return map;
}

export async function wipeAll(userId: number): Promise<void> {
  const d = await db(userId);
  await d.clear("kv");
  await d.clear("identity");
  await d.clear("messages");
}

/** Copy only histories whose membership has been verified against the server. */
export async function migrateLegacyHistory(userId: number, conversationIds: number[]): Promise<void> {
  if (await kvGet(userId, "legacyMigrated")) return;
  const legacy = await legacyDb();
  if (!legacy) { await kvSet(userId, "legacyMigrated", 1); return; }
  try {
    if (legacy.objectStoreNames.contains("messages")) {
      const allowed = new Set(conversationIds);
      const rows: LocalMessage[] = await legacy.getAll("messages");
      for (const row of rows) {
        if (allowed.has(row.conversationId)) {
          await storeMessage(userId, { mid: row.mid, conversationId: row.conversationId,
            senderId: row.senderId, senderName: row.senderName,
            outgoing: row.senderId === userId, payload: row.payload, createdAt: row.createdAt });
        }
      }
    }
    await kvSet(userId, "legacyMigrated", 1);
  } finally { legacy.close(); }
}

export async function allMessages(userId: number): Promise<LocalMessage[]> {
  return (await db(userId)).getAll("messages");
}

/** Atomic merge: duplicates are skipped; existing history is never overwritten. */
export async function importMessages(userId: number, messages: LocalMessage[]): Promise<number> {
  const tx = (await db(userId)).transaction("messages", "readwrite");
  let count = 0;
  for (const message of messages) {
    if (await tx.store.index("byMid").getKey(message.mid) !== undefined) continue;
    await tx.store.add(message);
    count++;
  }
  await tx.done;
  return count;
}
