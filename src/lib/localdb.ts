// ─── On-device storage (IndexedDB) ──────────────────────────────────────────
// This is where chat history and identity keys actually live — the server
// only relays. Clearing site data wipes the local archive (by design).
import { openDB, type IDBPDatabase } from "idb";
import { localAccountDatabaseName, nativeLocalStorageOrigin } from "./localStorageScope";
import type { ConversationSummary, MessagePayload } from "@contracts/types";
import { projectPin } from "./messagePins";
import type { PinState } from "@contracts/messagePayload";
import { mergeReactions, type ReactionState } from "./messageReactions";
import type { MessageControl } from "@contracts/messagePayload";

export type LocalMessage = {
  lid?: number; // local autoincrement id
  mid: number; // server message id (globally unique) — dedupe key
  conversationId: number;
  senderId: number;
  senderName: string;
  outgoing: boolean;
  payload: MessagePayload;
  createdAt: number; // epoch ms
  deleted?: boolean;
  editedAt?: number;
  readBy?: number[];
  reactions?: ReactionState;
  pin?: PinState;
  hidden?: boolean; // Derived device-only view state, excluded from archives.
};

type KvValue = string | number | Record<string, unknown>;

const databases = new Map<string, Promise<IDBPDatabase>>();

async function legacyDb(): Promise<IDBPDatabase | undefined> {
  // Unscoped native archives have no trustworthy server ownership metadata.
  // Preserve them untouched; never infer ownership from colliding numeric IDs.
  if (nativeLocalStorageOrigin() !== null) return undefined;
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
  const name = localAccountDatabaseName(userId);
  let promise = databases.get(name);
  if (!promise) {
    promise = openDB(name, 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 2) d.createObjectStore("outbox", { keyPath: "clientMessageId" });
        if (oldVersion >= 1) return;
        d.createObjectStore("kv");
        d.createObjectStore("identity");
        const msgs = d.createObjectStore("messages", { keyPath: "lid", autoIncrement: true });
        msgs.createIndex("byConv", "conversationId");
        msgs.createIndex("byMid", "mid", { unique: true });
      },
    });
    databases.set(name, promise);
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

export async function hiddenConversationIds(userId: number): Promise<number[]> {
  const keys = await (await db(userId)).getAllKeys("kv");
  return keys.filter(key => typeof key === "string" && /^hidden-chat:[1-9]\d*$/.test(key))
    .map(key => Number(String(key).slice("hidden-chat:".length))).filter(Number.isSafeInteger);
}

export async function setConversationHidden(userId: number, conversationId: number, hidden: boolean): Promise<void> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) throw new Error("Invalid conversation");
  const key = `hidden-chat:${conversationId}`;
  if (hidden) await kvSet(userId, key, 1);
  else await kvDel(userId, key);
}

export async function setMessageHidden(userId: number, mid: number, hidden: boolean): Promise<void> {
  if (!Number.isSafeInteger(mid) || mid <= 0) throw new Error("Invalid message");
  const key = `hidden-message:${mid}`;
  if (hidden) await kvSet(userId, key, 1);
  else await kvDel(userId, key);
}

/** Atomically bound a metadata namespace without introducing a new store. */
export async function putBoundedKv(userId: number, key: string, prefix: string, value: Record<string, unknown>, limit: number): Promise<void> {
  if (!key.startsWith(prefix) || !Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid local namespace");
  const tx = (await db(userId)).transaction("kv", "readwrite");
  if (await tx.store.get(key) === undefined) {
    const keys = await tx.store.getAllKeys();
    if (keys.filter(k => typeof k === "string" && k.startsWith(prefix)).length >= limit) {
      tx.abort(); await tx.done.catch(() => undefined); throw new Error("Local scheduled-copy limit reached");
    }
  }
  await tx.store.put(value, key); await tx.done;
}
export async function kvKeys(userId: number): Promise<IDBValidKey[]> { return (await db(userId)).getAllKeys("kv"); }

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

// ─── Locat Link device keys (M2) ─────────────────────────────────────────────
// Device identity keypair lives in the account-scoped IndexedDB (structured
// clone stores CryptoKey objects directly; private key never leaves the device).
export async function saveDeviceKeys(userId: number, keys: { privateKey: CryptoKey; publicKey: CryptoKey }): Promise<void> {
  await (await db(userId)).put("identity", keys, "link-device");
}
export async function loadDeviceKeys(userId: number): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey } | undefined> {
  return (await db(userId)).get("identity", "link-device");
}

// ─── messages ────────────────────────────────────────────────────────────────

export function messageReference(message: LocalMessage): string {
  return message.payload.messageRef ?? `legacy:${message.mid}`;
}
const reactionKey = (conversationId: number, ownerId: number, target: string) =>
  `reaction:${conversationId}:${ownerId}:${target}`;
