# Emergent security audit — reported summary and Locat verification

Date: 2026-10-09. Source: user's pasted Emergent audit conclusion. The full audit report and tool logs were not exported. **Emergent-reported PASS, not an independent security certification.**

## Reported scope and results
Emergent states that it inspected the full-stack Locat workspace, standalone UI kit, UI branch diff, configuration, schema, and secrets. It reports no critical, high, or medium issues. Reported protections include scoped authorization and admin reauthentication; ECDH P-256 / AES-GCM encryption, PBKDF2 210k backup wrapping and scrypt password hashes; parameterized database queries and validated payloads; HttpOnly SameSite=Lax cookies, mutation origin checks and native CORS; no committed secrets; and UI-only changes on the Emergent branch. These broad claims have **not** all been independently retested.

## Four P3 observations
1. Username enumeration: confirmed in `api/authRouter.ts`. Registration says "Username is taken"; login bypasses password verification for unknown accounts. Follow up with timing equalization and careful registration UX.
2. Per-process rate limiting: Emergent reports local rate limits; assess shared storage before multi-instance hosting.
3. Production Secure cookies: confirmed `api/context.ts` previously allowed `COOKIE_SECURE=false` to override production. **Remediated in commit `47956dd`**, now production always sets Secure. CI verification pending.
4. Password-wrapped identity backup: encourage long unique passwords and password managers. A stolen encrypted backup remains susceptible to offline guesses against weak passwords.

## Evidence and limitations
The exported `locat-ui` tree contains functional UI reports but no standalone security audit report. This document records the user's supplied summary and source spot-checks, not penetration testing. Verify changes against GitHub Actions and test HTTPS/native authentication before deployment. Do not deploy to Raspberry Pi without explicit permission.
