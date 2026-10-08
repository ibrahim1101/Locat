# Locat — Liquid Titanium and Smoked Glass redesign

Status: **Liquid Titanium + Smoked Glass approved; implementation in progress**. Target branch: `feat/locat-1.0`. GitHub-only development, no local checkout required.

## Product brief
Premium privacy-first messenger with deep liquid-titanium black surfaces, balanced smoked-glass panels, satin-silver highlights, low-noise borders, precise spacing, and discreet cat-inspired Locat identity. The only user-facing product name is **Locat**. Keep it recognizable and calm, not neon/cyberpunk. Preserve existing app workflows and behavior.

## Visual system
- Liquid Titanium canvas `#0a0b0d`; raised surface near `#15171b`; muted panels near `#22252a`; restrained titanium separators.
- Silver primary action, graphite hover, cool-white foreground, slate secondary text. Balanced gloss uses subtle inset highlights rather than distracting reflections. Verify contrast on actual surfaces; avoid low-contrast olive text on pale surfaces.
- Radius: 12px baseline; 16–20px for large cards, 999px for pills. Compact but generous 44px+ touch targets.
- Typographic hierarchy: legible system/Inter stack, 14–16px body, 20–28px section headings; reserve monospaced labels for technical fingerprints.
- Motion: 120–220ms transitions for hover, navigation, drawers; respect `prefers-reduced-motion`. No animated gradients behind conversation text.
- Preserve light theme and existing accent preferences; make Olive the default, never force a previously saved preference.

## Implementation stages and acceptance gates

### 0. Audit / safety baseline
- Inventory app entry, login/restore, conversation list, chat composer, groups, friends, profile, security, storage, settings, admin and native server setup.
- Capture existing component APIs, state transitions, responsive breakpoints, data-testid hooks and any tests.
- Avoid changes to `api/`, `db/`, `src/lib/crypto.ts`, delivery/receipt handling, authentication state, local message storage or encryption contracts in visual-only commits.
- CI gates: TypeScript, lint, unit tests, production build, Docker smoke. Device/browser visual acceptance later.

### 1. Shared design foundation (first implementation)
- Replace legacy teal/navy default tokens with Liquid Titanium / Smoked Glass in `src/index.css`.
- Add reusable surface, focus and message-shell utilities without removing existing class names.
- Preserve safe-area, Android status bar, text input zoom prevention and reduced-motion behavior.
- Add token regression tests checking essential tokens and safeguards.

### 2. Authentication and onboarding
- Brand panel, clear sign-in/create-account states, accessible field labels/errors, password visibility, password recovery explanation, native server connection state.
- Key restore remains explicit; no recovery key or link-device buttons until secure endpoints are shipped.
- Mobile keyboard avoidance and 320px minimum layout acceptance.

### 3. Desktop shell and mobile navigation
- Desktop 3-pane option (rail / conversation list / chat) and mobile single-pane flow with predictable back navigation.
- Search, unread counts, online indicators, archived/hidden chats, friends tab and new-conversation affordance.
- Test chat switching and list persistence with existing state unchanged.

### 4. Conversation view
- Refine bubble shapes, timestamps, read receipts, message status, day dividers, attachments, voice notes, images and errors.
- Composer retains keyboard shortcuts, upload controls, draft behavior, optimistic send, retries, encryption and delivery semantics.
- Validate long text, RTL, image/file, group, and failed-send cases.

### 5. Profiles, groups, settings and security
- Unified modal/drawer surfaces, consistent fields, controls and confirmation hierarchy.
- Privacy dashboard groups current capabilities accurately; unreleased Recovery Key / Link Device flows must not appear as functioning features.
- Settings include appearance preview and reduced-motion compatibility; do not regress browser and native preferences.

### 6. Polish and release validation
- Loading/empty/offline/error states, keyboard navigation, screen-reader labels, focus order and contrast.
- Cross-device QA: desktop Chromium/Firefox, Android WebView, Firefox Android; narrow widths, tall screens and OS font scaling.
- Performance: no large blur effects over scrolling lists; avoid layout shift and unnecessary re-renders.
- Security regression: send/receive E2EE direct and group, attachment/voice, identity restore, push/presence, receipts, hidden chats, session behavior.
- Deploy to Pi and emulator **only after** relevant CI and device testing; log results and regressions in development handoff.

## Rollout policy
Use small, reversible commits on `feat/locat-1.0`, run CI after each stage, do not merge into `main` until sign-off. Prefer styling existing components over rewriting stateful messaging components. Preserve historical trials and failures in `docs/DEVELOPMENT_HANDOFF_2026-10-08.md`.

## Accessibility targets
WCAG 2.2 AA where applicable: text contrast >= 4.5:1 for ordinary text; interactive visual indicators >= 3:1, keyboard and focus visibility, no color-only status cues, and reduced motion. Verify actual computed colors and user-selectable themes.

## Privacy Command Center
Retain the conversation fingerprint verification dialog, now titled **Privacy Command Center** and styled with smoked glass. Expand later to a dedicated account privacy area for real session information, key verification and existing local privacy controls. Do not present unfinished Recovery Key or Link Device authentication as available. Never claim security capabilities that have not been verified. Preserve the key comparison and trust-pinning behavior.

## Branding rule
Every user-visible app title must be **Locat**. No `Obsidian`, `Olive Edition`, `Liquid Titanium Edition`, suffixes, or stylized trailing punctuation in the product name. Theme names may appear as selectable settings labels only. Historical development notes may mention earlier directions for traceability.
