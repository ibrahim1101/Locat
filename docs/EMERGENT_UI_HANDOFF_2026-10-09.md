# Locat — Emergent UI design and integration handoff (2026-10-09)

> Design brief and external-agent decision log, **not evidence that Emergent's changes have been committed, tested or merged**. Keep this current as actual screenshots, branches and commits arrive.

## Ownership and branch safety
- User assigned the **UI redesign** to Emergent AI while ChatGPT continues feature/security/backend development on `feat/locat-1.0`.
- Emergent was instructed to branch from `feat/locat-1.0` into `feat/emergent-ui`; branch was **not visible** in GitHub branch listing on 2026-10-09. Verify it exists before reviewing diffs.
- No from-scratch rewrite. Do not change messaging behavior, auth, E2EE, key handling, server, schema, API contracts, component props or user data. Avoid duplicate controls and fake features.
- Do not deploy to Raspberry Pi. UI changes need review, tests and deliberate merge.

## Approved design direction
**Locat — Liquid Titanium × Smoked Glass (balanced gloss).** Premium private messenger, not a cyberpunk dashboard. Clean mobile-first layouts with measured spacing and quiet glass/titanium accents.

Palette and reference tokens:
- `#0A0B0D` canvas; `#111317` secondary; `#17191D` elevated; `#202329` smoked-glass panel; `#343840` borders.
- `#F1F3F5` primary text; `#9DA4AF` secondary; `#D3D8DF` satin silver.
- Subtle steel-blue highlight may be used **sparingly** for focus, online state and selected controls; do not turn the interface blue.
- Brushed titanium/silver **outgoing** message bubbles, smoked-glass **incoming** bubbles, readable contrast.
- Metallic cat-inspired Locat mark/wordmark, compact, no oversized comical branding.
- Soft rounded controls, restrained translucent surfaces, precise typography; avoid over-glow, dense decoration, oversized spacing, redundant navigation and fake functionality.

## Original visual reference
User provided a **wide landscape collage** titled “Locat Final Design Liquid Titanium + Smoked Glass Balanced Gloss” containing mobile splash/login/registration/inbox/chat/privacy, plus desktop layout, settings, calls and profile. Original was uploaded to ChatGPT conversation as `a_wide_dark_themed_showcase_collage_mockup_image.png`. It is a **concept reference**, not a feature specification; conceptual Calls, Forgot Password, Recovery Key, Link Device, etc. must not be presented as functional if not implemented. The actual image is in the conversation attachment, **not** committed into the repository. Do not fabricate a screenshot or assume an unrelated search image is the original.

## Emergent master brief and current phase
- Emergent received a detailed existing-codebase UI-only master prompt (React 19, TS, Vite, Tailwind, Radix, Capacitor; backend Node/Hono/tRPC/Drizzle/MariaDB).
- Existing references: `src/pages/Login.tsx`, `src/pages/Chat.tsx`, `src/components/LocatBrand.tsx`, `src/components/chat/ChatWindow.tsx`, `src/index.css`, `src/lib/appearance.ts`, `docs/OBSIDIAN_UI_REDESIGN.md`, `docs/UI_PROGRESS_2026-10-09.md`.
- Stages: audit, design tokens, brand/auth, drawer/inbox, chat, settings/dialogs, mobile/desktop validation.
- Emergent asked 7 follow-up questions. The assistant recommended the following; **user has not supplied proof of final selections or implementation**, so treat as proposed direction:
  1. ChatWindow restyle: visually redesign bubbles, dividers, search, reply bar and composer; zero logic/prop changes.
  2. Settings/dialogs: apply consistent titanium/glass style to Profile, Privacy, Appearance, Storage while preserving settings.
  3. Responsive validation: screenshots at 360/390/430px mobile, 768px tablet, 1280/1440px desktop; check drawer/inbox, composer, Android safe areas, keyboard, overflow and scrolling.
  4. Message bubbles: option 1 — outgoing brushed titanium/silver gradient, incoming smoked glass.
  5. Accent: option 2 — silver + subtle steel blue for usability.
  6. Execution: option 2 — **ChatWindow first, pause for owner review**, then settings/dialogs; save credits and catch design drift early.
  7. Final validation: option 2 — full testing-agent pass after visual work, if credits permit.
- Earlier onboarding recommendations: allow a separate `feat/emergent-ui` branch; audit and continue with Stage 1 tokens/shared styling only; do not touch feature branch.

## Merge gate / acceptance checklist
1. Obtain actual Emergent branch/PR and compare with current `feat/locat-1.0` (which continues to evolve). Resolve drift carefully; do not overwrite recent reliability fixes.
2. Review mobile and desktop screenshots against reference; verify accessible contrast, no duplicate buttons, no keyboard/composer overlap, scrolling and safe areas.
3. Diff source for forbidden changes to auth, crypto, backend, DB, message semantics, notification logic, outbox, recovery and permissions.
4. Run `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build` and Android workflow where appropriate.
5. Ask owner for approval of visual direction and integration; do not deploy to Pi automatically.
6. Log real screenshots, accepted changes, regressions, failed checks and fixes in this file and `DEVELOPMENT_HANDOFF_2026-10-08.md`.

## Status at handoff
**UI agent working externally; screenshot review pending.** No confirmed Emergent code commit, UI branch or merge at time of this entry. ChatGPT's current commits affect messaging reliability/tests, not the Emergent UI.