function projectReactions(message: LocalMessage, state?: ReactionState): LocalMessage {
  if (!state && !message.reactions) return message;
  return { ...message, reactions: mergeReactions(message.reactions, state) };
}
/** Other conversation members may react; the relay authenticates their actor ID. */
async function applyReaction(userId: number, conversationId: number, actorId: number,
  control: Extract<MessageControl, { action: "reaction" }>, mid: number, pendingId?: string) {
  const tx = (await db(userId)).transaction(["messages", "kv", "outbox"], "readwrite");
  const kv = tx.objectStore("kv"), messages = tx.objectStore("messages");
  const key = reactionKey(conversationId, control.targetSenderId, control.target);
  let state: ReactionState = await kv.get(key) ?? {};
  const rows: LocalMessage[] = await messages.index("byConv").getAll(conversationId);
  const targets = rows.filter(row => row.senderId === control.targetSenderId && messageReference(row) === control.target);
  for (const row of targets) state = mergeReactions(state, row.reactions);
  state = mergeReactions(state, { [actorId]: { emoji: control.emoji, mid } });
  await kv.put(state, key);
  for (const row of targets) await messages.put(projectReactions(row, state));
  if (pendingId) await tx.objectStore("outbox").delete(pendingId);
  await tx.done;
}

const pinKey = (conversationId: number, ownerId: number, target: string) => `pin:${conversationId}:${ownerId}:${target}`;
async function applyPin(userId: number, conversationId: number, actorId: number,
  control: Extract<MessageControl, { action: "pin" }>, mid: number, pendingId?: string) {
  const tx = (await db(userId)).transaction(["messages", "kv", "outbox"], "readwrite");
  const kv = tx.objectStore("kv"), messages = tx.objectStore("messages");
  const key = pinKey(conversationId, control.targetSenderId, control.target);
  let state: PinState = { pinned: control.pinned, actorId, mid };
  const previous: PinState | undefined = await kv.get(key);
  if (previous && previous.mid >= state.mid) state = previous;
  const rows: LocalMessage[] = await messages.index("byConv").getAll(conversationId);
  const targets = rows.filter(row => row.senderId === control.targetSenderId && messageReference(row) === control.target);
  for (const row of targets) if (row.pin && row.pin.mid >= state.mid) state = row.pin;
  await kv.put(state, key);
  for (const row of targets) await messages.put(projectPin(row, state));
  if (pendingId) await tx.objectStore("outbox").delete(pendingId);
  await tx.done;
}

type ControlState = { control: MessageControl; mid: number; at: number };
const controlKey = (conversationId: number, senderId: number, target: string) =>
  `control:${conversationId}:${senderId}:${target}`;
function projectControl(message: LocalMessage, state?: ControlState): LocalMessage {
  if (!state || message.deleted) return message;
  if (state.control.action === "delete") return { ...message, deleted: true,
    payload: { type: "text", text: "Message deleted", messageRef: message.payload.messageRef } };
  if (state.control.action !== "edit") return message;
  if (message.payload.type !== "text") return message;
  return { ...message, payload: { ...message.payload, text: state.control.text }, editedAt: state.at };
}
/** Relay-authenticated sender scopes authorization; group-key possession is insufficient.
 * Persist one latest state per target before ACK, including out-of-order controls.
 */
export async function applyMessageControl(userId: number, conversationId: number, senderId: number,
  control: MessageControl, mid: number, at: number, pendingId?: string): Promise<void> {
  if (control.action === "pin") return applyPin(userId, conversationId, senderId, control, mid, pendingId);
  if (control.action === "reaction") return applyReaction(userId, conversationId, senderId, control, mid, pendingId);
  const tx = (await db(userId)).transaction(["messages", "kv", "outbox"], "readwrite");
  const key = controlKey(conversationId, senderId, control.target);
  const previous: ControlState | undefined = await tx.objectStore("kv").get(key);
  if (!previous || (previous.control.action !== "delete" && (control.action === "delete" || mid > previous.mid))) {
    const state = { control, mid, at };
    await tx.objectStore("kv").put(state, key);
    const rows: LocalMessage[] = await tx.objectStore("messages").index("byConv").getAll(conversationId);
    for (const row of rows) if (row.senderId === senderId && messageReference(row) === control.target)
      await tx.objectStore("messages").put(projectControl(row, state));
  }
  if (pendingId) await tx.objectStore("outbox").delete(pendingId);
  await tx.done;
}

/** Record a relay-authenticated member's encrypted read receipt. */
export async function applyReadReceipt(userId: number, conversationId: number, readerId: number,
  target: string, pendingId?: string): Promise<void> {
  const tx = (await db(userId)).transaction(["messages", "outbox"], "readwrite");
  const rows: LocalMessage[] = await tx.objectStore("messages").index("byConv").getAll(conversationId);
  for (const row of rows) {
    if (messageReference(row) !== target || row.senderId !== userId) continue;
    const readBy = [...new Set([...(row.readBy ?? []), readerId])];
    await tx.objectStore("messages").put({ ...row, readBy });
  }
  if (pendingId) await tx.objectStore("outbox").delete(pendingId);
  await tx.done;
}

