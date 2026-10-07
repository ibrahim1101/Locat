import { useRef, useState } from "react";
import { prepareProfilePicture } from "@/lib/profilePicture";
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
  const [avatar, setAvatar] = useState(user.avatar ?? null);
  const [usernameVisibility, setUsernameVisibility] = useState(user.usernameVisibility ?? "everyone");
  const [profileVisibility, setProfileVisibility] = useState(user.profileVisibility ?? "everyone");
  const [presenceVisibility, setPresenceVisibility] = useState(user.presenceVisibility ?? "contacts");
  const [preparing, setPreparing] = useState(false);
  const pictureInput = useRef<HTMLInputElement>(null);
  const savePicture = trpc.users.setAvatar.useMutation({
    onSuccess: async () => { await queryClient.invalidateQueries(); },
    onError: error => setFeedback(error.message),
  });
  const update = trpc.users.updateProfile.useMutation({
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      window.location.reload();
    },
    onError: error => setFeedback(error.message),
  });
  const busy = preparing || savePicture.isPending || update.isPending;
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="surface-2 max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>My profile</DialogTitle>
        <DialogDescription>Your name and bio are visible to people on this Locat server.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-4 rounded-xl border p-4">
        <Avatar avatar={avatar} name={displayName || user.displayName} id={user.id} size={56} />
        <div className="min-w-0"><p className="truncate font-semibold">{displayName || user.displayName}</p>
          <p className="text-sm text-secondary">@{user.username}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => pictureInput.current?.click()}>Choose picture</Button>
        <Button disabled={busy || avatar === (user.avatar ?? null)} onClick={() => savePicture.mutate({ avatar }, { onSuccess: () => window.location.reload() })}>Save picture</Button>
        <Button variant="outline" disabled={busy || !avatar} onClick={() => setAvatar(null)}>Remove picture</Button>
      </div>
      <input ref={pictureInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        setPreparing(true); setFeedback("");
        void prepareProfilePicture(file).then(setAvatar).catch(error => setFeedback(error instanceof Error ? error.message : "Could not prepare picture."))
          .finally(() => setPreparing(false));
      }} />
      <p className="text-xs text-secondary">Pictures are cropped to a square. Only a small thumbnail is uploaded, visible to other users on this server. After removing, tap Save picture.</p>
      <div className="space-y-2"><Label htmlFor="profile-name">Display name / nickname</Label>
        <Input id="profile-name" value={displayName} maxLength={64} disabled={busy} onChange={e => setDisplayName(e.target.value)} />
      </div>
      <div className="space-y-2"><Label htmlFor="profile-username">Unique username</Label>
        <Input id="profile-username" value={user.username} readOnly />
        <p className="text-xs text-secondary">Your login username is fixed. Change your nickname above.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-username-visibility">Who can see my login username?</Label>
        <select id="profile-username-visibility" value={usernameVisibility} disabled={busy}
          onChange={event => setUsernameVisibility(event.target.value as typeof usernameVisibility)}
          className="h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="everyone">Everyone on this server</option>
          <option value="contacts">Accepted contacts</option>
          <option value="nobody">Nobody</option>
        </select>
        <p className="text-xs text-secondary">Your nickname and LC code stay visible so people can send requests. Administrators can still see account usernames for safety and support.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-details-visibility">Who can see my picture and bio?</Label>
        <select id="profile-details-visibility" value={profileVisibility} disabled={busy}
          onChange={event => setProfileVisibility(event.target.value as typeof profileVisibility)}
          className="h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="everyone">Everyone on this server</option><option value="contacts">Accepted contacts</option><option value="nobody">Nobody</option>
        </select>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-presence-visibility">Who can see when I am online?</Label>
        <select id="profile-presence-visibility" value={presenceVisibility} disabled={busy}
          onChange={event => setPresenceVisibility(event.target.value as typeof presenceVisibility)}
          className="h-11 w-full rounded-md border bg-background px-3 text-sm">
          <option value="everyone">Everyone on this server</option><option value="contacts">Accepted contacts</option><option value="nobody">Nobody</option>
        </select>
        <p className="text-xs text-secondary">Online status is approximate and only shared while this device is connected.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-code">LC code</Label>
        <div className="flex gap-2"><Input id="profile-code" value={userCode(user.lcCode)} readOnly />
          <Button variant="outline" disabled={!user.lcCode} onClick={() => void navigator.clipboard.writeText(userCode(user.lcCode))
            .then(() => setFeedback("LC code copied."))
            .catch(() => setFeedback("Copy is unavailable. Select and copy the code above."))}>Copy</Button></div>
        <p className="text-xs text-secondary">Share this code to help people find you on this server.</p>
      </div>
      <div className="space-y-2"><Label htmlFor="profile-bio">Bio</Label>
        <textarea id="profile-bio" value={bio} maxLength={280} disabled={busy} onChange={e => setBio(e.target.value)}
          className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm" placeholder="A little about you" />
        <p className="text-xs text-secondary">{bio.length}/280</p>
      </div>
      <Button disabled={busy || !displayName.trim()} onClick={() => void (async () => {
        if (avatar !== (user.avatar ?? null)) await savePicture.mutateAsync({ avatar });
        await update.mutateAsync({ displayName: displayName.trim(), bio, usernameVisibility, profileVisibility, presenceVisibility });
      })().catch(() => {})}>
        {update.isPending ? "Saving…" : "Save profile"}</Button>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent>
  </Dialog>;
}
