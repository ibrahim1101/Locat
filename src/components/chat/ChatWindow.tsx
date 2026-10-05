import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalMessage } from "@/lib/localdb";
import type { ConversationSummary } from "@contracts/types";
import { imageUrl } from "@/lib/crypto";
import { dayLabel, sameDay, timeLabel } from "@/lib/format";
import { Avatar, AvatarStack } from "./Avatar";
import {
  ArrowLeft,
  ImagePlus,
  SendHorizonal,
  ShieldCheck,
  RotateCcw,
  Search,
  ArrowDown,
  MoreHorizontal,
  X,
  Copy,
  Reply,
  Download,
  Users,
} from "lucide-react";

export type UiMessage = LocalMessage & {
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
};

export function conversationTitle(
  conv: ConversationSummary,
  myId: number
): { title: string; subtitle: string } {
  if (conv.type === "direct") {
    const other = conv.members.find(m => m.id !== myId);
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
  onShowGroup,
  onDelete,
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
  onShowGroup: () => void;
  onDelete: (mid: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const nearBottom = useRef(true);
  const previousLength = useRef(0);
  const [reply, setReply] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setAtBottom(true);
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { title, subtitle } = conversationTitle(conversation, myId);
  const otherId =
    conversation.type === "direct"
      ? conversation.members.find(m => m.id !== myId)?.id
      : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (
      el &&
      (nearBottom.current ||
        (messages.length > previousLength.current && messages.at(-1)?.outgoing))
    )
      el.scrollTop = el.scrollHeight;
    previousLength.current = messages.length;
  }, [messages, conversation.id]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSendText(reply ? `> ${reply.replaceAll("\n", "\n> ")}\n\n${text}` : text);
    setReply(null);
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* header */}
      <header className="flex min-h-16 pt-safe shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-md text-secondary hover:bg-accent hover:text-foreground md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {conversation.type === "direct" ? (
          <Avatar
            name={title}
            id={otherId ?? 0}
            size={38}
            online={otherId ? online.has(otherId) : undefined}
          />
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
        {conversation.type === "group" && (
          <button
            type="button"
            aria-label="Group details"
            onClick={onShowGroup}
            className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          aria-label="Search this conversation"
          onClick={() => setSearchOpen(!searchOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent"
        >
          <Search className="h-5 w-5" />
        </button>
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

      {searchOpen && (
        <div className="border-b p-3">
          <input
            aria-label="Search saved messages"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search saved messages…"
            className="w-full rounded-lg border bg-background px-3 py-2"
          />
        </div>
      )}
      {/* messages */}
      <div
        ref={scrollRef}
        onScroll={e => {
          const el = e.currentTarget;
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          setAtBottom(nearBottom.current);
        }}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
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
          {messages
            .filter(
              m =>
                !searchOpen ||
                !search ||
                (m.payload.type === "text" &&
                  m.payload.text.toLowerCase().includes(search.toLowerCase()))
            )
            .map((m, i) => {
              const prev = messages[i - 1];
              const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const showSender =
                conversation.type === "group" &&
                !m.outgoing &&
                (!prev || prev.senderId !== m.senderId || showDay);
              return (
                <div key={m.tempId ?? m.mid}>
                  {showDay && (
                    <div className="flex justify-center py-3">
                      <span className="micro-label rounded-full border px-3 py-1">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    m={m}
                    showSender={showSender}
                    onRetry={onRetry}
                    onDelete={onDelete}
                    onReply={text => {
                      setReply(text);
                      textareaRef.current?.focus();
                    }}
                  />
                </div>
              );
            })}
        </div>
      </div>

      {!atBottom && (
        <button
          className="mx-auto my-2 flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs"
          onClick={scrollToLatest}
        >
          <ArrowDown className="h-4 w-4" />
          Latest messages
        </button>
      )}
      {reply && (
        <div className="flex items-center gap-3 border-t px-4 py-2 text-sm">
          <Reply className="h-4 w-4" />
          <p className="flex-1 truncate">{reply}</p>
          <button aria-label="Cancel reply" onClick={() => setReply(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {conversation.archived || conversation.rotationRequired ? (
        <p role="status" className="border-t px-4 py-4 text-sm text-secondary">
          {conversation.archived
            ? "Archived · you are no longer a member. History stays on this device."
            : "Sending paused · the owner must rotate the group key in Group details."}
        </p>
      ) : (
        <>
          {/* composer */}
          <div className="shrink-0 border-t px-3 py-3 pb-safe sm:px-6">
            <div className="mx-auto flex max-w-3xl items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
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
                ref={textareaRef}
                aria-label="Message"
                maxLength={10000}
                value={draft}
                onChange={e => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`;
                }}
                onKeyDown={e => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing &&
                    window.matchMedia("(min-width: 768px)").matches
                  ) {
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
        </>
      )}
    </div>
  );
}

function MessageBubble({
  m,
  showSender,
  onRetry,
  onDelete,
  onReply,
}: {
  m: UiMessage;
  showSender: boolean;
  onRetry: (tempId: string) => void;
  onDelete: (mid: number) => void;
  onReply: (text: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const img = useMemo(() => imageUrl(m.payload), [m.payload]);
  useEffect(() => {
    return () => {
      if (img) URL.revokeObjectURL(img);
    };
  }, [img]);

  const mine = m.outgoing;
  return (
    <div className={`msg-in flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] sm:max-w-[65%] ${mine ? "items-end" : "items-start"}`}
      >
        {showSender && (
          <p className="micro-label mb-1 ml-1 normal-case tracking-normal">
            {m.senderName}
          </p>
        )}
        <div className="flex items-center gap-2 justify-end">
          <button
            aria-label="Message actions"
            onClick={() => setMenu(!menu)}
            className="h-8 w-8 text-secondary"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        {menu && (
          <div className="mb-2 flex flex-wrap gap-2 rounded-xl border bg-card p-2 text-xs">
            {m.payload.type === "image" && !img && <p>Unsupported image format</p>}
          {m.payload.type === "text" && (
              <>
                <button
                  className="flex items-center gap-1 p-2"
                  onClick={() => {
                    if (m.payload.type === "text")
                      void navigator.clipboard
                        .writeText(m.payload.text)
                        .then(() => setMenu(false))
                        .catch(() =>
                          setFeedback("Copy unavailable in this browser.")
                        );
                  }}
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  className="flex items-center gap-1 p-2"
                  onClick={() => {
                    if (m.payload.type === "text") onReply(m.payload.text);
                    setMenu(false);
                  }}
                >
                  <Reply size={14} />
                  Reply
                </button>
              </>
            )}
            {!m.tempId && (
              <button
                className="p-2 text-destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this message from this device? Other devices keep their copies."
                    )
                  )
                    onDelete(m.mid);
                }}
              >
                Delete locally
              </button>
            )}
          </div>
        )}
        {feedback && (
          <p role="status" className="text-xs">
            {feedback}
          </p>
        )}
        <div
          className={`overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "surface-2 rounded-bl-md border"
          } ${m.pending ? "opacity-60" : ""} ${m.failed ? "border-destructive" : ""}`}
        >
          {m.payload.type === "image" && img && (
            <img
              onClick={() => setExpanded(true)}
              tabIndex={0}
              role="button"
              onKeyDown={e => {
                if (e.key === "Enter") setExpanded(true);
              }}
              src={img}
              alt={m.payload.name}
              className="-mx-1 mb-1 max-h-72 rounded-lg object-cover"
              loading="lazy"
            />
          )}
          {m.payload.type === "image" && !img && <p>Unsupported image format</p>}
          {m.payload.type === "text" && (
            <p className="whitespace-pre-wrap break-words">{m.payload.text}</p>
          )}
          <div
            className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`micro-label ${mine ? "text-primary-foreground/70" : ""}`}
            >
              {timeLabel(m.createdAt)}
            </span>
            {mine && !m.failed && (
              <span className="text-[10px] text-primary-foreground/70">
                {m.pending ? "Sending…" : "Sent"}
              </span>
            )}
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
      {img && m.payload.type === "image" && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="max-h-[95dvh] max-w-[95vw] bg-background p-4 sm:max-w-4xl">
            <DialogTitle className="truncate pr-8">
              {m.payload.name}
            </DialogTitle>
            <div className="overflow-auto">
              <img
                src={img}
                alt={m.payload.name}
                className="max-h-[75dvh] w-full object-contain"
              />
            </div>
            <a
              className="flex items-center justify-center gap-2 rounded-lg border p-3 text-sm"
              href={img}
              download={m.payload.name}
            >
              <Download size={16} />
              Download image
            </a>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
