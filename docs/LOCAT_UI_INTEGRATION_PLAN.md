# Emergent UI integration: compatibility gate (2026-10-09)

## Source of truth
- Visual kit: `ibrahim1101/locat-ui` `main`, commit `6b57128`, directory `locat-ui/`.
- Working messaging app: this repository, `feat/locat-1.0`.
- Existing `src/pages/Chat.tsx`, `src/state/auth`, `src/lib/crypto.ts`, `src/lib/localdb.ts`, `src/providers/trpc` and server API are the **only** owners of authentication, encryption, delivery ACK, replay, and persistence.
- Do not transplant Emergent's Expo, Python/FastAPI/MongoDB shell or its mock adapter into the production app.

## Verified kit structure
- `locat-ui/src/screens`, `components`, `theme`, `adapter.ts`, `types.ts`, `live/TrpcLocatAdapter.ts`, and `docs/LOCAT_INTEGRATION.md` are present.
- The standalone kit uses React 19, TypeScript, Vite, Tailwind and Lucide, compatible in principle with this frontend's technology.
- The kit's `App.tsx` defaults to `MockLocatAdapter`; do not mount that app in production.
- The provided `TrpcLocatAdapter` is a **skeleton**, not a production bridge. It contains unimplemented encrypted history, edit, hidden-message and realtime flows; `deleteMessage` currently returns without action. Its `messages.ack` mapping is not a substitute for encrypted read receipts or relay delivery ACK; procedure names and input shapes must be checked against actual routers.
- Do not assume its sign-in/register methods unlock identity keys, or that `messages.send` accepts plaintext/payload objects: existing crypto and outbox flow must remain authoritative.

## Safe migration sequence
1. Copy only presentation components and CSS/tokens into an isolated integration area, retaining their original provenance. Do not change `App.tsx` routing or `Chat.tsx` message processing yet.
2. Create presentation-only wrappers around the existing authenticated ChatApp state and callbacks. Use real `LocalMessage` and `ConversationSummary` as source, mapping to UI-only props without storing duplicate secrets or plaintext outside IndexedDB.
3. Integrate sign-in screen through the existing `Login` and `useAuth` key-unlock path; never use mock credentials.
4. Replace chat list and window presentation only, preserving current encrypted send, outbox, SSE/poll serialization, local storage, group epoch handling, read/control processing and ACK boundaries.
5. Replace contacts, group creation and settings one surface at a time, preserving key wrapping, privacy and backup semantics.
6. Remove all mock imports from production entrypoints; retain the kit as an isolated visual fixture if needed.
7. Validate `npm run check`, `npm run lint`, `npm test`, `npm run build` and GitHub Android APK workflow. Manually test Android keyboard/safe areas, Firefox mobile, offline/reconnect, group rotation, attachment delivery, edits/deletes, read receipts, profile and backup.

## Stop conditions
- Any mock session/data appears in production.
- A message is ACKed before durable decrypt/store/control processing.
- The new UI bypasses identity key unlock or replaces ciphertext-only transport.
- Real actions silently no-op (notably delete/edit).
- Existing Android package ID, auth origins, push service or Raspberry Pi deployment settings change unexpectedly.

No deployment to Raspberry Pi without explicit user permission. This document is a compatibility plan, not a claim of completed UI integration.
