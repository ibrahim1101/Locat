# Original chat-first navigation vs unified launcher — verified source audit (2026-10-12)

This audit compares repository source; it is not a screenshot or physical-device acceptance test.

## Verified difference

- `feat/locat-1.0` `src/App.tsx`: `/` and unknown routes open `Chat`, with `/admin` separate. The original product opens directly into the messaging experience.
- `feat/locat-2.0` and `feat/locat-unified-platforms` `src/App.tsx`: `/` opens `Dashboard`, and chat moved to `/messages`.
- Unified `src/pages/Dashboard.tsx`: an ecosystem module-card launcher, stat strip and roadmap tiles. This changes the first screen even though messaging code remains present.
- Unified `src/index.css`: the matte-black background, dotted mesh and burnt-orange tokens already exist. The primary visual mismatch is navigation/composition, not just missing theme colors.
- Unified `src/components/shell/AppShell.tsx` and `src/components/shell/MobileBottomNav.tsx`: dashboard-first navigation is intentional; changing only the root route would leave misleading Home and Messages links.

## P0 restoration recommendation

Restore chat-first startup while keeping Dashboard available at an explicit route. Update `src/App.tsx`, the dashboard route in `src/modules/registry.tsx`, home links in the shell, bottom navigation active-state handling, and media back links together. Add route and mobile navigation regression tests before rebuilding. Preserve login, E2EE, app-lock, draft persistence, and the existing media/security modules. Do not copy the old source tree wholesale.

This specific chat-first change is **AUDITED, NOT YET IMPLEMENTED**. Compare the actual original APK/screenshots before final UI sign-off. Source presence does not prove feature behavior.
