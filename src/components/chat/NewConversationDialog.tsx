import { userCode } from "@contracts/userCode";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/state/auth";
import { generateGroupKey, wrapGroupKey } from "@/lib/crypto";
import { Avatar } from "./Avatar";
import { FriendProfileDialog } from "./FriendProfileDialog";
import type { PublicUser } from "@contracts/types";

type Tab = "friends" | "people" | "requests" | "group";

export function NewConversationDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (value: boolean) => void; onCreated: (conversationId: number) => void;
}) {
  const { state } = useAuth();
  const me = state.status === "ready" ? state : null;
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [debounced, setDebounced] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const search = trpc.users.search.useQuery({ q: debounced }, { enabled: open && debounced.length > 0 });
  const contacts = trpc.users.contacts.useQuery(undefined, { enabled: open });
  const requests = trpc.users.contactRequests.useQuery(undefined, { enabled: open });
  const requestContact = trpc.users.requestContact.useMutation();
  const respondContact = trpc.users.respondContact.useMutation();
  const removeContact = trpc.users.removeContact.useMutation();
  const createDirect = trpc.conversations.createDirect.useMutation();
  const createGroup = trpc.conversations.createGroup.useMutation();
  const contactIds = useMemo(() => new Set((contacts.data ?? []).map(row => row.id)), [contacts.data]);
  const requestByUser = useMemo(() => new Map((requests.data ?? []).map(row => [row.user.id, row])), [requests.data]);
  const results = useMemo(() => ((search.data ?? []) as PublicUser[]).filter(row => !selected.some(item => item.id === row.id)), [search.data, selected]);
  const incomingCount = (requests.data ?? []).filter(row => row.direction === "incoming").length;
  const filteredContacts = useMemo(() => (contacts.data ?? []).filter(person =>
    `${person.displayName} ${person.username ?? ""} ${userCode(person.lcCode!)}`.toLocaleLowerCase().includes(friendQuery.trim().toLocaleLowerCase())
  ), [contacts.data, friendQuery]);

  async function refreshPeople() { await Promise.all([utils.users.contacts.invalidate(), utils.users.contactRequests.invalidate()]); }
  async function run(id: number, action: () => Promise<unknown>, fallback: string) {
    setBusyId(id); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : fallback); }
    finally { setBusyId(null); }
  }
  async function startDirect(user: PublicUser) {
    await run(user.id, async () => {
      const result = await createDirect.mutateAsync({ userId: user.id });
      await utils.conversations.list.invalidate(); onCreated(result.conversationId); onOpenChange(false);
    }, "Could not start this chat.");
  }
  async function startGroup() {
    if (!me || selected.length === 0 || !groupName.trim()) return;
    await run(0, async () => {
      const groupKey = await generateGroupKey();
      const myself: PublicUser = { id: me.user.id, username: me.user.username, displayName: me.user.displayName,
        bio: me.user.bio, lcCode: me.user.lcCode, publicKey: me.keys.publicKeyB64 };
      const wrappedKeys = await Promise.all([myself, ...selected].map(async member => ({ userId: member.id,
        publicKey: member.publicKey, wrappedKey: await wrapGroupKey(groupKey, me.keys.privateKey, member.publicKey) })));
      const result = await createGroup.mutateAsync({ name: groupName.trim(), memberIds: selected.map(member => member.id), wrappedKeys });
      await utils.conversations.list.invalidate(); onCreated(result.conversationId); onOpenChange(false);
    }, "Could not create this group.");
  }
  function person(user: PublicUser, actions: ReactNode) {
    return <div key={user.id} className="flex min-h-14 items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <Avatar avatar={user.avatar} name={user.displayName} id={user.id} size={36} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.displayName}</span>
        <span className="micro-label block normal-case tracking-normal">{user.username ? `@${user.username} · ` : ""}{userCode(user.lcCode!)}</span></span>
      <span className="flex shrink-0 gap-2">{actions}</span>
    </div>;
  }
  function reset() { setTab("friends"); setQuery(""); setFriendQuery(""); setSelected([]); setGroupName(""); setError(null); }

  return <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) reset(); }}>
    <DialogContent className="emergent-locat-surface max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto rounded-2xl sm:max-w-lg">
      <DialogHeader><DialogTitle>People and conversations</DialogTitle></DialogHeader>
      <div className="grid grid-cols-4 gap-1 rounded-lg border bg-background p-1" role="tablist" aria-label="Conversation options">
        {(["friends", "people", "requests", "group"] as const).map(item => <button key={item} type="button" role="tab" aria-selected={tab === item}
          onClick={() => { setTab(item); setError(null); }} className={`min-h-11 rounded-md px-2 text-sm font-medium ${tab === item ? "surface-3 text-foreground" : "text-secondary hover:text-foreground"}`}>
          {item === "friends" ? "Friends" : item === "people" ? "People" : item === "requests" ? `Requests${incomingCount ? ` (${incomingCount})` : ""}` : "Group"}
        </button>)}
      </div>
      {tab !== "requests" && tab !== "friends" && <Input aria-label={tab === "group" ? "Find group members" : "Find people"}
        placeholder="Name, username or LC-1234…" value={query} onChange={event => setQuery(event.target.value)} className="h-11 border-input bg-background" autoFocus />}
      {tab === "group" && <Input aria-label="Group name" placeholder="Group name" value={groupName}
        onChange={event => setGroupName(event.target.value)} className="h-11 border-input bg-background" />}

      <div className="scroll-slim max-h-[min(55vh,28rem)] space-y-2 overflow-y-auto pr-1">
        {tab === "friends" && <>
          <Input aria-label="Search your friends" placeholder="Search your accepted friends…" value={friendQuery} onChange={event => setFriendQuery(event.target.value)} className="h-11 border-input bg-background" />
          <p className="micro-label px-1 normal-case tracking-normal">Your contacts</p>
          {contacts.isLoading && <p className="px-1 py-6 text-center text-sm text-secondary">Loading contacts…</p>}
          {!contacts.isLoading && !contacts.data?.length && <p className="px-1 py-6 text-center text-sm text-secondary">No friends yet. Open People to find someone and send a request.</p>}
          {filteredContacts.length === 0 && friendQuery.trim() && <p className="px-1 py-3 text-sm text-secondary">No matching friends.</p>}
          {filteredContacts.map(user => person(user as PublicUser, <><Button size="sm" variant="outline" onClick={() => setProfileUserId(user.id)}>Profile</Button><Button size="sm" disabled={busyId === user.id} onClick={() => void startDirect(user as PublicUser)}>Chat</Button>
            <Button size="sm" variant="outline" disabled={busyId === user.id} onClick={() => { if (window.confirm(`Remove ${user.displayName} from your contacts? Existing chat history stays on both devices.`))
              void run(user.id, async () => { await removeContact.mutateAsync({ userId: user.id }); await refreshPeople(); }, "Could not remove contact."); }}>Remove</Button></>))}
        </>}
        {tab === "people" && <>
          {search.isLoading && <p className="py-6 text-center text-sm text-secondary">Searching…</p>}
          {!search.isLoading && results.length === 0 && <p className="py-6 text-center text-sm text-secondary">No people found for “{debounced}”.</p>}
          {results.map(user => { const pending = requestByUser.get(user.id); return person(user, contactIds.has(user.id)
            ? <Button size="sm" disabled={busyId === user.id} onClick={() => void startDirect(user)}>Chat</Button>
            : pending?.direction === "incoming" ? <Button size="sm" disabled={busyId === user.id} onClick={() => void run(user.id, async () => {
                await respondContact.mutateAsync({ requestId: pending.id, accept: true }); await refreshPeople(); }, "Could not accept request.")}>Accept</Button>
            : pending ? <Button size="sm" variant="outline" disabled>Requested</Button>
            : <Button size="sm" disabled={busyId === user.id} onClick={() => void run(user.id, async () => {
                await requestContact.mutateAsync({ userId: user.id }); await refreshPeople(); }, "Could not send request.")}>Add</Button>); })}
        </>}
        {tab === "requests" && <>
          {requests.isLoading && <p className="py-6 text-center text-sm text-secondary">Loading requests…</p>}
          {!requests.isLoading && !requests.data?.length && <p className="py-6 text-center text-sm text-secondary">No pending friend requests.</p>}
          {(requests.data ?? []).map(request => person(request.user as PublicUser, request.direction === "incoming" ? <>
            <Button size="sm" disabled={busyId === request.user.id} onClick={() => void run(request.user.id, async () => {
              await respondContact.mutateAsync({ requestId: request.id, accept: true }); await refreshPeople(); }, "Could not accept request.")}>Accept</Button>
            <Button size="sm" variant="outline" disabled={busyId === request.user.id} onClick={() => void run(request.user.id, async () => {
              await respondContact.mutateAsync({ requestId: request.id, accept: false }); await refreshPeople(); }, "Could not decline request.")}>Decline</Button>
          </> : <Button size="sm" variant="outline" disabled={busyId === request.user.id} onClick={() => void run(request.user.id, async () => {
            await removeContact.mutateAsync({ userId: request.user.id }); await refreshPeople(); }, "Could not cancel request.")}>Cancel</Button>))}
        </>}
        {tab === "group" && <>
          {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(user => <button key={user.id} type="button"
            onClick={() => setSelected(items => items.filter(item => item.id !== user.id))} className="min-h-11 rounded-full border px-3 text-sm hover:border-primary">{user.displayName} ×</button>)}</div>}
          {!debounced && <p className="py-6 text-center text-sm text-secondary">Search for people to add to the group.</p>}
          {debounced && !search.isLoading && results.length === 0 && <p className="py-6 text-center text-sm text-secondary">No people found.</p>}
          {results.map(user => person(user, <Button size="sm" variant="outline" disabled={busyId !== null}
            onClick={() => setSelected(items => [...items, user])}>Select</Button>))}
        </>}
      </div>
      {(contacts.isError || requests.isError || search.isError) && <p role="alert" className="text-sm text-destructive">Could not load people. Check your connection and try again.</p>}
      {profileUserId !== null && <FriendProfileDialog userId={profileUserId} onClose={() => setProfileUserId(null)} />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {tab === "group" && <Button disabled={busyId !== null || selected.length === 0 || !groupName.trim()} onClick={() => void startGroup()} className="h-11">
        {busyId === 0 ? "Encrypting keys…" : `Create group${selected.length ? ` (${selected.length + 1})` : ""}`}</Button>}
    </DialogContent>
  </Dialog>;
}
