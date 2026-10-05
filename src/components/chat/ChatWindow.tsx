import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalMessage } from "@/lib/localdb";
import type { ConversationSummary } from "@contracts/types";
import { imageUrl } from "@/lib/crypto";
import { dayLabel, sameDay, timeLabel } from "@/lib/format";
import { Avatar, AvatarStack } from "./Avatar";
import { ArrowLeft, ImagePlus, SendHorizonal, ShieldCheck, RotateCcw } from "lucide-react";

export type UiMessage = LocalMessage & {
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
};

export function conversationTitle(
  conv: ConversationSummary,
  myId: number,
): { title: string; subtitle: string } {
  if (conv.type === "direct") {
    const other = conv.members.find((m) => m.id !== myId);
    return {
      title: other?.displayName ?? "Unknown",
      subtitle: other ? `@${other.username}` : "",
    };
  }
  return {
    title: conv.name ?? "Group",
    subtitle: `${conv.members.length} members`,
  };
}

export function ChatWindow({
  conversation,
  messages,
  myId,
  online,
  onBack,
  onSendText,
  onSendImage,
  onRetry,
  onShowSecurity,
}: {
  conversation: ConversationSummary;
  messages: UiMessage[];
  myId: number;
  online: Set<number>;
  onBack: () => void;
  onSendText: (text: string) => void;
  onSendImage: (file: File) => void;
  onRetry: (tempId: string) => void;
  onShowSecurity: () => void;
}) {
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { title, subtitle } = conversationTitle(conversation, myId);
  const otherId =
    conversation.type === "direct"
      ? conversation.members.find((m) => m.id !== myId)?.id
      : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation.id]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSendText(text);
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* header */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conversation.type === "direct" ? (
          <Avatar name={title} id={otherId ?? 0} size={38} online={otherId ? online.has(otherId) : undefined} />
        ) : (
          <AvatarStack members={conversation.members} size={38} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="micro-label normal-case tracking-normal">
            {conversation.type === "direct"
              ? otherId && online.has(otherId)
                ? "online"
                : subtitle
              : subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onShowSecurity}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground"
          aria-label="Encryption details"
          title="Encryption details"
        >
          <ShieldCheck className="h-5 w-5" />
        </button>
      </header>

      {/* messages */}
      <div ref={scrollRef} className="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="micro-label text-center normal-case leading-relaxed tracking-normal">
              No messages yet.
              <br />
              Everything you send is encrypted on this device first.
            </p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            const showSender =
              conversation.type === "group" && !m.outgoing && (!prev || prev.senderId !== m.senderId || showDay);
            return (
              <div key={m.tempId ?? m.mid}>
                {showDay && (
                  <div className="flex justify-center py-3">
                    <span className="micro-label rounded-full border px-3 py-1">{dayLabel(m.createdAt)}</span>
                  </div>
                )}
                <MessageBubble m={m} showSender={showSender} onRetry={onRetry} />
              </div>
            );
          })}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t px-3 py-3 pb-safe sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSendImage(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-secondary transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Send image"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Message…"
            rows={1}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-secondary focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.94] disabled:opacity-30"
            aria-label="Send"
          >
            <SendHorizonal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  showSender,
  onRetry,
}: {
  m: UiMessage;
  showSender: boolean;
  onRetry: (tempId: string) => void;
}) {
  const img = useMemo(() => imageUrl(m.payload), [m.payload]);
  useEffect(() => {
    return () => {
      if (img) URL.revokeObjectURL(img);
    };
  }, [img]);

  const mine = m.outgoing;
  return (
    <div className={`msg-in flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] sm:max-w-[65%] ${mine ? "items-end" : "items-start"}`}>
        {showSender && <p className="micro-label mb-1 ml-1 normal-case tracking-normal">{m.senderName}</p>}
        <div
          className={`overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "surface-2 rounded-bl-md border"
          } ${m.pending ? "opacity-60" : ""} ${m.failed ? "border-destructive" : ""}`}
        >
          {m.payload.type === "image" && img && (
            <img
              src={img}
              alt={m.payload.name}
              className="-mx-1 mb-1 max-h-72 rounded-lg object-cover"
              loading="lazy"
            />
          )}
          {m.payload.type === "text" && <p className="whitespace-pre-wrap break-words">{m.payload.text}</p>}
          <div className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
            <span className={`micro-label ${mine ? "text-primary-foreground/70" : ""}`}>
              {timeLabel(m.createdAt)}
            </span>
            {m.failed && m.tempId && (
              <button
                type="button"
                onClick={() => onRetry(m.tempId!)}
                className="flex items-center gap-1 text-xs text-destructive underline underline-offset-2"
              >
                <RotateCcw className="h-3 w-3" /> retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
