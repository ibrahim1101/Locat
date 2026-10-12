# Native chat storage isolation

Android and desktop shells use one local WebView origin for multiple Locat
hosts. Numeric user, conversation and message IDs can overlap across hosts;
account ID alone is not an adequate native storage boundary.

Native chat IndexedDB databases now include the canonical HTTPS server origin
and account ID. The entire store is isolated: messaging identity, Link device
keys, messages/controls, hidden conversations, unread metadata, conversation
cache, encrypted drafts/recovery copies and durable outbox. The offline-account
pointer also includes the server origin. Offline bootstrap verifies the cached
public key against the stored public identity before opening a session.

A runtime binds to its first storage origin. If a server address changes in
that running instance, further storage operations fail closed until restart.
The existing server setup reloads after changing address and clears the old
bearer credential. This prevents delayed work from silently writing into the
new server's database. Returning to the same canonical server after restart
restores its existing scoped archive. LAN/Tailscale DNS routes must retain the
same hostname; distinct origin aliases intentionally remain distinct stores.

Browser databases retain their existing account names and migration behavior
because the browser already isolates different website origins. Backup account
metadata now uses the actual server origin, including inside native shells;
it no longer substitutes the shared shell origin. Wrong-origin/account backup
imports remain rejected.

## Upgrade behavior and limitations

Old native `locat-account-*` and `relaychat` databases lack trustworthy server
ownership metadata. They are left untouched and are not automatically imported
or used for key lookup. The old unscoped offline pointer is ignored. Existing
users may need to restore keys from their server backup with their password;
old local history does not automatically appear in the new scoped store.

No migration/export UI for unassigned old native archives is implemented yet.
Old backups labelled with the shell origin require audited ownership mapping;
the application does not relax origin checks to import them. Do not clear
app data, uninstall or wipe these preserved stores during migration work.
The upgrade is an isolation correction, not a claim of transparent legacy
archive migration or OS keystore/biometric support. Device-wide appearance,
app-lock and some notification preferences remain device-wide; this change
specifically scopes native chat data and identities.

Four regression cases exercise real IndexedDB structured clones: overlapping
IDs across hosts for identity/device keys/history/privacy/outbox; canonical
origin/restart recovery; hot-switch rejection; untouched unassigned archives;
and unchanged browser names. Physical Android/desktop upgrade, offline login
and user-archive recovery acceptance remain pending.
