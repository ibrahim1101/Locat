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

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB("relaychat", 1, {
      upgrade(d) {
        d.createObjectStore("kv");
        d.createObjectStore("identity"); // userId -> CryptoKey pair
        const msgs = d.createObjectStore("messages", { keyPath: "lid", autoIncrement: true });
        msgs.createIndex("byConv", "conversationId");
        msgs.createIndex("byMid", "mid", { unique: true });
      },
    });
  }
  return dbPromise;
}

// ─── kv ──────────────────────────────────────────────────────────────────────

export async function kvGet<T = KvValue>(key: string): Promise<T | undefined> {
  return (await (await db()).get("kv", key)) as T | undefined;
}

export async function kvSet(key: string, value: KvValue): Promise<void> {
  await (await db()).put("kv", value, key);
}

export async function kvDel(key: string): Promise<void> {
  await (await db()).delete("kv", key);
}

// ─── identity keys ───────────────────────────────────────────────────────────

export async function saveIdentity(
  userId: number,
  keys: { privateKey: CryptoKey; publicKey: CryptoKey },
): Promise<void> {
  await (await db()).put("identity", keys, userId);
}

export async function loadIdentity(
  userId: number,
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey } | undefined> {
  return (await db()).get("identity", userId);
}

// ─── messages ────────────────────────────────────────────────────────────────

/** Insert if the server message id is new. Returns true when inserted. */
export async function storeMessage(msg: LocalMessage): Promise<boolean> {
  const d = await db();
  const existing = await d.getKeyFromIndex("messages", "byMid", msg.mid);
  if (existing !== undefined) return false;
  await d.add("messages", msg);
  return true;
}

export async function getMessages(conversationId: number): Promise<LocalMessage[]> {
  const rows: LocalMessage[] = await (await db()).getAllFromIndex(
    "messages",
    "byConv",
    conversationId,
  );
  return rows.sort((a, b) => a.createdAt - b.createdAt || a.mid - b.mid);
}

export async function latestMessagePerConversation(): Promise<Map<number, LocalMessage>> {
  const all: LocalMessage[] = await (await db()).getAll("messages");
  const map = new Map<number, LocalMessage>();
  for (const m of all) {
    const cur = map.get(m.conversationId);
    if (!cur || m.mid > cur.mid) map.set(m.conversationId, m);
  }
  return map;
}

export async function wipeAll(): Promise<void> {
  const d = await db();
  await d.clear("kv");
  await d.clear("identity");
  await d.clear("messages");
}
