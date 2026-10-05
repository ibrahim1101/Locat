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
import { LogOut, MessageSquarePlus } from "lucide-react";

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
  return <ChatApp user={state.user} keys={state.keys} />;
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
  convsRef.current = conversations;

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [latest, setLatest] = useState<Map<number, LocalMessage>>(new Map());
  const [unread, setUnread] = useState<Map<number, number>>(new Map());
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const sendMut = trpc.messages.send.useMutation();
  const ackMut = trpc.messages.ack.useMutation();

  // ── per-conversation message keys (memory only, derived from device keys) ──
  const keyCache = useRef(new Map<number, Promise<CryptoKey>>());
  const keyFor = useCallback(
    (conv: ConversationSummary): Promise<CryptoKey> => {
      let p = keyCache.current.get(conv.id);
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
        keyCache.current.set(conv.id, p);
      }
      return p;
    },
    [keys.privateKey, user.id],
  );

  // ── unread bookkeeping (per-device, persisted locally) ──
  const lastReadRef = useRef<Record<string, number>>({});
  useEffect(() => {
    void (async () => {
      lastReadRef.current = (await kvGet<Record<string, number>>("lastRead")) ?? {};
      const latestMap = await latestMessagePerConversation();
      setLatest(latestMap);
      const counts = new Map<number, number>();
      for (const [convId] of latestMap) {
        const lr = lastReadRef.current[convId] ?? 0;
        const msgs = await getMessages(convId);
        const n = msgs.filter((m) => !m.outgoing && m.mid > lr).length;
        if (n > 0) counts.set(convId, n);
      }
      setUnread(counts);
    })();
  }, []);

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
  activeIdRef.current = activeId;

  const processDeliveries = useCallback(
    async (items: Delivery[]) => {
      if (items.length === 0) return;
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
          const payload = (await decryptPayload(key, item.envelope)) as MessagePayload;
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
          const inserted = await storeMessage(msg);
          acked.push(item.messageId);
          if (!inserted) continue;

          setLatest((prev) => new Map(prev).set(item.conversationId, msg));
          if (activeIdRef.current === item.conversationId) {
            // outgoing echoes already render optimistically — don't duplicate
            if (!msg.outgoing) setMessages((prev) => [...prev, msg]);
            lastReadRef.current[item.conversationId] = item.messageId;
            void kvSet("lastRead", lastReadRef.current);
          } else if (!msg.outgoing) {
            setUnread((prev) => {
              const next = new Map(prev);
              next.set(item.conversationId, (next.get(item.conversationId) ?? 0) + 1);
              return next;
            });
          }
        } catch {
          // undecryptable envelope (e.g. rotated keys) — drop it, don't ack
        }
      }
      if (acked.length > 0) ackMut.mutate({ messageIds: acked });
    },
    [keyFor, user.id, utils, ackMut],
  );

  const processRef = useRef(processDeliveries);
  processRef.current = processDeliveries;

  // realtime stream (SSE subscription)
  trpc.messages.subscribe.useSubscription(undefined, {
    onData: (event: RelayEvent) => {
      if (event.type === "presence") {
        setOnline(new Set(event.online));
      } else {
        void processRef.current([event]);
      }
    },
    onError: () => {
      void utils.messages.sync.invalidate();
    },
  });

  // offline backlog (also a periodic safety net)
  const syncQ = trpc.messages.sync.useQuery(undefined, { refetchInterval: 20000 });
  useEffect(() => {
    if (syncQ.data && syncQ.data.length > 0) void processRef.current(syncQ.data as Delivery[]);
  }, [syncQ.data]);

  // ── conversation open ──
  const openConversation = useCallback(async (id: number) => {
    setActiveId(id);
    const msgs = await getMessages(id);
    setMessages(msgs);
    const maxMid = msgs.reduce((m, x) => Math.max(m, x.mid), 0);
    lastReadRef.current[id] = Math.max(lastReadRef.current[id] ?? 0, maxMid);
    void kvSet("lastRead", lastReadRef.current);
    setUnread((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // ── sending ──
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
    setMessages((prev) => [...prev, optimistic]);
    setLatest((prev) => new Map(prev).set(conv.id, optimistic));
    try {
      const key = await keyFor(conv);
      const envelope = await encryptPayload(key, payload);
      const { messageId } = await sendMut.mutateAsync({ conversationId: conv.id, envelope });
      const stored: LocalMessage = { ...optimistic, mid: messageId };
      await storeMessage(stored);
      setMessages((prev) => prev.map((m) => (m.tempId === tempId ? stored : m)));
      setLatest((prev) => new Map(prev).set(conv.id, stored));
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, pending: false, failed: true } : m)),
      );
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
        <button
          type="button"
          onClick={() => void logout()}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {sortedConversations.length === 0 && (
          <p className="micro-label px-4 py-10 text-center normal-case leading-relaxed tracking-normal">
            No conversations yet.
            <br />
            Tap + to find people on this relay.
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
        history lives on this device · relay keeps nothing
      </p>
    </div>
  );

  return (
    <div className="flex h-dvh bg-background text-foreground">
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
              void sendPayload(activeConv, { type: "text", text }, `t${Date.now()}`)
            }
            onSendImage={(file) =>
              void (async () => {
                const payload = await imageToPayload(file);
                await sendPayload(activeConv, payload, `t${Date.now()}`);
              })()
            }
            onRetry={(tempId) => {
              const failed = messages.find((m) => m.tempId === tempId);
              if (!failed) return;
              setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
              void sendPayload(activeConv, failed.payload, `t${Date.now()}`);
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
                end-to-end encrypted · relay stores nothing
              </p>
            </div>
          </div>
        )}
      </div>

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
