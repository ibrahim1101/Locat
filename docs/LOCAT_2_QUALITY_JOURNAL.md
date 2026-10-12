# Locat 2.0 — Parallel Quality & Integration Log

This living document tracks work performed independently of Emergent's `feat/locat-2.0` branch. Never treat an Emergent milestone report as independent validation.

## 2026-10-10 — Quality lane established

- Base: `feat/locat-1.0` at `3b324ef`.
- Quality branch: `chore/locat-2.0-quality`.
- CI now also targets `feat/locat-2.0` and the quality branch when its workflow is integrated.
- Added official logo integrity guard: Git blob `c465d010524032e1ec9f37b1e9b1c2722c7237cc`, path `public/locat-official-logo.png`.
- Existing CI covers TypeScript, ESLint, crypto regression, full Vitest suite, production build, MariaDB bootstrap, Docker smoke and installer shell validation.
- GitHub Actions quality branch run 37984497936 passed.
- Draft integration PR: https://github.com/ibrahim1101/Locat/pull/2 . **Do not merge while Emergent is actively editing its branch.**
- Published Emergent M0 `a9ed868` and M1 `fbd75b4` were observed on GitHub. M1 has source files for tokens, webhooks, adapters, UI and tests. Reported 137 passing tests are Emergent's own claim, not an independently verified GitHub Actions result.

## Review finding — Sentinel request size enforcement

At M1 `api/sentinel/webhook.ts`, the implementation reads the entire body with `await c.req.text()` and then checks `raw.length > MAX_BODY_BYTES`. JavaScript string length is not UTF-8 byte length, and the body has already been buffered. This does **not** enforce a bounded 64 KiB request body.

Required follow-up on Emergent's active branch:
1. Enforce a bounded streaming read (abort with 413 after exceeding 64 KiB) or enforce an equivalent trusted server/framework byte limit before buffering.
2. Do not trust `Content-Length` alone.
3. Add tests for ASCII 65536/65537-byte boundaries, multibyte Unicode, missing/misleading Content-Length and over-limit streaming requests.
4. Preserve integration-token authorization, rate limiting and existing incident behavior.

## Integration acceptance gate

- [ ] Emergent finishes and publishes M2 commits.
- [ ] Inspect the actual M2 code and crypto design; no invented P2P/LAN guarantees.
- [ ] Verify official logo blob remains unchanged.
- [ ] Run independent CI on the final M2 branch.
- [ ] Confirm Capacitor remains supported and no Expo migration was introduced.
- [ ] Verify auth/E2EE, device pairing authorization, token revocation, rate limits, transfer cancellation and failure handling.
- [ ] Review draft quality PR for conflicts and merge only after explicit approval.
- [ ] Document failed checks, fixes, test evidence and any accepted limitations.
- [ ] No Raspberry Pi/production deployment without explicit authorization.

## Change policy

This quality branch may change CI, test-only files and engineering documentation. Avoid editing Emergent-owned frontend, Sentinel, Link, Vault or schema files in parallel. Keep a chronological record of failures as well as successes.
