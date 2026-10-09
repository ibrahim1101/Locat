# Locat — new chat handoff (2026-10-09)

> Living engineering handoff. Read this alongside [the complete historical journal](DEVELOPMENT_HANDOFF_2026-10-08.md), [project history](PROJECT-HISTORY-AND-HANDOFF.md), and [UI/Emergent handoff](EMERGENT_UI_HANDOFF_2026-10-09.md). Update after every substantial change, failed attempt, fix, and verification. Do not treat an untested feature as working.

## Repository and operational boundaries
- Repository: https://github.com/ibrahim1101/Locat
- Feature/security/backend branch: `feat/locat-1.0`; do not edit UI while Emergent owns its redesign.
- Emergent UI work: proposed isolated `feat/emergent-ui` branch; **not visible on GitHub when checked on 2026-10-09**. Confirm actual branch/commit and compare before merging. Never force-push.
- No local user checkout is required; work directly via GitHub connector. Keep commits small and verify GitHub Actions after the final commit.
- Do **not** deploy to the Raspberry Pi or modify the Pi server/database/environment without explicit user permission. Do not publish secrets.
- Project is an active pre-release, not a finished 1.0 product.

## What was implemented and validated this session
1. Durable encrypted control outbox cleanup: commits `6e7082a`, `20fd4d5`, `1d5ad23`; later simplified to use the existing **atomic** IndexedDB edit/read application + outbox deletion transaction: `18da184`, `474beb7`, `2cf7563`, `5dcf88a`. Avoid reintroducing redundant cleanup.
2. Relay offline replay/partial ack/duplicate ack integration regression: `07a086e`; supporting journal `9216525`. MariaDB integration requires dedicated `TEST_DATABASE_URL` ending `_test`.
3. Sync resilience: `65dd0d3`. Presence and conversation-list refresh errors no longer prevent delivery sync for known conversations; membership refresh still required for unknown conversations.
4. Acknowledgement recovery: `9f17aaf` batches <=500 unique IDs, continues remaining batches on failure, relies on idempotent relay replay. Extracted testable helper `src/lib/deliveryAck.ts` in `c3f57a9`, wired in `33f275a`; tests `src/lib/deliveryAck.test.ts` added in `690973e`, fixed lint in `a1ddb62`/`dcc3f5e`.
5. Local persistence fault injection: `27d0500` added fake IndexedDB clone-failure/replay regression in `src/lib/localdb.test.ts`; documentation `ff9395a`.
6. Engineering journal `docs/DEVELOPMENT_HANDOFF_2026-10-08.md` is append-only history (~50 KB as of this handoff). Preserve previous trials, failures and successes.

## Latest verified checks (as checked 2026-10-09)
- `ff9395a6`: **Locat checks SUCCESS** — https://github.com/ibrahim1101/Locat/actions/runs/37925679932
- `27d0500b`: **Locat Android APK SUCCESS** — https://github.com/ibrahim1101/Locat/actions/runs/37925661829
- Previous failure `c2285c5`: ESLint three unused test mock arguments; **fixed** by `dcc3f5e` (checks and Android build SUCCESS). Do not misreport cancelled superseded workflows as code failures.
- These results apply to the listed commits, not to subsequent documentation commits or an unmerged Emergent UI branch.
- The local persistence fault injection is a unit test, **not** a real Android offline or end-to-end relay fault test.

## Current technical architecture
- React 19 / TypeScript / Vite / Tailwind / Capacitor Android frontend.
- Node / Hono / tRPC / Drizzle / MariaDB backend.
- Browser IndexedDB stores local chat history, durable encrypted outbox, controls and keys; relay holds ciphertext pending recipient acknowledgements.
- Encrypted sends retain stable client IDs/ciphertext on retries; sync uses polling plus SSE where available.
- Tests: `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run doctor` where configured.
- Full product scope, operational notes, past issues, and limitations are in the linked journals.

## Next feature work
1. Add regression coverage for corrupt ciphertext and unavailable/deferred conversation keys. Never acknowledge envelopes until successfully decrypted and durably processed; keep recoverable deliveries on the relay.
2. Test crash/interruption boundaries across decrypt → IndexedDB commit → relay ack, including duplicate SSE + poll arrivals and replay.
3. Check Firefox Android notification/browser behavior and real-device/emulator regressions as user is available.
4. Continue recovery/link-device work only with the documented threat model in `QUICK_SIGN_IN_DESIGN.md`; do not imply end-user completion.
5. Review Emergent screenshots, test actual branch, run CI and check regressions **before** any controlled UI merge.

## Windows Android emulator update (only after APK workflow succeeds)
```powershell
Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" `
  -OutFile "C:\platform-tools\update-locat.ps1"

powershell -NoProfile -ExecutionPolicy Bypass `
  -File "C:\platform-tools\update-locat.ps1"
```
Use `C:\platform-tools\adb.exe -s emulator-5554` when addressing the emulator directly.

## New-chat kickoff
“Continue Locat development from `docs/NEW_CHAT_HANDOFF_2026-10-09.md`, `docs/DEVELOPMENT_HANDOFF_2026-10-08.md` and `docs/EMERGENT_UI_HANDOFF_2026-10-09.md` on GitHub branch `feat/locat-1.0`. Verify latest CI, then implement the next non-UI messaging recovery tests with real commits. Emergent handles UI separately. Do not deploy to Raspberry Pi without my approval. Keep the journals updated and provide emulator commands when testing is needed.”
