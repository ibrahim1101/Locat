# Locat v1.0 — Cross-device media and Android Back implementation contract

Baseline: release/locat-v1.0 from PR #7 application revision f7dd4806. This is a design/acceptance contract, not a claim that the features below are implemented.

## Existing behavior verified in source
- src/pages/MediaLocal.tsx mounts DeviceMediaLibrary for local device media and separately queries server-hosted media libraries/items.
- src/pages/Chat.tsx implements encrypted conversation payloads and file attachment primitives.
- src/App.tsx uses react-router routes. Native Android Back handling must be checked in the Android wrapper and navigation stack, not assumed from browser history.
- PR #7's Android MediaStore library is device-local. Server-hosted media is not a network-wide device index.

## Cross-device media index
- Each device must explicitly opt in per media kind, grant OS permission, choose allowed roots where applicable, and publish only metadata for authorized items.
- Record owner account, device ID, opaque item ID, kind, name, size, MIME, folder hierarchy, duration, availability, permission revision, and freshness. No raw absolute paths or permanent bearer URLs in client results.
- Enforce authorization on listing, search, preview, and each byte-range read; revoke access immediately on logout, device removal, permission withdrawal, or disabled account.
- Avoid scanning other devices by IP or mounting network shares implicitly. Use authenticated Locat device agents and the existing trusted HTTPS server. Local same-LAN operation must not require Tailscale.
- Online device streams bytes directly or through a bounded server relay with short-lived scoped tickets. Offline devices are clearly unavailable. Support pagination, search, sorting, device and folder filters.
- Prevent leaking metadata between accounts or conversation participants; sharing requires explicit selection and recipient-scoped transfer/copy semantics.

## Conversation picker
- Add an attachment menu action: “Search & select video/photo/file”.
- Show only authorized online sources, searchable by device, media type and folder; preview only with appropriate permission; multi-select with size/transfer limits.
- Integrate with existing encrypted attachment workflow, retaining recipient permissions and retry/error handling. Never send a source-device path or ticket as a chat message.
- Distinguish browse, attach/send, and remote-play actions.

## Android Back behavior
- Back closes topmost dialog, picker, keyboard or drawer first; then returns from detail view to parent view; then uses router history.
- From a chat conversation, Back returns to conversation list; from a module, Back returns to its originating page.
- Only at the app root may Back exit (prefer confirmation/double-back); Home remains separate.
- Handle native hardware/system Back and gesture navigation consistently; test Android emulator and physical device, including deep links, app resume, login and offline mode.

## Acceptance gates
1. Windows + Raspberry Pi 5 + Android on same LAN without Tailscale.
2. Opt-in device media discoverable with correct folders, permission changes, search and pagination.
3. Device goes offline or access revoked: previews/streams/attachments fail closed and UI reflects it.
4. A second account cannot enumerate or read unauthorized items; sharing is explicit and scoped.
5. Encrypted chat attachment round-trip from remote device, including cancellation and interrupted transfers.
6. Android Back tests for modal, chat detail, media detail, module, deep link and root.
7. CI: unit/integration tests, MariaDB migrations, Docker smoke, Android APK and Windows/Linux/macOS packaging.
8. Real-device performance tests for large files and 4K; never infer performance from successful compilation.

## Rollout order
1. Inspect existing device identity, Link pairing and media API permissions; close proof-of-possession gaps.
2. Implement schema, authenticated device index API and contract tests.
3. Implement device publisher and scoped streaming with revocation tests.
4. Implement unified Cinema/Music/Photos source selector and chat picker.
5. Implement Android Back stack handling with regression tests.
6. Complete CI and real-device acceptance before release.
