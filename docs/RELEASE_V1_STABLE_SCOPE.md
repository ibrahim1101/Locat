# Locat v1.0 — Stable first-release scope and gates

Decision: 2026-10-14. Development branch: `release/locat-v1.0`. This document supersedes the all-features-at-once release target for **v1.0 only**. The 49-item historical register remains intact and must not be rewritten as completed. Do not merge, publish, remove modules, delete branches, or deploy to an existing host without separate approval.

## Release principle

Preserve all functioning modules and their data, migrations, permissions and interfaces. An unfinished module may remain accessible only if it is safe and clearly marked Preview/Experimental; do not claim it is release-ready. Disable unsafe or misleading entry points rather than deleting underlying implementation. Core messaging and LAN-hosted media must not depend on unfinished optional modules.

## v1.0 release blockers (P0)

- [ ] Fresh CI on exact release head: TypeScript, lint, Vitest, disposable MariaDB integration, Docker smoke, Android and desktop packaging. Record commit SHA and URLs. CI compilation is not device acceptance.
- [ ] Encrypted direct/group chat on two distinct accounts/devices: send/receive, offline reconnect, edit/delete, read receipts, friend/block authorization, identity recovery, logout and server/account isolation.
- [ ] Android signed APK installed/upgraded without deleting original user data; verify permissions, back navigation, screen rotation, background/foreground, audio focus, local Cinema/Music/Photos indexing and permission revocation.
- [ ] Cinema: local video playback, hosted byte-range seek, remux/HLS, startup/quality switches, 4K where device supports it, network loss/reconnect, cancellation, retry exhaustion, resource cleanup. Record actual codecs and hardware; 4K performance is not universally guaranteed.
- [ ] Media library: permission-scoped discovery, categorized and sorted video/photo/audio lists, refresh and no unauthorized cross-device visibility. Where cross-device chat attachment picking is not complete, label it unsupported rather than suggesting it works.
- [ ] Same-LAN Docker/Linux/Raspberry Pi server onboarding without mandatory Tailscale, with a documented trusted HTTPS strategy and fail-closed certificate handling. Do not weaken TLS checks for convenience.
- [ ] Fresh-host installation, persistence across restart, backups/restoration, schema upgrade and rollback rehearsal on disposable test data.
- [ ] Windows desktop runtime acceptance; Linux/macOS packages may be explicitly marked preview until installed and validated on those OSes. Check attachment save consent and cancel behavior.
- [ ] Review authorization boundaries, secret/capability logging, third-party licenses, installation/upgrade instructions, versioning, release checksums and recovery documentation.

## P1 — polish after P0 is green

Responsive full-window UI and accessibility; performance with large libraries and long conversations; music queue/EQ and headset behavior; notification reliability; device media selection within chats where permission-scoped and testable; diagnostics and actionable error states.

## Defer from v1.0 completion requirements

- Passkey login, MFA, voice/video calls, full account closure and multi-device independent message delivery.
- Disappearing/timed/view-limited messages, complete sticker packs/doodles/OS widgets, advanced threading and large chunked encrypted attachments.
- Advanced DSP/exclusive audio, gapless/background native audio, universal codec/HDR guarantees, fully adaptive transcoding ladders, rich artwork/series management.
- Complete Remote Play host/controller/audio/hardware encode stack; full native macOS/Linux capture.
- Expanded Vault/Secrets, Workspace, Calendar/Automate, Share, Extensions, peer-to-peer serverless LAN transport and unimplemented ecosystem roadmap modules.
- Signing/notarization/updaters for OS distributions that are not part of the initially approved release platform list.

Deferred does **not** mean deleted. Preserve source and existing safe functionality; communicate precise limitations in UI and release notes.

## Release decision gate

Do not call v1.0 ready until every P0 item has evidence tied to a release commit, test environment, results and unresolved risks. Any exceptions require explicit user approval and clear public disclosure. Prepare a release candidate only; publication, merges and deployment require separate authorization.

## Immediate engineering queue

1. Fix verified CI failures and add regression tests to Cinema recovery/lifecycle changes.
2. Validate Android media permissions, local indexing and back/background behavior; fix highest-impact reproducible defects.
3. Run disposable-server, LAN-only, cross-account E2EE and media end-to-end acceptance.
4. Produce signed candidate artifacts, checksums and final go/no-go report.
