import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth, type SessionUser } from "@/state/auth";
import type { ConversationSummary, MessagePayload, RelayEvent } from "@contracts/types";
import type { IdentityKeys } from "@/lib/crypto";
import {
  decryptPayload,
  deriveDirectKey,
  encryptPayload,
  imageToPayload,
  unwrapGroupKey,
} from "@/lib/crypto";
import {
  getMessages,
  migrateLegacyHistory,
  kvGet,
  kvSet,
  latestMessagePerConversation,
  storeMessage,
  type LocalMessage,
} from "@/lib/localdb";
import { listTimeLabel } from "@/lib/format";
import Login from "./Login";
import { Avatar, AvatarStack } from "@/components/chat/Avatar";
import { ChatWindow, conversationTitle, type UiMessage } from "@/components/chat/ChatWindow";
import { NewConversationDialog } from "@/components/chat/NewConversationDialog";
import { SecurityDialog } from "@/components/chat/SecurityDialog";
import { StorageDialog } from "@/components/chat/StorageDialog";
import { messagePayloadSchema } from "@/lib/archive";
import { LogOut, MessageSquarePlus, Settings } from "lucide-react";

export default function Chat() {
  const { state } = useAuth();
  if (state.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="micro-label animate-pulse">connecting…</p>
      </div>
    );
  }
  if (state.status !== "ready") return <Login />;
  return <ChatApp key={state.user.id} user={state.user} keys={state.keys} />;
}

