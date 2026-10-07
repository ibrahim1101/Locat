import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { userCode } from "@contracts/userCode";
import { downloadBlob } from "@/lib/download";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "./Avatar";

export function FriendProfileDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const profile = trpc.users.profile.useQuery({ userId }, { staleTime: 0, refetchOnWindowFocus: true });
  const download = trpc.users.downloadAvatar.useMutation();
  const [feedback, setFeedback] = useState("");
  const person = profile.data;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="surface-2 max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>{person?.displayName ?? "Profile"}</DialogTitle>
        <DialogDescription>Profile information shared with you.</DialogDescription></DialogHeader>
      {profile.isPending && <p role="status">Loading profile…</p>}
      {profile.error && <p role="alert">{profile.error.message}</p>}
      {person && <>
        {person.avatar ? <img src={person.avatar} alt={`${person.displayName} profile picture`}
          className="mx-auto h-48 w-48 rounded-2xl object-cover" draggable={false} />
          : <div className="mx-auto"><Avatar name={person.displayName} id={person.id} size={96} /></div>}
        {person.username && <p className="text-center text-sm text-secondary">@{person.username}</p>}
        <p className="text-center font-mono text-sm">{userCode(person.lcCode)}</p>
        <div className="rounded-xl border p-4"><p className="mb-2 text-sm font-medium">Bio</p>
          <p className="whitespace-pre-wrap break-words text-sm text-secondary">{person.bio || "No bio shared with you."}</p></div>
        {person.avatar && person.allowAvatarDownload && <Button disabled={download.isPending}
          onClick={() => void download.mutateAsync({ userId }).then(({ avatar, filename }) => {
            const data = Uint8Array.from(atob(avatar.split(",")[1]), character => character.charCodeAt(0));
            downloadBlob(new Blob([data], { type: "image/jpeg" }), filename);
            setFeedback("Picture download started.");
          }).catch(error => setFeedback(error instanceof Error ? error.message : "Could not download picture."))}>
          {download.isPending ? "Preparing…" : "Download profile picture"}</Button>}
        {person.avatar && !person.allowAvatarDownload && <p className="text-xs text-secondary">Picture downloads are disabled by this user.</p>}
      </>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent>
  </Dialog>;
}
