# Locat 2.0 — Security Model and Open Risks
Review date: 2026-10-10. This is an engineering review, not a penetration-test certification.

## Intended architecture
React/TypeScript client-side E2EE using WebCrypto; self-hosted Hono/tRPC API; MariaDB/Drizzle; Capacitor Android. Preserve protocol compatibility and strict HTTPS native onboarding. Existing E2EE implementation needs comprehensive cross-device regression tests.

## Important source-observed risks
### UI app lock is not storage encryption (HIGH priority)
src/lib/appLock.ts stores a salted PBKDF2-SHA256 passcode verifier in localStorage and an unlocked flag in sessionStorage. AppLockGate conditionally renders the interface based on these client-controlled values. Anyone who can manipulate local web storage or inspect local data may bypass the gate; local messages/keys are not encrypted by this new feature. Present it as an additional UI privacy barrier, not hardened device-storage protection. Review credential lifecycle, origin binding, attempt throttling and device-native secure-storage support.

### WebAuthn requires rigorous assertion review (HIGH priority)
The code registers a platform credential and has a local verification helper. Verify that challenge, origin, relying-party ID, authenticator flags and credential binding are validated correctly. Do not infer cryptographic biometric verification solely from a successful navigator.credentials.get() call.

### Plaintext drafts in localStorage (HIGH priority)
src/lib/draft.ts stores composer text in localStorage under locat-draft:<conversationId>. The content is not encrypted at rest; account scoping is not evident from the storage key. Threats include shared-browser exposure, stale drafts after sign-out and cross-account conversation-ID collisions. Prioritize secure design, migration/cleanup and tests.

### Android native file storage (P0 functionality/security)
src/lib/download.ts tries a native folder bridge, then uses a Blob URL and synthetic anchor click. Returning "browser" confirms a click attempt, not a saved file. No native save guarantees; do not display success until verified.

### Notifications
Server push payloads are intended to omit plaintext message content. New code syncs category/quiet-hours preferences into a service worker and dispatches in-app toasts. Validate account switching, muted conversation behavior, stale subscriptions, permission handling, worker lifecycle and platform-native Android background delivery. Do not promise Android push based on browser service-worker tests.

### Link and Sentinel
Link still needs key proof-of-possession, revocation enforcement, replay protection and transfer authorization tests. Sentinel needs webhook-token scope enforcement and end-to-end integration fixtures.

## Release gates
Threat-model review; E2EE compatibility; unit/integration/device tests; CI green; privacy/permissions review; native security plugin validation; no leaked credentials or production deployments.
