import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";
import { trpc, queryClient } from "@/providers/trpc";
import { userCode } from "@contracts/userCode";
import type { SessionUser } from "@/state/auth";

export function ProfileDialog({ user, open, onOpenChange }: {
  user: SessionUser; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [feedback, setFeedback] = useState("");
  const update = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      window.location.reload();
    },
    onError: error => setFeedback(error.message),
  });
  return <Dialog open={open} onOpenChange={next => { if (!update.isPending) onOpenChange(next); }}>
    <DialogContent className="surface-2 max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>My profile</DialogTitle>
        <DialogDescription>Your name and bio are visible to people on this Locat server.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-4 rounded-xl border p-4">
        <Avatar name={displayName || user.displayName} id={user.id} size={56} />
        <div className="min-w-0"><p className="truncate font-semibold">{displayName || user.displayName}</p>
          <p className="text-sm text-secondary">@{user.username}</p></div>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-name">Display name / nickname</Label>
        <Input id="profile-name" value={displayName} maxLength={64} disabled={update.isPending} onChange={e => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-2"><Label htmlFor="profile-username">Unique username</Label>
        <Input id="profile-username" value={user.username} readOnly />
        <p className="text-xs text-secondary">Your login username is fixed. Change your nickname above.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-code">LC code</Label>
        <div className="flex gap-2"><Input id="profile-code" value={userCode(user.id)} readOnly />
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(userCode(user.id))
            .then(() => setFeedback("LC code copied."))
            .catch(() => setFeedback("Copy is unavailable. Select and copy the code above."))}>Copy</Button></div>
        <p className="text-xs text-secondary">Share this code to help people find you on this server.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-bio">Bio</Label>
        <textarea id="profile-bio" value={bio} maxLength={280} disabled={update.isPending} onChange={e => setBio(e.target.value)}
          className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm" placeholder="A little about you" />
        <p className="text-xs text-secondary">{bio.length}/280</p>
      </div>
      <Button disabled={update.isPending || !displayName.trim()} onClick={() => update.mutate({ displayName: displayName.trim(), bio })}>
        {update.isPending ? "Saving…" : "Save profile"}</Button>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent>
  </Dialog>;
}
