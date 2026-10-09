import { useState } from "react";
import type { ConversationSummary, PublicUser } from "@contracts/types";
import { useAuth } from "@/state/auth";
import { trpc } from "@/providers/trpc";
import { generateGroupKey, wrapGroupKey } from "@/lib/crypto";
import { kvGet, kvSet } from "@/lib/localdb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "./Avatar";
import { FriendProfileDialog } from "./FriendProfileDialog";

export function GroupDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: ConversationSummary;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { state } = useAuth();
  const me = state.status === "ready" ? state : null;
  const owner = conversation.createdBy === me?.user.id;
  const [name, setName] = useState(conversation.name ?? "Group");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [members, setMembers] = useState<PublicUser[]>(conversation.members);
  const [search, setSearch] = useState(""),
    [newOwner, setNewOwner] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const results = trpc.users.search.useQuery(
    { q: search },
    { enabled: open && owner && search.trim().length > 0 }
  );
  const update = trpc.conversations.updateGroup.useMutation(),
    leave = trpc.conversations.leaveGroup.useMutation(),
    transfer = trpc.conversations.transferGroup.useMutation();
  const utils = trpc.useUtils();
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setFeedback("");
    try {
      await task();
      await utils.conversations.list.invalidate();
      onOpenChange(false);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not update this group."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="emergent-locat-surface max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Group details</DialogTitle>
          <DialogDescription>
            {conversation.archived
              ? "You are no longer a member. Saved history remains on this device."
              : owner
                ? "Manage members and rotate encryption keys."
                : "Only the owner can change the name or membership."}
          </DialogDescription>
        </DialogHeader>
        {conversation.rotationRequired && !conversation.archived && (
          <p role="alert" className="text-sm text-destructive">
            A member left. Sending is paused until the owner saves a fresh group
            key.
          </p>
        )}
        <label className="space-y-2 text-sm">
          Group name
          <Input
            value={name}
            maxLength={64}
            onChange={e => setName(e.target.value)}
            disabled={!owner || busy || conversation.archived}
          />
        </label>
        <div className="space-y-2">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setProfileId(member.id)}
                aria-label={`View ${member.displayName}'s profile`}>
                <Avatar avatar={member.avatar} name={member.displayName} id={member.id} size={38} />
                <div>
                <p className="text-sm font-medium">
                  {member.displayName}
                  {member.id === conversation.createdBy ? " · Owner" : ""}
                </p>
                {member.username && <p className="text-xs text-secondary">@{member.username}</p>}
                </div>
              </button>
              {owner && member.id !== me?.user.id && !conversation.archived && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    setMembers(members.filter(m => m.id !== member.id))
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {owner && !conversation.archived && (
          <>
            <Input
              aria-label="Find a group member to add"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts to add…"
              maxLength={64}
            />
            <div className="space-y-2">
              {results.data
                ?.filter(row => !members.some(m => m.id === row.id))
                .map(row => (
                  <Button
                    key={row.id}
                    variant="outline"
                    className="w-full justify-start"
                    disabled={busy || members.length >= 51}
                    onClick={() => {
                      setMembers([...members, row]);
                      setSearch("");
                    }}
                  >
                    <span className="min-w-0 text-left">
                      <span className="block">Add {row.displayName}{row.username ? ` (@${row.username})` : ""}</span>
                      {row.bio && <span className="block truncate text-xs text-secondary">{row.bio}</span>}
                    </span>
                  </Button>
                ))}
            </div>
            <p className="text-xs text-secondary">
              Saving generates a fresh group key for the selected members. New
              members receive no earlier group keys. Removed members keep
              already saved copies, but cannot receive future messages.
            </p>
            <Button
              disabled={busy || !name.trim()}
              onClick={() =>
                void perform(async () => {
                  if (!me) return;
                  const fresh = await utils.users.keys.fetch({
                    ids: members.map(m => m.id),
                  });
                  if (fresh.length !== members.length)
                    throw new Error(
                      "A member is unavailable. Refresh this group."
                    );
                  const mine = fresh.find(m => m.id === me.user.id);
                  if (mine?.publicKey !== me.keys.publicKeyB64)
                    throw new Error(
                      "Your identity changed. Sign in again before updating group keys."
                    );
                  for (const member of fresh.filter(m => m.id !== me.user.id)) {
                    const known = await kvGet<string>(
                      me.user.id,
                      `contact-key-${member.id}`
                    );
                    if (known && known !== member.publicKey)
                      throw new Error(
                        "A contact key changed. Verify it in Encryption details before updating this group."
                      );
                    if (!known)
                      await kvSet(
                        me.user.id,
                        `contact-key-${member.id}`,
                        member.publicKey
                      );
                  }
                  const key = await generateGroupKey();
                  const wrappedKeys = await Promise.all(
                    fresh.map(async member => ({
                      userId: member.id,
                      publicKey: member.publicKey,
                      wrappedKey: await wrapGroupKey(
                        key,
                        me.keys.privateKey,
                        member.publicKey
                      ),
                    }))
                  );
                  await update.mutateAsync({
                    conversationId: conversation.id,
                    expectedEpoch: conversation.groupEpoch ?? 1,
                    name: name.trim(),
                    memberIds: fresh.map(m => m.id),
                    wrappedKeys,
                  });
                })
              }
            >
              {busy ? "Working…" : "Save members & rotate key"}
            </Button>
            <div className="space-y-2 border-t pt-3">
              <label className="text-sm">
                Transfer ownership
                <select
                  aria-label="New group owner"
                  className="mt-2 w-full rounded-lg border bg-background p-2"
                  value={newOwner}
                  onChange={e => setNewOwner(e.target.value)}
                >
                  <option value="">Choose a current member</option>
                  {conversation.members
                    .filter(m => m.id !== me?.user.id)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <Button
                variant="outline"
                disabled={busy || !newOwner}
                onClick={() => {
                  if (
                    window.confirm(
                      "Transfer ownership? Only the new owner will be able to manage this group."
                    )
                  )
                    void perform(async () => {
                      await transfer.mutateAsync({
                        conversationId: conversation.id,
                        ownerId: Number(newOwner),
                      });
                    });
                }}
              >
                Transfer ownership
              </Button>
            </div>
          </>
        )}
        {owner &&
          !conversation.archived &&
          conversation.members.length === 1 && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Close this group with only you? Saved history stays on this device."
                  )
                )
                  void perform(async () => {
                    await leave.mutateAsync({
                      conversationId: conversation.id,
                    });
                  });
              }}
            >
              Close empty group
            </Button>
          )}
        {!owner && !conversation.archived && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Leave this group? Saved history stays here. Sending will pause until the owner rotates the key."
                )
              )
                void perform(async () => {
                  await leave.mutateAsync({ conversationId: conversation.id });
                });
            }}
          >
            Leave group
          </Button>
        )}
        {feedback && (
          <p role="alert" className="text-sm text-destructive">
            {feedback}
          </p>
        )}
        {profileId !== null && <FriendProfileDialog key={profileId} userId={profileId} onClose={() => setProfileId(null)} />}
      </DialogContent>
    </Dialog>
  );
}