function ChatApp({ user, keys }: { user: SessionUser; keys: IdentityKeys }) {
  const { logout } = useAuth();
  const utils = trpc.useUtils();

  const conversationsQ = trpc.conversations.list.useQuery();
  const conversations = useMemo(
    () => (conversationsQ.data ?? []) as ConversationSummary[],
    [conversationsQ.data],
  );
  const convsRef = useRef(conversations);
  useEffect(() => { convsRef.current = conversations; }, [conversations]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [latest, setLatest] = useState<Map<number, LocalMessage>>(new Map());
  const [unread, setUnread] = useState<Map<number, number>>(new Map());
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [connection, setConnection] = useState("Connecting…");
  const sendMut = trpc.messages.send.useMutation();
  const ackMut = trpc.messages.ack.useMutation();

  // ── per-conversation message keys (memory only, derived from device keys) ──
  const keyCache = useRef(new Map<number, { signature: string; key: Promise<CryptoKey> }>());
  const keyFor = useCallback(
    (conv: ConversationSummary): Promise<CryptoKey> => {
      const signature = JSON.stringify([conv.members.map((m) => [m.id, m.publicKey]), conv.wrappedKey, conv.wrappedBy]);
      const cached = keyCache.current.get(conv.id);
      let p = cached?.signature === signature ? cached.key : undefined;
      if (!p) {
        p = (async () => {
          if (conv.type === "direct") {
            const other = conv.members.find((m) => m.id !== user.id);
            if (!other) throw new Error("Missing peer");
            return deriveDirectKey(keys.privateKey, other.publicKey, user.id, other.id);
          }
          const wrapper = conv.members.find((m) => m.id === conv.wrappedBy);
          if (!wrapper || !conv.wrappedKey) throw new Error("Missing group key");
          return unwrapGroupKey(conv.wrappedKey, keys.privateKey, wrapper.publicKey);
        })();
        const key = p.catch((error: unknown) => {
          if (keyCache.current.get(conv.id)?.signature === signature) keyCache.current.delete(conv.id);
          throw error;
        });
        keyCache.current.set(conv.id, { signature, key });
        p = key;
      }
      return p;
    },
    [keys.privateKey, user.id],
  );

  // Migrate only verified memberships, then restore this account's local state.
  const lastReadRef = useRef<Record<string, number>>({});
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const failedDeliveries = useRef(new Set<number>());
  const [deliveryWarning, setDeliveryWarning] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  useEffect(() => {
    if (!conversationsQ.isSuccess) return;
    let cancelled = false;
    void (async () => {
      await migrateLegacyHistory(user.id, conversations.map((c) => c.id));
      lastReadRef.current = (await kvGet<Record<string, number>>(user.id, "lastRead")) ?? {};
      const latestMap = await latestMessagePerConversation(user.id);
      const counts = new Map<number, number>();
      for (const [convId] of latestMap) {
        const lr = lastReadRef.current[convId] ?? 0;
        const msgs = await getMessages(user.id, convId);
        const n = msgs.filter((m) => !m.outgoing && m.mid > lr).length;
        if (n > 0) counts.set(convId, n);
      }
      if (!cancelled) { setLatest(latestMap); setUnread(counts); setLocalReady(true); }
    })().catch(() => { if (!cancelled) setArchiveError("Cannot open local history. Check your browser storage settings."); });
    return () => { cancelled = true; };
  }, [user.id, conversations, conversationsQ.isSuccess, archiveRevision]);

  // ── incoming deliveries: decrypt → store locally → ack (relay deletes) ──
  type Delivery = {
    deliveryId: number;
    messageId: number;
    conversationId: number;
    senderId: number;
    senderName: string;
    envelope: string;
    createdAt: Date;
  };

  const activeIdRef = useRef<number | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const processDeliveries = useCallback(
    async (items: Delivery[]) => {
      if (items.length === 0 || !alive.current) return;
      const acked: number[] = [];
      for (const item of items) {
        try {
          let conv = convsRef.current.find((c) => c.id === item.conversationId);
          if (!conv) {
            const fresh = await utils.conversations.list.fetch();
            convsRef.current = fresh as ConversationSummary[];
            conv = convsRef.current.find((c) => c.id === item.conversationId);
          }
          if (!conv) continue;
          const key = await keyFor(conv);
          const payload = messagePayloadSchema.parse(await decryptPayload(key, item.envelope));
          const createdAt =
            item.createdAt instanceof Date ? item.createdAt.getTime() : Date.now();
          const msg: LocalMessage = {
            mid: item.messageId,
            conversationId: item.conversationId,
            senderId: item.senderId,
            senderName: item.senderName,
            outgoing: item.senderId === user.id,
            payload,
            createdAt,
          };
          const inserted = await storeMessage(user.id, msg);
          acked.push(item.messageId);
          failedDeliveries.current.delete(item.messageId);
          if (!inserted) continue;

          setLatest((prev) => new Map(prev).set(item.conversationId, msg));
          if (activeIdRef.current === item.conversationId) {
            // outgoing echoes already render optimistically — don't duplicate
            setMessages((prev) => prev.some((m) => m.mid === msg.mid) ? prev : [...prev, msg]);
            lastReadRef.current[item.conversationId] = Math.max(lastReadRef.current[item.conversationId] ?? 0, item.messageId);
            void kvSet(user.id, "lastRead", lastReadRef.current);
          } else if (!msg.outgoing) {
            setUnread((prev) => {
              const next = new Map(prev);
              next.set(item.conversationId, (next.get(item.conversationId) ?? 0) + 1);
              return next;
            });
          }
        } catch {
          // Keep the envelope queued if decryption or durable local storage fails.
          failedDeliveries.current.add(item.messageId);
        }
      }
      if (alive.current) setDeliveryWarning(failedDeliveries.current.size > 0);
      if (acked.length > 0 && alive.current) await ackMut.mutateAsync({ messageIds: acked });
    },
    [keyFor, user.id, utils, ackMut],
  );

  const processRef = useRef(processDeliveries);
  useEffect(() => { processRef.current = processDeliveries; }, [processDeliveries]);

  // Serialize SSE and polling so each delivery is archived before acknowledgement.
  const deliveryQueue = useRef(Promise.resolve());
  const enqueue = useCallback((items: Delivery[]) => {
    const task = deliveryQueue.current.catch(() => {}).then(() => processRef.current(items));
    deliveryQueue.current = task;
    return task;
  }, []);
  const reconnectRef = useRef<() => void>(() => {});
  trpc.messages.subscribe.useSubscription(undefined, {
    enabled: localReady,
    onData: (event: RelayEvent) => {
      if (event.type === "presence") {
        setOnline(new Set(event.online));
        setConnection("Connected");
        reconnectRef.current();
      } else {
        void enqueue([event]).catch(() => setConnection("Retrying delivery…"));
      }
    },
    onError: () => { setConnection("Reconnecting…"); reconnectRef.current(); },
  });

  useEffect(() => {
    if (!localReady) return;
    let stopped = false;
    let running = false;
    let cursor = 0;
    const sync = async () => {
      if (running || stopped) return;
      if (!navigator.onLine) { setConnection("Offline · history stays on this device"); return; }
      running = true;
      try {
        // Cursor advances past undecryptable envelopes; retry from zero next sweep.
        for (let pages = 0; pages < 20 && !stopped; pages++) {
          const page = await utils.messages.sync.fetch({ after: cursor });
          if (stopped) return;
          await enqueue(page.items);
          cursor = page.nextCursor ?? 0;
          if (page.nextCursor === null) break;
        }
        if (!stopped) setConnection("Connected");
      } catch { if (!stopped) setConnection("Reconnecting…"); }
      finally { running = false; }
    };
    const refresh = () => { void sync(); };
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    const offline = () => setConnection("Offline · history stays on this device");
    reconnectRef.current = refresh;
    refresh();
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      reconnectRef.current = () => {};
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [localReady, utils, enqueue]);

  // ── conversation open ──
  const openConversation = useCallback(async (id: number) => {
    setActiveId(id);
    activeIdRef.current = id;
    setMessages([]);
    const msgs = await getMessages(user.id, id);
    if (activeIdRef.current !== id || !alive.current) return;
    setMessages(msgs);
    const maxMid = msgs.reduce((m, x) => Math.max(m, x.mid), 0);
    lastReadRef.current[id] = Math.max(lastReadRef.current[id] ?? 0, maxMid);
    void kvSet(user.id, "lastRead", lastReadRef.current);
    setUnread((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [user.id]);

  // ── sending ──
  const outgoingEnvelopes = useRef(new Map<string, string>());
  async function sendPayload(conv: ConversationSummary, payload: MessagePayload, tempId: string) {
    const optimistic: UiMessage = {
      mid: -Date.now(),
      conversationId: conv.id,
      senderId: user.id,
      senderName: user.displayName,
      outgoing: true,
      payload,
      createdAt: Date.now(),
      pending: true,
      tempId,
    };
    if (activeIdRef.current === conv.id) setMessages((prev) => [...prev, optimistic]);
    setLatest((prev) => new Map(prev).set(conv.id, optimistic));
    try {
      messagePayloadSchema.parse(payload);
      const key = await keyFor(conv);
      const envelope = outgoingEnvelopes.current.get(tempId) ?? await encryptPayload(key, payload);
      outgoingEnvelopes.current.set(tempId, envelope);
      const { messageId, createdAt } = await sendMut.mutateAsync({ conversationId: conv.id, envelope, clientMessageId: tempId });
      const stored: LocalMessage = {
        mid: messageId, conversationId: conv.id, senderId: user.id,
        senderName: user.displayName, outgoing: true, payload,
        createdAt: createdAt.getTime(),
      };
      await storeMessage(user.id, stored);
      outgoingEnvelopes.current.delete(tempId);
      if (activeIdRef.current === conv.id) setMessages((prev) => [...prev.filter((m) => m.tempId !== tempId && m.mid !== messageId), stored].sort((a, b) => a.createdAt - b.createdAt || a.mid - b.mid));
      setLatest((prev) => new Map(prev).set(conv.id, stored));
    } catch {
      const failed = { ...optimistic, pending: false, failed: true };
      if (activeIdRef.current === conv.id) setMessages((prev) => prev.map((m) => m.tempId === tempId ? failed : m));
      setLatest((prev) => prev.get(conv.id)?.mid === optimistic.mid ? new Map(prev).set(conv.id, failed) : prev);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const la = latest.get(a.id);
      const lb = latest.get(b.id);
      return (lb?.createdAt ?? new Date(b.createdAt).getTime()) -
        (la?.createdAt ?? new Date(a.createdAt).getTime());
    });
  }, [conversations, latest]);

  // ── layout ──
  const sidebar = (
    <div className="flex h-full flex-col border-r bg-[hsl(var(--sidebar-background))]">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-4 pt-safe">
        <Avatar name={user.displayName} id={user.id} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="micro-label normal-case tracking-normal">@{user.username}</p>
        </div>
        <button
          type="button"
          onClick={() => setNewConvOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground"
          aria-label="New conversation"
          title="New conversation"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setStorageOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground"
          aria-label="History and backups"><Settings className="h-5 w-5" /></button>
        <button
          type="button"
          onClick={() => void logout().catch(() => setArchiveError("Sign out failed. Check your connection and try again."))}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {deliveryWarning && <p role="status" className="border-b px-4 py-3 text-xs text-destructive">
        Some messages could not be unlocked or saved. They remain queued; check your keys and available storage.
      </p>}
      {conversationsQ.isError && <p role="alert" className="border-b px-4 py-3 text-xs text-destructive">
        Cannot load conversations. Check your connection.
      </p>}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {sortedConversations.length === 0 && (
          <p className="micro-label px-4 py-10 text-center normal-case leading-relaxed tracking-normal">
            No conversations yet.
            <br />
            Tap + to find people on Locat.
          </p>
        )}
        {sortedConversations.map((c) => {
          const { title } = conversationTitle(c, user.id);
          const last = latest.get(c.id);
          const n = unread.get(c.id) ?? 0;
          const otherId =
            c.type === "direct" ? c.members.find((m) => m.id !== user.id)?.id : undefined;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => void openConversation(c.id)}
              className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                activeId === c.id ? "bg-accent" : ""
              }`}
            >
              {c.type === "direct" ? (
                <Avatar
                  name={title}
                  id={otherId ?? 0}
                  size={42}
                  online={otherId ? online.has(otherId) : undefined}
                />
              ) : (
                <AvatarStack members={c.members} size={42} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{title}</span>
                  {last && (
                    <span className="micro-label shrink-0">{listTimeLabel(last.createdAt)}</span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-secondary">
                    {last
                      ? last.payload.type === "image"
                        ? "🖼 image"
                        : (last.outgoing ? "you: " : "") + last.payload.text
                      : c.type === "group"
                        ? `${c.members.length} members`
                        : "say hello"}
                  </span>
                  {n > 0 && (
                    <span className="badge-pop flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {n}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="micro-label shrink-0 border-t px-4 py-3 pb-safe normal-case tracking-normal">
        Locat · {connection}
      </p>
    </div>
  );

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {archiveError && <div role="alert" className="fixed left-4 right-4 top-4 z-50 rounded-lg border bg-card p-4 text-sm text-destructive">
        {archiveError}<button className="ml-3 underline" onClick={() => setArchiveError(null)}>Dismiss</button>
      </div>}
      {/* sidebar: full-screen on mobile, fixed column on desktop */}
      <div className={`${activeId ? "hidden" : "flex"} w-full md:flex md:w-80 md:shrink-0 lg:w-96`}>
        {sidebar}
      </div>

      {/* main pane */}
      <div className={`${activeId ? "flex" : "hidden"} min-w-0 flex-1 md:flex`}>
        {activeConv ? (
          <ChatWindow
            conversation={activeConv}
            messages={messages}
            myId={user.id}
            online={online}
            onBack={() => setActiveId(null)}
            onSendText={(text) =>
              void sendPayload(activeConv, { type: "text", text }, crypto.randomUUID())
            }
            onSendImage={(file) =>
              void (async () => {
                const payload = await imageToPayload(file);
                await sendPayload(activeConv, payload, crypto.randomUUID());
              })().catch(() => setArchiveError("Could not prepare this image. Try a smaller image or a different format."))
            }
            onRetry={(tempId) => {
              const failed = messages.find((m) => m.tempId === tempId);
              if (!failed) return;
              setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
              void sendPayload(activeConv, failed.payload, tempId);
            }}
            onShowSecurity={() => setSecurityOpen(true)}
          />
        ) : (
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border surface-2">
                <span className="font-mono-ui text-lg text-primary">↔</span>
              </div>
              <p className="text-sm font-medium">Pick a conversation</p>
              <p className="micro-label mt-2 normal-case tracking-normal">
                end-to-end encrypted · saved on your device
              </p>
            </div>
          </div>
        )}
      </div>

      <StorageDialog user={user} open={storageOpen} onOpenChange={setStorageOpen} onImported={() => {
        setArchiveRevision((n) => n + 1);
        if (activeId !== null) void openConversation(activeId);
      }} />
      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onCreated={(id) => void openConversation(id)}
      />
      <SecurityDialog
        conversation={activeConv}
        open={securityOpen}
        onOpenChange={setSecurityOpen}
      />
    </div>
  );
}
