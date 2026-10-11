import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Search as SearchIcon } from "lucide-react";
import type { ConversationSummary } from "@contracts/types";
import { AppShell, ModuleHeader } from "@/components/shell/AppShell";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { cachedConversations, getMessages, hiddenConversationIds, type LocalMessage } from "@/lib/localdb";
import { searchLocalMessages, visibleConversations } from "@/lib/globalSearch";
import Login from "./Login";

export default function SearchPage() {
  const { state } = useAuth();
  if (state.status === "loading") return <p role="status">Loading account…</p>;
  if (state.status !== "ready") return <Login />;
  return <LocalSearch key={state.user.id} userId={state.user.id} />;
}
function LocalSearch({ userId }: { userId: number }) {
  const conversationsQ = trpc.conversations.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [index, setIndex] = useState<{ conversations: ConversationSummary[]; hidden: number[]; messages: LocalMessage[] } | null>(null);
  const [error, setError] = useState("");
  const [cached, setCached] = useState(false);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Never expose stale results while membership or hidden state refreshes.
      setIndex(null); setError("");
      if (conversationsQ.isPending) return;
      const conversations = conversationsQ.data ?? await cachedConversations(userId);
      const hidden = await hiddenConversationIds(userId);
      const authorized = visibleConversations(userId, conversations, hidden);
      const histories = await Promise.all(authorized.map(conversation => getMessages(userId, conversation.id)));
      if (!cancelled) { setIndex({ conversations: authorized, hidden, messages: histories.flat() }); setCached(!conversationsQ.data); }
    };
    void load().catch(() => { if (!cancelled) { setIndex(null); setError("Local history is unavailable. Check device storage permissions."); } });
    return () => { cancelled = true; };
  }, [userId, conversationsQ.data, conversationsQ.isPending, revision]);
  const results = useMemo(() => index ? searchLocalMessages(userId, index.conversations, index.hidden, index.messages, query) : [], [index, userId, query]);
  return <AppShell active="search"><ModuleHeader title="Search" tagline="Search your visible local message history" icon={SearchIcon} /><main className="flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl space-y-4">
    <label className="block text-sm">Messages and attachment names<input type="search" aria-label="Search local messages" maxLength={200} value={query} onChange={event => setQuery(event.target.value)} placeholder="Type at least two characters" className="mt-2 w-full rounded-xl border bg-card p-3" /></label>
    <p className="text-xs text-secondary">Search runs on this device using decrypted history already stored for your account. Hidden/deleted messages, hidden chats and archived/nonmember conversations are excluded. Vault, server files and remote ciphertext are not searched. Up to 100 newest matches are displayed.</p>
    {cached && <p role="status" className="text-xs text-secondary">Host unavailable. Using last verified cached membership; recent membership changes cannot be checked until reconnecting.</p>}
    <button type="button" onClick={() => { setRevision(value => value + 1); void conversationsQ.refetch(); }} className="rounded-lg border px-3 py-2 text-sm">Refresh local index</button>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !index ? <p role="status" className="text-sm text-secondary">Loading authorized local history…</p> : query.trim().length < 2 ? <p className="text-sm text-secondary">Enter two or more characters to search.</p> : <><p role="status" className="text-sm text-secondary">{results.length} matches{results.length === 100 ? " (display limit reached)" : ""}</p><ol className="space-y-2">{results.map(result => <li key={result.mid}><Link to={`/messages?conversation=${result.conversationId}`} className="block rounded-xl border bg-card p-4 hover:border-primary"><p className="text-sm font-semibold">{result.conversationName}</p><p className="mt-1 break-words text-sm">{result.snippet}</p><p className="mt-2 text-xs text-secondary">{result.senderName} · {new Date(result.createdAt).toLocaleString()} · {result.type}</p></Link></li>)}</ol></>}
  </div></main></AppShell>;
}
