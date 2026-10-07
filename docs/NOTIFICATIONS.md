# Optional background notifications

Locat supports Web Push through the browser's push provider. Notifications are opt-in and show only "New messages on Locat": no message text, contact name, image, or conversation name is sent as a preview. The provider handles push delivery; the Pi needs outbound internet access. Notifications are best effort and do not replace the encrypted message queue.

Subscriptions are bound to the current login session. New login/sign-out disables prior subscriptions. Expired or revoked sessions and disabled accounts are excluded from new pushes. The service worker checks the locally enabled account before displaying a received push. Already transmitted pushes may be delayed by the provider; alerts are generic. Valid pushes display notifications even with a visible Locat window. Firefox limits pushes that do not display notifications; see https://developer.mozilla.org/en-US/docs/Web/API/Push_API.

## Pi setup

After updating, generate keys once, using your contact email:

```bash
cd /opt/locat
sudo -u locat npm run push:setup -- mailto:YOUR_EMAIL_ADDRESS
sudo systemctl restart locat
```

The command saves VAPID keys in `.env` without printing them. Preserve these keys in your secure deployment configuration backup. Regenerating them invalidates browser subscriptions. No registration with a third-party push dashboard is required.

Close all Locat windows and reopen to activate the updated service worker. In Settings, use Background notifications → Enable. Permission must be granted by the browser. Try Send test, then put Locat in the background. If updating an existing Firefox mobile subscription, disable notifications and enable them again before testing. Check both Firefox's site permission and Android's notification permission for Firefox. OS force-stop and battery restrictions can prevent delivery; test background use and closing the app separately.

Android uses a supported HTTPS browser/PWA. On iPhone/iPad (iOS/iPadOS 16.4+), install the app through Safari → Share → Add to Home Screen, then enable notifications from the installed app. Browser support, operating-system power policies, and notification settings affect delivery. See https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/.

For a private Tailscale deployment, an…19491 tokens truncated…sible to other users on this server. After removing, tap Save picture.</p>
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
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={allowAvatarDownload} disabled={busy}
          onChange={event => setAllowAvatarDownload(event.target.checked)} />
        Allow people who can see my picture to download it
      </label>
      <p className="text-xs text-secondary">Turning this off removes Locat’s download option. People who can view your picture can still take screenshots or save it through their browser.</p>
      <div className="space-y-2"><Label htmlFor="profile-bio">Bio</Label>
        <textarea id="profile-bio" value={bio} maxLength={280} disabled={busy} onChange={e => setBio(e.target.value)}
          className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm" placeholder="A little about you" />
        <p className="text-xs text-secondary">{bio.length}/280</p>
      </div>
      <Button disabled={busy || !displayName.trim()} onClick={() => void (async () => {
        if (avatar !== (user.avatar ?? null)) await savePicture.mutateAsync({ avatar });
        await update.mutateAsync({ displayName: displayName.trim(), bio, usernameVisibility, profileVisibility, presenceVisibility, allowAvatarDownload });
      })().catch(() => {})}>
        {update.isPending ? "Saving…" : "Save profile"}</Button>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </DialogContent>
  </Dialog>;
}
