# Locat — self-hosted encrypted messaging

Locat lets you run a private messaging server on a Raspberry Pi, Linux computer or Docker host. Friends connect using your server's HTTPS address. Content is encrypted on the device before sending; chat history stays on each device. The server stores accounts, public keys, memberships and other metadata, plus encrypted messages waiting for delivery.

**Start here: [complete beginner installation guide](docs/INSTALLATION.md).** It explains where commands go, what each person installs, how to verify setup and how to fix common problems.

## Choose your installation

| Goal | Instructions |
|---|---|
| Raspberry Pi | [OS preparation and automatic installer](docs/INSTALLATION.md#2-raspberry-pi-install-the-server) |
| Ubuntu/Debian without a Pi | [Database, Node and startup service](docs/INSTALLATION.md#3-ubuntudebian-without-a-pi-or-docker) |
| Docker on Linux/Windows/macOS | [Docker, Compose, credentials and storage](docs/INSTALLATION.md#4-docker-app-and-database-together) |
| Private HTTPS | [Tailscale installation and Serve](docs/INSTALLATION.md#5-host-make-a-private-https-address-with-tailscale) |
| Invite friends remotely | [Sharing and accepting access step by step](docs/INSTALLATION.md#6-host-and-friend-share-access-from-another-house) |
| Phone shortcut/notifications | [Android and iPhone](docs/INSTALLATION.md#7-install-the-phone-shortcut-and-optional-notifications) |
| Backups and updates | [Preserving accounts and local history](docs/INSTALLATION.md#8-backups-updates-and-stopping-the-server) |
| Problems | [Troubleshooting](docs/INSTALLATION.md#9-if-something-does-not-work) |

Only the host installs Locat's server/database. Friends install Tailscale for private access, accept a machine-share invitation, then open the full HTTPS URL and create their own Locat account. Tailscale and Locat accounts are separate; never share the host's credentials.

## Development status

Locat 1.0 is being developed on `feat/locat-1.0`; it is not a finished release. The guide explicitly selects this branch for people intentionally testing development, rather than silently replacing existing deployments.

Features include direct/group messaging, account-local history, encrypted history archives, profile avatars/nickname/bio, fixed four-digit LC numbers unique within the server, edit/delete controls, encrypted read receipts, blocking, administrator tools and optional generic Web Push. Newer features still require device acceptance; see [the verification record](docs/LOCAT-1.0-PLAN.md).

Friend requests, expanded privacy, stronger registration password rules, a complete UI redesign and an Android APK are planned. Do not expect Add friend/Accept/Decline or an APK download in the current build.

## Storage and encryption

| Data | Device | Server |
|---|---|---|
| Private identity key | Used locally | Password-encrypted backup |
| History/media | Account-scoped IndexedDB | Transient ciphertext, removed after all recipient ACKs |
| Accounts/public profiles | Cached | Persistent MariaDB metadata |
| Encryption | ECDH P-256, HKDF, AES-GCM | Opaque encrypted envelopes |
| Groups | Wrapped versioned group keys | Memberships and wrapped keys |

Verify fingerprints through another trusted channel. Public keys are pinned on first use; changed keys require review. Group changes rotate keys; leaving can pause sending until the owner rotates the key. Delivery ACKs and opt-in encrypted read receipts are separate.

## Limits to understand

- Local history is not encrypted at rest. Clearing site data can erase it; export encrypted archives regularly. Signing in on a new device restores identity, not old history.
- One active login per account; reliable independent per-device delivery is not implemented.
- No Signal-style double ratchet/forward secrecy. Operators see metadata and control delivered web code.
- Edit/delete need updated clients and cannot recall external copies, former members' history or old backups. Blocking retains history and cannot recall already accepted traffic.
- HTTPS and an online host are required for messaging. Private endpoints require connected Tailscale clients. Notifications depend on browser/OS support and are best effort.
- Pi and friend Tailscale access have user-reported acceptance. Expanded generic Linux and Windows/macOS Docker recipes still need fresh-host testing.

## More documentation

- **[Project history, failures, fixes and new-chat handoff](docs/PROJECT-HISTORY-AND-HANDOFF.md)** — living editable engineering journal (updated 2026-10-08)

- [Pi preservation and public HTTPS](docs/RASPBERRY_PI.md)
- [Cross-platform hosting](docs/CROSS_PLATFORM.md)
- [Administration and recovery](docs/SERVER_ADMIN.md)
- [Notifications](docs/NOTIFICATIONS.md)
- [Groups](docs/GROUPS.md)
- [Message controls](docs/MESSAGE-CONTROLS.md)
- [Roadmap](docs/LOCAT-1.0-PLAN.md)

## Developer checks

Use Node 22.12+ or a supported Node 24+ version:

```bash
npm ci
npm run check
npm run lint
npm test
npm run build
```

MariaDB integration is opt-in locally and provisioned in CI:

```bash
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/locat_test npm test
```

**Integration tests drop tables. Use a disposable database ending in `_test`, never the real database.** Native configuration starts with `.env.example`; Docker uses different variables explained in the guide.

## License

Locat is free and open-source software licensed under the **GNU General Public License v3.0 (GPL-3.0-only)**, matching nScout's GPLv3 license. See [LICENSE](LICENSE) for the full terms.

Copyright © 2026 Shaik Ibrahim. Third-party dependencies retain their own licenses.
