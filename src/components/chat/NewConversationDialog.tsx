import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/state/auth";
import { generateGroupKey, wrapGroupKey } from "@/lib/crypto";
import { Avatar } from "./Avatar";
import type { PublicUser } from "@contracts/types";

export function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversationId: number) => void;
}) {
  const { state } = useAuth();
  const me = state.status === "ready" ? state : null;
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const search = trpc.users.search.useQuery(
    { q: debounced },
    { enabled: open && debounced.length > 0 },
  );
  const createDirect = trpc.conversations.createDirect.useMutation();
  const createGroup = trpc.conversations.createGroup.useMutation();
  const utils = trpc.useUtils();

  const results = useMemo(() => {
    const rows = (search.data ?? []) as PublicUser[];
    return rows.filter((r) => !selected.some((s) => s.id === r.id));
  }, [search.data, selected]);

  async function startDirect(user: PublicUser) {
    setBusy(true);
    setError(null);
    try {
      const res = await createDirect.mutateAsync({ userId: user.id });
      await utils.conversations.list.invalidate();
      onCreated(res.conversationId);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start chat");
    } finally {
      setBusy(false);
    }
  }

  async function startGroup() {
    if (!me || selected.length === 0 || !groupName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const groupKey = await generateGroupKey();
      const myPublic: PublicUser = {
        id: me.user.id,
        username: me.user.username,
        displayName: me.user.displayName,
        publicKey: me.keys.publicKeyB64,
      };
      const all = [myPublic, ...selected];
      const wrappedKeys = await Promise.all(
        all.map(async (m) => ({
          userId: m.id,
          publicKey: m.publicKey,
          wrappedKey: await wrapGroupKey(groupKey, me.keys.privateKey, m.publicKey),
        })),
      );
      const res = await createGroup.mutateAsync({
        name: groupName.trim(),
        memberIds: selected.map((m) => m.id),
        wrappedKeys,
      });
      await utils.conversations.list.invalidate();
      onCreated(res.conversationId);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQ("");
    setSelected([]);
    setGroupName("");
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="surface-2 border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="tracking-tight">New conversation</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-md border bg-background p-1">
          {(["direct", "group"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`h-11 rounded-[4px] text-sm font-medium transition-colors ${
                tab === t ? "surface-3 text-foreground" : "text-secondary hover:text-foreground"
              }`}
            >
              {t === "direct" ? "Direct" : "Group"}
            </button>
          ))}
        </div>

        {tab === "group" && (
          <Input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="h-11 border-input bg-background"
          />
        )}

        <Input
          placeholder="Search people by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 border-input bg-background"
          autoFocus
        />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x.id !== u.id))}
                className="micro-label flex h-11 items-center gap-2 rounded-full border px-3 normal-case tracking-normal hover:border-primary"
                title="Remove"
              >
                {u.displayName} <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}

        <div className="scroll-slim max-h-64 space-y-1 overflow-y-auto">
          {debounced.length === 0 && (
            <p className="micro-label px-1 py-6 text-center normal-case tracking-normal">
              Type a name to find people
            </p>
          )}
          {debounced.length > 0 && results.length === 0 && !search.isLoading && (
            <p className="micro-label px-1 py-6 text-center normal-case tracking-normal">
              No one found for “{debounced}”
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => (tab === "direct" ? void startDirect(u) : setSelected((s) => [...s, u]))}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <Avatar name={u.displayName} id={u.id} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{u.displayName}</span>
                <span className="micro-label block normal-case tracking-normal">@{u.username}</span>
              </span>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {tab === "group" && (
          <Button
            disabled={busy || selected.length === 0 || !groupName.trim()}
            onClick={startGroup}
            className="h-11 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {busy
              ? "Encrypting keys…"
              : `Create group${selected.length > 0 ? ` (${selected.length + 1})` : ""}`}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