/** Insert if the server message id is new. Returns true when inserted. */
export async function storeMessage(userId: number, msg: LocalMessage): Promise<boolean> {
  const d = await db(userId);
  const tx = d.transaction(["messages", "kv"], "readwrite");
  const messages = tx.objectStore("messages");
  const existing = await messages.index("byMid").getKey(msg.mid);
  if (existing !== undefined) {
    await tx.done;
    return false;
  }
  const state = await tx.objectStore("kv").get(controlKey(msg.conversationId, msg.senderId, messageReference(msg)));
  const reactions = await tx.objectStore("kv").get(reactionKey(msg.conversationId, msg.senderId, messageReference(msg)));
  const pin = await tx.objectStore("kv").get(pinKey(msg.conversationId, msg.senderId, messageReference(msg)));
  await messages.add(projectPin(projectReactions(projectControl(msg, state), reactions), pin));
  await tx.done;
  return true;
}

export async function getMessages(userId: number, conversationId: number): Promise<LocalMessage[]> {
  const rows: LocalMessage[] = await (await db(userId)).getAllFromIndex(
    "messages",
    "byConv",
    conversationId,
  );
  const keys = new Set(await (await db(userId)).getAllKeys("kv"));
  return rows.map(row => keys.has(`hidden-message:${row.mid}`) ? { ...row, hidden: true } : row)
    .sort((a, b) => a.createdAt - b.createdAt || a.mid - b.mid);
}

export async function latestMessagePerConversation(userId: number): Promise<Map<number, LocalMessage>> {
  const all: LocalMessage[] = await (await db(userId)).getAll("messages");
  const keys = new Set(await (await db(userId)).getAllKeys("kv"));
  const map = new Map<number, LocalMessage>();
  for (const m of all) {
    if (keys.has(`hidden-message:${m.mid}`)) continue;
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
  await d.clear("outbox");
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
  const tx = (await db(userId)).transaction(["messages", "kv"], "readwrite");
  const messagesStore = tx.objectStore("messages");
  let count = 0;
  for (const message of messages) {
    if (await messagesStore.index("byMid").getKey(message.mid) !== undefined) continue;
    const state = await tx.objectStore("kv").get(controlKey(message.conversationId, message.senderId, messageReference(message)));
    const reactions = await tx.objectStore("kv").get(reactionKey(message.conversationId, message.senderId, messageReference(message)));
    const pin = await tx.objectStore("kv").get(pinKey(message.conversationId, message.senderId, messageReference(message)));
    await messagesStore.add(projectPin(projectReactions(projectControl(message, state), reactions), pin));
    count++;
  }
  await tx.done;
  return count;
}


export type PendingMessage = {
  control?: MessageControl;
  clientMessageId: string;
  conversationId: number;
  senderId: number;
  senderName: string;
  payload: MessagePayload;
  envelope: string;
  createdAt: number;
};
export async function savePending(userId: number, message: PendingMessage): Promise<void> {
  await (await db(userId)).put("outbox", message);
}
export async function pendingMessages(userId: number): Promise<PendingMessage[]> {
  const rows: PendingMessage[] = await (await db(userId)).getAll("outbox");
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}
export async function completePending(userId: number, clientMessageId: string, message: LocalMessage): Promise<void> {
  const tx = (await db(userId)).transaction(["messages", "outbox", "kv"], "readwrite");
  const messages = tx.objectStore("messages");
  if (await messages.index("byMid").getKey(message.mid) === undefined) {
    const state = await tx.objectStore("kv").get(controlKey(message.conversationId, message.senderId, messageReference(message)));
    const reactions = await tx.objectStore("kv").get(reactionKey(message.conversationId, message.senderId, messageReference(message)));
    const pin = await tx.objectStore("kv").get(pinKey(message.conversationId, message.senderId, messageReference(message)));
    await messages.add(projectPin(projectReactions(projectControl(message, state), reactions), pin));
  }
  await tx.objectStore("outbox").delete(clientMessageId);
  await tx.done;
}
export async function cacheConversations(userId: number, conversations: ConversationSummary[]): Promise<void> {
  // Structured cloning preserves dates and keeps account metadata scoped locally.
  const previous: ConversationSummary[] = await cachedConversations(userId);
  const ids=new Set(conversations.map(c=>c.id));
  const merged=[...conversations.map(c=>({...c,archived:false})),...previous.filter(c=>!ids.has(c.id)).map(c=>({...c,archived:true}))];
  await (await db(userId)).put("kv", merged, "conversations");
}
export async function cachedConversations(userId: number): Promise<ConversationSummary[]> {
  return await (await db(userId)).get("kv", "conversations") ?? [];
}
export async function deleteLocalMessage(userId: number, mid: number): Promise<void> {
  const tx = (await db(userId)).transaction("messages", "readwrite");
  const key = await tx.store.index("byMid").getKey(mid);
  if (key !== undefined) await tx.store.delete(key);
  await tx.done;
}
