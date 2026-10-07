import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalMessage } from "@/lib/localdb";
import type { ConversationSummary } from "@contracts/types";
import { imageUrl, voiceUrl } from "@/lib/crypto";
import { dayLabel, sameDay, timeLabel } from "@/lib/format";
import { Avatar, AvatarStack } from "./Avatar";
import { FriendProfileDialog } from "./FriendProfileDialog";
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
  Ban,
  EyeOff,
  Eye,
  Mic,
  Square,
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
      subtitle: other?.username ? `@${other.username}` : "",
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
  onSendVoice,
  onRetry,
  onShowSecurity,
  onShowGroup,
  onDelete,
  onEdit,
  onDeleteForAll,
  blocked,
  onToggleBlock,
  hidden,
  onToggleHidden,
  onToggleMessageHidden,
}: {
  conversation: ConversationSummary;
  messages: UiMessage[];
  myId: number;
  online: Set<number>;
  onBack: () => void;
  onSendText: (text: string) => void;
  onSendImage: (file: File) => void;
  onSendVoice: (blob: Blob, durationMs: number) => void;
  onRetry: (tempId: string) => void;
  onShowSecurity: () => void;
  onShowGroup: () => void;
  onDelete: (mid: number) => void;
  onEdit: (message: LocalMessage, text: string) => void;
  onDeleteForAll: (message: LocalMessage) => void;
  blocked: boolean;
  onToggleBlock: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
  onToggleMessageHidden: (message: LocalMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [showHiddenMessages, setShowHiddenMessages] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const nearBottom = useRef(true);
  const previousLength = useRef(0);
  const [reply, setReply] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStarted = useRef(0);
  const recordingTimer = useRef<number | null>(null);
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

  useEffect(() => () => {
    if (recordingTimer.current !== null) window.clearInterval(recordingTimer.current);
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    recorder?.stream.getTracks().forEach(track => track.stop());
  }, []);

  async function startRecording() {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Voice recording is unavailable in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) {
        stream.getTracks().forEach(track => track.stop());
        setRecordingError("This browser does not offer a supported voice recording format.");
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 48_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (recordingTimer.current !== null) window.clearInterval(recordingTimer.current);
        recordingTimer.current = null;
        const durationMs = Math.min(60_000, Date.now() - recordingStarted.current);
        stream.getTracks().forEach(track => track.stop());
        recorderRef.current = null;
        setRecording(false);
        setRecordingMs(0);
        if (durationMs >= 250 && chunks.length)
          onSendVoice(new Blob(chunks, { type: recorder.mimeType.split(";")[0] }), durationMs);
      };
      recorder.onerror = () => {
        setRecordingError("Recording failed. Check microphone permission and try again.");
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorderRef.current = recorder;
      recordingStarted.current = Date.now();
      recorder.start(1000);
      setRecording(true);
      setRecordingMs(0);
      recordingTimer.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStarted.current;
        setRecordingMs(Math.min(60_000, elapsed));
        if (elapsed >= 60_000 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch {
      setRecordingError("Microphone permission was not granted.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    onSendText(reply ? `> ${reply.replaceAll("\n", "\n> ")}\n\n${text}` : text);
    setReply(null);
  }

  const visibleMessages = messages.filter(m => Boolean(m.hidden) === showHiddenMessages)
    .filter(m => !searchOpen || !search || (m.payload.type === "text" && m.payload.text.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-end gap-2 border-b px-3 py-1">
        <button type="button" aria-pressed={showHiddenMessages} onClick={() => { setShowHiddenMessages(v => !v); setSearch(""); setReply(null); }} className="min-h-11 rounded-md px-3 text-xs hover:bg-accent">
          {showHiddenMessages ? "Back to messages" : `Hidden messages (${messages.filter(m => m.hidden).length})`}
        </button>
        <button type="button" onClick={onToggleHidden} className="flex min-h-11 items-center gap-2 rounded-md px-3 text-xs hover:bg-accent">
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {hidden ? "Restore to chats" : "Hide on this device"}
        </button>
      </div>
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
          <button type="button" aria-label={`View ${title}'s profile`} disabled={!otherId}
            className="rounded-full focus-visible:outline focus-visible:outline-2" onClick={() => otherId && setProfileId(otherId)}>
          <Avatar
            avatar={conversation.members.find(m => m.id !== myId)?.avatar}
            name={title}
            id={otherId ?? 0}
            size={38}
            online={otherId ? online.has(otherId) : undefined}
          />
          </button>
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
        {conversation.type === "direct" && (
          <button type="button" onClick={onToggleBlock}
            className={`flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent ${blocked ? "text-destructive" : "text-secondary"}`}
            aria-label={blocked ? "Unblock contact" : "Block contact"} title={blocked ? "Unblock contact" : "Block contact"}>
            <Ban className="h-5 w-5" />
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
      {profileId !== null && <FriendProfileDialog key={profileId} userId={profileId} onClose={() => setProfileId(null)} />}

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
        {visibleMessages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="micro-label text-center normal-case leading-relaxed tracking-normal">
              {showHiddenMessages ? "No hidden messages match this view." : "No visible messages match this view."}
              <br />
              {showHiddenMessages ? "Hiding is local and does not lock messages." : "Everything you send is encrypted on this device first."}
            </p>
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-1.5">
          {visibleMessages
            .map((m, i) => {
              const prev = visibleMessages[i - 1];
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
                    onToggleHidden={onToggleMessageHidden}
                    canControl={!conversation.archived && !conversation.rotationRequired}
                    onEdit={onEdit}
                    onDeleteForAll={onDeleteForAll}
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
      {showHiddenMessages || conversation.archived || conversation.rotationRequired ? (
        <p role="status" className="border-t px-4 py-4 text-sm text-secondary">
          {showHiddenMessages ? "Return to messages to compose a reply." : conversation.archived
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
                disabled={blocked}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-secondary transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Send image"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => recording ? stopRecording() : void startRecording()}
                disabled={blocked}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-accent ${recording ? "text-destructive" : "text-secondary"}`}
                aria-label={recording ? "Stop and send voice message" : "Record voice message"}
                title={recording ? "Stop and send" : "Voice message"}
              >
                {recording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
              </button>
              {recording ? (
                <div role="status" className="flex min-h-11 flex-1 items-center rounded-md border px-3 text-sm">
                  Recording… {(recordingMs / 1000).toFixed(1)} / 60s
                </div>
              ) : <textarea
                ref={textareaRef}
                aria-label="Message"
                disabled={blocked}
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
                placeholder={blocked ? "Direct contact is blocked" : "Message…"}
                rows={1}
                className="max-h-36 min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-secondary focus-visible:ring-1 focus-visible:ring-ring"
              />}
              <button
                type="button"
                onClick={submit}
                disabled={blocked || recording || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.94] disabled:opacity-30"
                aria-label="Send"
              >
                <SendHorizonal className="h-5 w-5" />
              </button>
            </div>
            {recordingError && <p role="alert" className="mx-auto mt-2 max-w-3xl text-xs text-destructive">{recordingError}</p>}
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({
  canControl,
  m,
  showSender,
  onRetry,
  onDelete,
  onEdit,
  onDeleteForAll,
  onReply,
  onToggleHidden,
}: {
  canControl: boolean;
  m: UiMessage;
  showSender: boolean;
  onRetry: (tempId: string) => void;
  onDelete: (mid: number) => void;
  onEdit: (message: LocalMessage, text: string) => void;
  onDeleteForAll: (message: LocalMessage) => void;
  onReply: (text: string) => void;
  onToggleHidden: (message: LocalMessage) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const img = useMemo(() => imageUrl(m.payload), [m.payload]);
  const voice = useMemo(() => voiceUrl(m.payload), [m.payload]);
  useEffect(() => {
    return () => {
      if (img) URL.revokeObjectURL(img);
      if (voice) URL.revokeObjectURL(voice);
    };
  }, [img, voice]);

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
            {!m.tempId && <button className="min-h-11 p-2" onClick={() => { onToggleHidden(m); setMenu(false); }}>
              {m.hidden ? "Restore message" : "Hide on this device"}
            </button>}
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
            {canControl && mine && !m.tempId && !m.deleted && <>
              {m.payload.type === "text" && <button className="p-2" onClick={() => {
                const text = window.prompt("Edit message", m.payload.type === "text" ? m.payload.text : "");
                if (text !== null && text.trim()) { onEdit(m, text); setMenu(false); }
              }}>Edit message</button>}
              <button className="p-2 text-destructive" onClick={() => {
                if (window.confirm("Delete for all current conversation members? Previously saved copies and screenshots cannot be withdrawn.")) {
                  onDeleteForAll(m); setMenu(false);
                }
              }}>Delete for all</button>
            </>}
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
          {m.payload.type === "voice" && voice && (
            <div className="min-w-56">
              <p className="mb-1 text-xs opacity-75">Voice message · {Math.ceil(m.payload.durationMs / 1000)}s</p>
              <audio controls preload="metadata" src={voice} className="h-10 w-full" />
            </div>
          )}
          {m.payload.type === "voice" && !voice && <p>Unsupported voice message</p>}
          <div
            className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}
          >
            {m.editedAt && !m.deleted && <span className="text-[10px] opacity-70">edited</span>}
            <span
              className={`micro-label ${mine ? "text-primary-foreground/70" : ""}`}
            >
              {timeLabel(m.createdAt)}
            </span>
            {mine && !m.failed && (
              <span className="text-[10px] text-primary-foreground/70">
                {m.pending ? "Sending…" : (m.readBy?.length ? `Read${m.readBy.length > 1 ? ` by ${m.readBy.length}` : ""}` : "Sent")}
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
