import packageInfo from "../../package.json";

declare const __LOCAT_BUILD_ID__: string;
import { relayPayloadSchema, type MessageControl } from "@contracts/messagePayload";
import { userCode } from "@contracts/userCode";
import { Link } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { isNativeShell } from "@/lib/native";
import { useAuth, type SessionUser } from "@/state/auth";
import type {
  ConversationSummary,
  MessagePayload,
  RelayEvent,
} from "@contracts/types";
import type { IdentityKeys } from "@/lib/crypto";
import {
  decryptPayload,
  deriveDirectKey,
  encryptPayload,
  imageToPayload,
  fileToPayload,
  voiceToPayload,
  unwrapGroupKey,
} from "@/lib/crypto";
import {
  getMessages,
  applyMessageControl,
  applyReadReceipt,
  messageReference,
  deleteLocalMessage,
  cachedConversations,
  cacheConversations,
  pendingMessages,
  savePending,
  completePending,
  type PendingMessage,
  migrateLegacyHistory,
  kvGet,
  kvSet,
  hiddenConversationIds,
  setConversationHidden,
  setMessageHidden,
  latestMessagePerConversation,
  storeMessage,
  type LocalMessage,
} from "@/lib/localdb";
import { listTimeLabel } from "@/lib/format";
import Login from "./Login";
import { Avatar, AvatarStack } from "@/components/chat/Avatar";
import {
  ChatWindow,
  conversationTitle,
  type UiMessage,
} from "@/components/chat/ChatWindow";
import { NewConversationDialog } from "@/components/chat/NewConversationDialog";
import { SecurityDialog } from "@/components/chat/SecurityDialog";
import { GroupDialog } from "@/components/chat/GroupDialog";
import { ProfileDialog } from "@/components/chat/ProfileDialog";
import { StorageDialog } from "@/components/chat/StorageDialog";
import { messagePayloadSchema } from "@/lib/archive";
import { LogOut, MessageSquarePlus, Settings, Menu, MessageCircle, Search, UserRound, HardDrive, X } from "lucide-react";

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

  const [cached, setCached] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenReady, setHiddenReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void hiddenConversationIds(user.id).then(ids => {
      if (!cancelled) { setHiddenIds(new Set(ids)); setHiddenReady(true); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user.id]);
  const conversationsQ = trpc.conversations.list.useQuery();
  const conversations = useMemo(
    () =>
      (conversationsQ.data
        ? [
            ...conversationsQ.data.map(c => ({ ...c, archived: false })),
            ...cached
              .filter(c => !conversationsQ.data.some(row => row.id === c.id))
              .map(c => ({ ...c, archived: true })),
          ]
        : cached) as ConversationSummary[],
    [conversationsQ.data, cached]
  );
  useEffect(() => {
    void cachedConversations(user.id)
      .then(setCached)
      .catch(() => {});
  }, [user.id]);
  useEffect(() => {
    if (conversationsQ.data)
      void cacheConversations(user.id, conversationsQ.data)
        .then(() => cachedConversations(user.id))
        .then(setCached)
        .catch(() => {});
  }, [user.id, conversationsQ.data]);
  const convsRef = useRef(conversations);
  useEffect(() => {
    convsRef.current = conversations;
  }, [conversations]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [latest, setLatest] = useState<Map<number, LocalMessage>>(new Map());
  const [unread, setUnread] = useState<Map<number, number>>(new Map());
  const [online, setOnline] = useState<Set<number>>(new Set());
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [connection, setConnection] = useState("Connecting…");
  const sendMut = trpc.messages.send.useMutation();
  const ackMut = trpc.messages.ack.useMutation();
  const blockedQ = trpc.users.blocked.useQuery();
  const blockMut = trpc.users.block.useMutation();
  const unblockMut = trpc.users.unblock.useMutation();
  const blockedIds = useMemo(() => new Set(blockedQ.data?.map(row => row.id) ?? []), [blockedQ.data]);

  // ── per-conversation message keys (memory only, derived from device keys) ──
  const keyCache = useRef(
    new Map<string, { signature: string; key: Promise<CryptoKey> }>()
  );
  const keyFor = useCallback(
    (
      conv: ConversationSummary,
      epoch = conv.groupEpoch ?? 1
    ): Promise<CryptoKey> => {
      const cacheId = `${conv.id}:${epoch}`;
      const signature = JSON.stringify([
        conv.members.map(m => [m.id, m.publicKey]),
        conv.wrappedKey,
        conv.wrappedBy,
        conv.wrapperPublicKey,
        conv.groupEpoch,
      ]);
      const cached = keyCache.current.get(cacheId);
      let p = cached?.signature === signature ? cached.key : undefined;
      if (!p) {
        p = (async () => {
          for (const member of conv.members.filter(m => m.id !== user.id)) {
            const pin = await kvGet<string>(
              user.id,
              `contact-key-${member.id}`
            );
            if (pin && pin !== member.publicKey)
              throw new Error(
                "Contact encryption key changed. Verify it in Encryption details before continuing."
              );
            if (!pin)
              await kvSet(
                user.id,
                `contact-key-${member.id}`,
                member.publicKey
              );
          }
          if (conv.type === "direct") {
            const other = conv.members.find(m => m.id !== user.id);
            if (!other) throw new Error("Missing peer");
            return deriveDirectKey(
              keys.privateKey,
              other.publicKey,
              user.id,
              other.id
            );
          }
          if (epoch !== (conv.groupEpoch ?? 1)) {
            const historical = await utils.conversations.groupKey.fetch({
              conversationId: conv.id,
              epoch,
            });
            return unwrapGroupKey(
              historical.wrappedKey,
              keys.privateKey,
              historical.wrapperPublicKey
            );
          }
          const wrapper = conv.members.find(m => m.id === conv.wrappedBy);
          const publicKey = conv.wrapperPublicKey ?? wrapper?.publicKey;
          if (!publicKey || !conv.wrappedKey)
            throw new Error("Missing group key");
          return unwrapGroupKey(conv.wrappedKey, keys.privateKey, publicKey);
        })();
        const key = p.catch((error: unknown) => {
          if (keyCache.current.get(cacheId)?.signature === signature)
            keyCache.current.delete(cacheId);
          throw error;
        });
        keyCache.current.set(cacheId, { signature, key });
        p = key;
      }
      return p;
    },
    [keys.privateKey, user.id, utils]
  );

  // Migrate only verified memberships, then restore this account's local state.
  const lastReadRef = useRef<Record<string, number>>({});
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const failedDeliveries = useRef(new Set<number>());
  const [deliveryWarning, setDeliveryWarning] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  useEffect(() => {
    if (!conversationsQ.isSuccess && cached.length === 0) return;
    let cancelled = false;
    void (async () => {
      if (conversationsQ.isSuccess)
        await migrateLegacyHistory(
          user.id,
          conversations.map(c => c.id)
        );
      lastReadRef.current =
        (await kvGet<Record<string, number>>(user.id, "lastRead")) ?? {};
      const latestMap = await latestMessagePerConversation(user.id);
      for (const pending of await pendingMessages(user.id)) {
        if (pending.control) continue;
        if (
          (latestMap.get(pending.conversationId)?.createdAt ?? 0) <=
          pending.createdAt
        )
          latestMap.set(pending.conversationId, pendingUi(pending));
      }
      const counts = new Map<number, number>();
      for (const [convId] of latestMap) {
        const lr = lastReadRef.current[convId] ?? 0;
        const msgs = await getMessages(user.id, convId);
        const n = msgs.filter(m => !m.outgoing && m.mid > lr).length;
        if (n > 0) counts.set(convId, n);
      }
      if (!cancelled) {
        setLatest(latestMap);
        setUnread(counts);
        setLocalReady(true);
      }
    })().catch(() => {
      if (!cancelled)
        setArchiveError(
          "Cannot open local history. Check your browser storage settings."
        );
    });
    return () => {
      cancelled = true;
    };
  }, [
    user.id,
    conversations,
    conversationsQ.isSuccess,
    cached.length,
    archiveRevision,
  ]);

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
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const processDeliveries = useCallback(
    async (items: Delivery[]) => {
      if (items.length === 0 || !alive.current) return;
      const acked: number[] = [];
      for (const item of items) {
        try {
          let conv = convsRef.current.find(c => c.id === item.conversationId);
          if (!conv) {
            const fresh = await utils.conversations.list.fetch();
            convsRef.current = fresh as ConversationSummary[];
            conv = convsRef.current.find(c => c.id === item.conversationId);
          }
          if (!conv) continue;
          const epoch =
            conv.type === "group"
              ? (JSON.parse(item.envelope).groupEpoch ?? 1)
              : undefined;
          const key = await keyFor(conv, epoch);
          const payload = relayPayloadSchema.parse(
            await decryptPayload(key, item.envelope)
          );
          const createdAt =
            item.createdAt instanceof Date
              ? item.createdAt.getTime()
              : Date.now();
          if (payload.type === "control") {
            if (payload.action === "read")
              await applyReadReceipt(user.id, item.conversationId, item.senderId, payload.target);
            else
              await applyMessageControl(user.id, item.conversationId, item.senderId, payload, item.messageId, createdAt);
            acked.push(item.messageId);
            failedDeliveries.current.delete(item.messageId);
            setArchiveRevision(n => n + 1);
            setLatest(await latestMessagePerConversation(user.id));
            if (activeIdRef.current === item.conversationId) setMessages(await getMessages(user.id, item.conversationId));
            continue;
          }
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

          const persisted = (await getMessages(user.id, item.conversationId)).find(m => m.mid === msg.mid)!;
          if (!persisted.hidden) setLatest(prev => new Map(prev).set(item.conversationId, persisted));
          if (activeIdRef.current === item.conversationId) {
            // outgoing echoes already render optimistically — don't duplicate
            setMessages(prev =>
              prev.some(m => m.mid === msg.mid) ? prev : [...prev, persisted]
            );
            lastReadRef.current[item.conversationId] = Math.max(
              lastReadRef.current[item.conversationId] ?? 0,
              item.messageId
            );
            void kvSet(user.id, "lastRead", lastReadRef.current);
            if (!msg.outgoing && !persisted.hidden && localStorage.getItem("locat-read-receipts") !== "off")
              void sendReadReceipt(conv, persisted);
          } else if (!msg.outgoing) {
            setUnread(prev => {
              const next = new Map(prev);
              next.set(
                item.conversationId,
                (next.get(item.conversationId) ?? 0) + 1
              );
              return next;
            });
          }
        } catch {
          // Keep the envelope queued if decryption or durable local storage fails.
          failedDeliveries.current.add(item.messageId);
        }
      }
      if (alive.current) setDeliveryWarning(failedDeliveries.current.size > 0);
      if (acked.length > 0 && alive.current)
        await ackMut.mutateAsync({ messageIds: acked });
    },
    // sendReadReceipt is a hoisted operation using the latest outbox/transmit state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keyFor, user.id, utils, ackMut]
  );

  const processRef = useRef(processDeliveries);
  useEffect(() => {
    processRef.current = processDeliveries;
  }, [processDeliveries]);

  // Serialize SSE and polling so each delivery is archived before acknowledgement.
  const deliveryQueue = useRef(Promise.resolve());
  const enqueue = useCallback((items: Delivery[]) => {
    const task = deliveryQueue.current
      .catch(() => {})
      .then(() => processRef.current(items));
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
      } else if (event.type === "conversations-changed") {
        void utils.conversations.list.invalidate();
        reconnectRef.current();
      } else {
        void enqueue([event]).catch(() => setConnection("Retrying delivery…"));
      }
    },
    onError: error => {
      // Subscription auth failures must not reload the entire application:
      // native WebView SSE cannot send the bearer token used by API requests.
      // The independent sync poller continues delivering messages.
      if (error.data?.code === "UNAUTHORIZED") {
        setConnection("Real-time unavailable · syncing messages…");
        return;
      }
      setConnection("Reconnecting…");
      reconnectRef.current();
    },
  });

  useEffect(() => {
    if (!localReady) return;
    let stopped = false;
    let running = false;
    let cursor = 0;
    const sync = async () => {
      if (running || stopped) return;
      if (!navigator.onLine) {
        setConnection("Offline · history stays on this device");
        return;
      }
      running = true;
      try {
        // Invalidate cached results so each cycle sends a real presence heartbeat.
        await utils.messages.presence.invalidate();
        const presence = await utils.messages.presence.fetch();
        if (!stopped) setOnline(new Set(presence.online));
        await utils.conversations.list.fetch();
        // Cursor advances past undecryptable envelopes; retry from zero next sweep.
        for (let pages = 0; pages < 20 && !stopped; pages++) {
          // Never treat a cached sync result as a fresh relay delivery check.
          await utils.messages.sync.invalidate();
          const page = await utils.messages.sync.fetch({ after: cursor });
          if (stopped) return;
          await enqueue(page.items);
          cursor = page.nextCursor ?? 0;
          if (page.nextCursor === null) break;
        }
        if (!stopped) setConnection("Connected");
      } catch {
        if (!stopped) setConnection("Reconnecting…");
      } finally {
        running = false;
      }
    };
    const refresh = () => {
      void sync();
    };
    const visibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const offline = () =>
      setConnection("Offline · history stays on this device");
    reconnectRef.current = refresh;
    refresh();
    // Poll the browser every 4 seconds for quicker online/offline updates; native remains at 3 seconds.
    const timer = window.setInterval(refresh, isNativeShell() ? 3000 : 4000);
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
  const openConversation = useCallback(
    async (id: number) => {
      setActiveId(id);
      activeIdRef.current = id;
      setMessages([]);
      const msgs = await getMessages(user.id, id);
      if (activeIdRef.current !== id || !alive.current) return;
      const pending = await pendingMessages(user.id);
      if (activeIdRef.current !== id) return;
      setMessages([
        ...msgs,
        ...pending.filter(m => m.conversationId === id && !m.control).map(pendingUi),
      ]);
      const maxMid = msgs.reduce((m, x) => Math.max(m, x.mid), 0);
      lastReadRef.current[id] = Math.max(lastReadRef.current[id] ?? 0, maxMid);
      void kvSet(user.id, "lastRead", lastReadRef.current);
      setUnread(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      if (localStorage.getItem("locat-read-receipts") !== "off") {
        const conv = convsRef.current.find(c => c.id === id);
        if (conv && !conv.archived && !conv.rotationRequired) {
          for (const message of msgs.filter(m => m.senderId !== user.id && !m.deleted && !m.hidden))
            void sendReadReceipt(conv, message);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id]
  );

  // ── sending ──
  function pendingUi(item: PendingMessage): UiMessage {
    return {
      ...item,
      mid: -item.createdAt,
      outgoing: true,
      tempId: item.clientMessageId,
      pending: true,
    };
  }
  const sending = useRef(new Set<string>());
  const flushRef = useRef<() => Promise<void>>(async () => {});
  async function transmit(item: PendingMessage) {
    if (sending.current.has(item.clientMessageId) || !navigator.onLine) return;
    const current = convsRef.current.find(c => c.id === item.conversationId);
    if (current?.archived) return;
    // Retry receipts expire after seven days. Do not silently resend an old ambiguous attempt.
    if (Date.now() - item.createdAt > 7 * 86400000) {
      setArchiveError(
        "A pending message is over seven days old. Automatic retry stopped to avoid a duplicate. Check with the recipient before sending it again."
      );
      return;
    }
    sending.current.add(item.clientMessageId);
    try {
      const { messageId, createdAt } = await sendMut.mutateAsync({
        conversationId: item.conversationId,
        envelope: item.envelope,
        clientMessageId: item.clientMessageId,
      });
      if (item.control) {
        if (item.control.action === "read")
          await applyReadReceipt(user.id, item.conversationId, item.senderId, item.control.target, item.clientMessageId);
        else
          await applyMessageControl(user.id, item.conversationId, item.senderId, item.control, messageId, createdAt.getTime(), item.clientMessageId);
        if (alive.current) {
          setArchiveRevision(n => n + 1);
          setLatest(await latestMessagePerConversation(user.id));
          if (activeIdRef.current === item.conversationId) setMessages(await getMessages(user.id, item.conversationId));
        }
        return;
      }
      const stored: LocalMessage = {
        mid: messageId,
        conversationId: item.conversationId,
        senderId: item.senderId,
        senderName: item.senderName,
        outgoing: true,
        payload: item.payload,
        createdAt: createdAt.getTime(),
      };
      await completePending(user.id, item.clientMessageId, stored);
      const projected = (await getMessages(user.id, item.conversationId)).find(m => m.mid === messageId)!;
      if (!alive.current) return;
      if (activeIdRef.current === item.conversationId)
        setMessages(prev =>
          [
            ...prev.filter(
              m => m.tempId !== item.clientMessageId && m.mid !== messageId
            ),
            projected,
          ].sort((a, b) => a.createdAt - b.createdAt)
        );
      setLatest(prev => new Map(prev).set(item.conversationId, projected));
    } catch (error) {
      try {
      if (
        (error as { data?: { code?: string } }).data?.code ===
        "PRECONDITION_FAILED"
      ) {
        const fresh = (await utils.conversations.list.fetch()).find(
          c => c.id === item.conversationId
        );
        if (fresh?.type === "group" && !fresh.rotationRequired) {
          await savePending(user.id, {
            ...item,
            envelope: await encryptedFor(fresh, item.control ?? item.payload),
          });
        }
      }
      } catch { /* Preserve the original outbox entry if refreshing keys fails. */ }
      if (alive.current && activeIdRef.current === item.conversationId)
        setMessages(prev =>
          prev.map(m =>
            m.tempId === item.clientMessageId
              ? { ...m, pending: false, failed: true }
              : m
          )
        );
    } finally {
      sending.current.delete(item.clientMessageId);
    }
  }
  flushRef.current = async () => {
    for (const item of await pendingMessages(user.id)) {
      if (!alive.current) return;
      await transmit(item);
    }
  };
  useEffect(() => {
    if (!localReady) return;
    const flush = () => {
      void flushRef.current().catch(() => {});
    };
    flush();
    const timer = window.setInterval(flush, 15000);
    window.addEventListener("online", flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", flush);
    };
  }, [localReady]);
  async function encryptedFor(
    conv: ConversationSummary,
    payload: MessagePayload | MessageControl
  ) {
    const envelope = await encryptPayload(await keyFor(conv), payload);
    return conv.type === "group"
      ? JSON.stringify({
          ...JSON.parse(envelope),
          groupEpoch: conv.groupEpoch ?? 1,
        })
      : envelope;
  }
  async function sendControl(conv: ConversationSummary, target: LocalMessage, action: "edit" | "delete", text?: string) {
    if (target.senderId !== user.id || target.deleted || conv.archived || conv.rotationRequired) return;
    const control: MessageControl = action === "delete"
      ? { type: "control", version: 1, action, target: messageReference(target) }
      : { type: "control", version: 1, action, target: messageReference(target), text: text ?? "" };
    try {
      const item: PendingMessage = { clientMessageId: crypto.randomUUID(), conversationId: conv.id,
        senderId: user.id, senderName: user.displayName, payload: { type: "text", text: "" }, control,
        createdAt: Date.now(), envelope: await encryptedFor(conv, control) };
      await savePending(user.id, item);
      setArchiveError("Message change queued. It applies after server confirmation and reaches recipients when they reconnect.");
      await transmit(item);
    } catch { setArchiveError("Could not queue the message change. Try again."); }
  }
  async function sendReadReceipt(conv: ConversationSummary, target: LocalMessage) {
    const ref = messageReference(target);
    const marker = `read-receipt:${conv.id}:${target.senderId}:${ref}`;
    if (await kvGet(user.id, marker)) return;
    const control: MessageControl = { type: "control", version: 1, action: "read", target: ref };
    const item: PendingMessage = { clientMessageId: crypto.randomUUID(), conversationId: conv.id,
      senderId: user.id, senderName: user.displayName, payload: { type: "text", text: "" }, control,
      createdAt: Date.now(), envelope: await encryptedFor(conv, control) };
    await savePending(user.id, item);
    await kvSet(user.id, marker, 1);
    await transmit(item);
  }
  async function sendPayload(
    conv: ConversationSummary,
    payload: MessagePayload,
    tempId: string
  ) {
    try {
      // Bind the encrypted reference to the durable retry ID before sealing.
      // Retrying never generates a second reference for the same message.
      payload = { ...payload, messageRef: tempId };
      messagePayloadSchema.parse(payload);
      const existing = (await pendingMessages(user.id)).find(
        m => m.clientMessageId === tempId
      );
      const item: PendingMessage = existing ?? {
        clientMessageId: tempId,
        conversationId: conv.id,
        senderId: user.id,
        senderName: user.displayName,
        payload,
        createdAt: Date.now(),
        envelope: await encryptedFor(conv, payload),
      };
      await savePending(user.id, item);
      const optimistic = pendingUi(item);
      if (activeIdRef.current === conv.id)
        setMessages(prev => [
          ...prev.filter(m => m.tempId !== tempId),
          optimistic,
        ]);
      setLatest(prev => new Map(prev).set(conv.id, optimistic));
      await transmit(item);
    } catch (error) {
      setArchiveError(
        error instanceof Error
          ? error.message
          : "Could not save this message on your device. Check available storage and try again."
      );
    }
  }

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  async function toggleHidden(conversationId: number) {
    try {
      const hidden = !hiddenIds.has(conversationId);
      await setConversationHidden(user.id, conversationId, hidden);
      setHiddenIds(new Set(await hiddenConversationIds(user.id)));
      setActiveId(null);
    } catch { setArchiveError("Could not save the hidden-chat setting on this device."); }
  }

  const sortedConversations = useMemo(() => {
    return [...conversations]
      .filter(c => hiddenReady && hiddenIds.has(c.id) === showHidden)
      .filter(c =>
        conversationTitle(c, user.id)
          .title.toLowerCase()
          .includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const la = latest.get(a.id);
        const lb = latest.get(b.id);
        return (
          (lb?.createdAt ?? new Date(b.createdAt).getTime()) -
          (la?.createdAt ?? new Date(a.createdAt).getTime())
        );
      });
  }, [conversations, latest, search, user.id, hiddenReady, hiddenIds, showHidden]);

  // ── layout ──
  const sidebar = (
    <div className="flex h-full flex-col border-r border-border/70 bg-[hsl(var(--sidebar-background))]">
      <div className="flex min-h-16 shrink-0 items-center gap-2 border-b px-3 py-2 pt-safe sm:gap-3 sm:px-4">
        <button type="button" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-card/70 hover:bg-accent"><Menu className="h-5 w-5" /></button>
        <button type="button" onClick={() => setProfileOpen(true)} aria-label="Open my profile"
          title="My profile" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:ring-2 sm:h-11 sm:w-11 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Avatar avatar={user.avatar} name={user.displayName} id={user.id} size={36} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Locat</p>
          <p className="truncate text-xs text-foreground/80">{user.displayName}</p>
          <p className="micro-label truncate normal-case tracking-normal" title={`@${user.username} · ${userCode(user.lcCode)}`}>
            @{user.username} · {userCode(user.lcCode)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewConvOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground sm:h-11 sm:w-11"
          aria-label="People, requests and new conversation"
          title="People and requests"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setStorageOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground sm:h-11 sm:w-11"
          aria-label="History and backups"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() =>
            void logout().catch(() =>
              setArchiveError(
                "Sign out failed. Check your connection and try again."
              )
            )
          }
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground sm:h-11 sm:w-11"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="mb-3 flex gap-2" role="group" aria-label="Conversation visibility">
          <button type="button" aria-pressed={!showHidden} onClick={() => { setShowHidden(false); setSearch(""); }} className={`min-h-11 flex-1 rounded-lg border text-sm ${!showHidden ? "bg-accent" : ""}`}>Chats</button>
          <button type="button" aria-pressed={showHidden} onClick={() => { setShowHidden(true); setSearch(""); }} className={`min-h-11 flex-1 rounded-lg border text-sm ${showHidden ? "bg-accent" : ""}`}>Hidden chats ({conversations.filter(c => hiddenIds.has(c.id)).length})</button>
        </div>
        {showHidden && <p className="mb-3 text-xs text-secondary">Hidden only on this device. This does not lock chats or silence notifications.</p>}
        {!hiddenReady && <p role="status" className="mb-3 text-xs text-secondary">Loading local chat settings. If this persists, check browser storage permissions.</p>}
        <input
          aria-label="Search conversations"
          placeholder="Search chats…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="smoked-glass min-h-11 w-full rounded-xl px-3 py-2 text-sm"
        />
      </div>
      {deliveryWarning && (
        <p
          role="status"
          className="border-b px-4 py-3 text-xs text-destructive"
        >
          Some messages could not be unlocked or saved. They remain queued;
          check your keys and available storage.
        </p>
      )}
      {conversationsQ.isError && (
        <p role="alert" className="border-b px-4 py-3 text-xs text-destructive">
          Cannot load conversations. Check your connection.
        </p>
      )}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
        {hiddenReady && sortedConversations.length === 0 && (
          <p className="micro-label px-4 py-10 text-center normal-case leading-relaxed tracking-normal">
            {search ? "No matching chats." : showHidden ? "No hidden chats on this device." : "No visible conversations yet."}
            <br />
            {showHidden ? "Open a chat and choose Hide on this device." : "Tap + to find people, or check Hidden chats."}
          </p>
        )}
        {sortedConversations.map(c => {
          const { title } = conversationTitle(c, user.id);
          const last = latest.get(c.id);
          const n = unread.get(c.id) ?? 0;
          const otherId =
            c.type === "direct"
              ? c.members.find(m => m.id !== user.id)?.id
              : undefined;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => void openConversation(c.id)}
              className={`flex min-h-16 w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/80 ${
                activeId === c.id ? "bg-accent/90 shadow-[inset_2px_0_hsl(var(--primary))]" : ""
              }`}
            >
              {c.type === "direct" ? (
                <Avatar
                  avatar={c.members.find(m => m.id !== user.id)?.avatar}
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
                    <span className="micro-label shrink-0">
                      {listTimeLabel(last.createdAt)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-secondary">
                    {last
                      ? last.payload.type === "image"
                        ? "🖼 image"
                        : last.payload.type === "voice"
                          ? `${last.outgoing ? "you: " : ""}🎙 voice message`
                          : last.payload.type === "file"
                            ? `${last.outgoing ? "you: " : ""}📎 ${last.payload.name}`
                            : `${last.outgoing ? "you: " : ""}${last.payload.text}`
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

      {user.isAdmin && (
        <Link to="/admin" className="border-t px-4 py-3 text-sm text-primary">
          Server administration →
        </Link>
      )}
      <p className="micro-label shrink-0 border-t px-4 py-3 pb-safe normal-case tracking-normal">
        Locat · {connection} · v{packageInfo.version} · Build {__LOCAT_BUILD_ID__}
      </p>
    </div>
  );

  return (
    <div className="flex app-height bg-background text-foreground">
      {archiveError && (
        <div
          role="alert"
          className="fixed left-4 right-4 top-4 z-50 rounded-lg border bg-card p-4 text-sm text-destructive"
        >
          {archiveError}
          <button
            className="ml-3 underline"
            onClick={() => setArchiveError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" className="absolute inset-0 bg-black/70" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <nav aria-label="Locat navigation" className="smoked-glass relative flex h-full w-[min(86vw,340px)] flex-col rounded-r-3xl border-r px-4 pb-safe pt-safe shadow-2xl">
            <div className="flex min-h-20 items-center justify-between border-b px-2"><h2 className="text-2xl font-semibold">Locat</h2><button type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-accent"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 space-y-2">
              <button type="button" onClick={() => { setShowHidden(false); setActiveId(null); setNavOpen(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-accent px-4 text-left text-sm font-medium"><MessageCircle className="h-5 w-5 text-primary" /> Chats</button>
              <button type="button" onClick={() => { setActiveId(null); setNavOpen(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm hover:bg-accent"><Search className="h-5 w-5" /> Search conversations</button>
              <button type="button" onClick={() => { setNavOpen(false); setNewConvOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm hover:bg-accent"><MessageSquarePlus className="h-5 w-5" /> People &amp; requests</button>
              <button type="button" onClick={() => { setNavOpen(false); setStorageOpen(true); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm hover:bg-accent"><HardDrive className="h-5 w-5" /> Storage &amp; backups</button>
            </div>
            <div className="mt-auto space-y-3 border-t pt-4">
              <button type="button" onClick={() => { setNavOpen(false); setProfileOpen(true); }} className="flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card/70 px-3 text-left hover:bg-accent"><UserRound className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.displayName}</span><span className="block truncate text-xs text-muted-foreground">@{user.username}</span></span></button>
              <button type="button" onClick={() => { setNavOpen(false); setStorageOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-accent"><Settings className="h-5 w-5" /> Settings &amp; data</button>
            </div>
          </nav>
        </div>
      )}
      {/* sidebar: full-screen on mobile, fixed column on desktop */}
      <div
        className={`${activeId ? "hidden" : "flex"} w-full border-r border-border/70 md:flex md:w-80 md:shrink-0 lg:w-96`}
      >
        {sidebar}
      </div>

      {/* main pane */}
      <div className={`${activeId ? "flex" : "hidden"} min-w-0 flex-1 md:flex`}>
        {activeConv ? (
          <ChatWindow
            key={activeConv.id}
            conversation={activeConv}
            messages={messages}
            myId={user.id}
            online={online}
            hidden={hiddenIds.has(activeConv.id)}
            onToggleHidden={() => void toggleHidden(activeConv.id)}
            onToggleMessageHidden={message => {
              void setMessageHidden(user.id, message.mid, !message.hidden)
                .then(async () => {
                  setArchiveRevision(n => n + 1);
                  if (activeIdRef.current === activeConv.id) setMessages(await getMessages(user.id, activeConv.id));
                }).catch(() => setArchiveError("Could not save the hidden-message setting."));
            }}
            blocked={activeConv.type === "direct" && activeConv.members.some(m => m.id !== user.id && blockedIds.has(m.id))}
            onToggleBlock={() => void (async () => {
              const other = activeConv.members.find(m => m.id !== user.id);
              if (!other) return;
              const blocked = blockedIds.has(other.id);
              if (!blocked && !window.confirm(`Block ${other.displayName}? Neither account will be able to send direct messages until you unblock them.`)) return;
              if (blocked) await unblockMut.mutateAsync({ userId: other.id });
              else await blockMut.mutateAsync({ userId: other.id });
              await blockedQ.refetch();
            })().catch(error => setArchiveError(error instanceof Error ? error.message : "Could not update blocked contacts."))}
            onBack={() => setActiveId(null)}
            onSendText={text =>
              void sendPayload(
                activeConv,
                { type: "text", text },
                crypto.randomUUID()
              )
            }
            onSendImage={file =>
              void (async () => {
                const payload = await imageToPayload(file);
                await sendPayload(activeConv, payload, crypto.randomUUID());
              })().catch(() =>
                setArchiveError(
                  "Could not prepare this image. Try a smaller image or a different format."
                )
              )
            }
            onSendFile={file =>
              void fileToPayload(file)
                .then(payload => sendPayload(activeConv, payload, crypto.randomUUID()))
                .catch(error => setArchiveError(error instanceof Error ? error.message : "Could not prepare this file."))
            }
            onSendVoice={(blob, durationMs) =>
              void voiceToPayload(blob, durationMs)
                .then(payload => sendPayload(activeConv, payload, crypto.randomUUID()))
                .catch(error => setArchiveError(error instanceof Error ? error.message : "Could not prepare this voice message."))
            }
            onRetry={tempId => {
              const failed = messages.find(m => m.tempId === tempId);
              if (!failed) return;
              setMessages(prev => prev.filter(m => m.tempId !== tempId));
              void sendPayload(activeConv, failed.payload, tempId);
            }}
            onShowGroup={() => setGroupOpen(true)}
            onShowSecurity={() => setSecurityOpen(true)}
            onEdit={(message, text) => void sendControl(activeConv, message, "edit", text)}
            onDeleteForAll={message => void sendControl(activeConv, message, "delete")}
            onDelete={mid => {
              void deleteLocalMessage(user.id, mid)
                .then(() => {
                  setArchiveRevision(n => n + 1);
                  void openConversation(activeConv.id);
                })
                .catch(() => setArchiveError("Could not delete this message."));
            }}
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

      {activeConv?.type === "group" && (
        <GroupDialog
          key={`${activeConv.id}:${activeConv.groupEpoch}:${activeConv.createdBy}`}
          conversation={activeConv}
          open={groupOpen}
          onOpenChange={setGroupOpen}
        />
      )}
      {profileOpen && <ProfileDialog user={user} open={profileOpen} onOpenChange={setProfileOpen} />}
      <StorageDialog
        user={user}
        open={storageOpen}
        onOpenChange={setStorageOpen}
        onImported={() => {
          setArchiveRevision(n => n + 1);
          if (activeId !== null) void openConversation(activeId);
        }}
      />
      <NewConversationDialog
        open={newConvOpen}
        onOpenChange={setNewConvOpen}
        onCreated={id => void openConversation(id)}
      />
      <SecurityDialog
        conversation={activeConv}
        open={securityOpen}
        onOpenChange={setSecurityOpen}
        onVerified={() => {
          keyCache.current.clear();
          reconnectRef.current();
        }}
      />
    </div>
  );
}
