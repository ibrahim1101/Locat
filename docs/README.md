# Locat documentation hub

**Status:** Active pre-release development. This index is maintained alongside the engineering journal and UI handoff. Implemented, CI-verified, emulator-tested, and deployed are distinct statuses.

## Start here — development and new chats
- [New-chat engineering handoff (2026-10-09)](NEW_CHAT_HANDOFF_2026-10-09.md) — recent commits, verified CI, pending work, emulator commands and safe working boundaries.
- [Complete engineering journal (2026-10-08 onward)](DEVELOPMENT_HANDOFF_2026-10-08.md) — chronological decisions, implementation, trials, failures, fixes and successes.
- [Full project history and handoff](PROJECT-HISTORY-AND-HANDOFF.md) — long-running project overview and historical decisions.
- [Emergent UI handoff (2026-10-09)](EMERGENT_UI_HANDOFF_2026-10-09.md) — visual target, all seven UI agent questions, branch safety, merge checklist and what remains unverified.
- [Existing Liquid Titanium design brief](OBSIDIAN_UI_REDESIGN.md) · [UI progress](UI_PROGRESS_2026-10-09.md) · [UI run journal](UI_RUN_2026-10-09_0600.md)

## Product, implementation and testing
- [Locat 1.0 plan](LOCAT-1.0-PLAN.md)
- [Recovery and quick sign-in threat model](QUICK_SIGN_IN_DESIGN.md) — partial implementation and planned work; do not confuse design with shipped feature.
- [Message controls](MESSAGE-CONTROLS.md) · [Control states](CONTROL-STATES.md) · [Groups](GROUPS.md)
- [Notifications](NOTIFICATIONS.md) · [Hidden chats](HIDDEN-CHATS.md) · [Hidden messages](HIDDEN-MESSAGES.md)
- [Appearance](APPEARANCE.md) · [Profile viewing](PROFILE-VIEWING.md) · [Android storage](ANDROID-STORAGE.md)

## Setup and operations
- [Beginner installation](INSTALLATION.md) · [Raspberry Pi](RASPBERRY_PI.md) · [Pi GitHub deployment](PI-GITHUB-DEPLOY.md)
- [Android](ANDROID.md) · [Cross-platform](CROSS_PLATFORM.md) · [Server administration](SERVER_ADMIN.md)
- [Dependency security](DEPENDENCY-SECURITY.md) · [Review](REVIEW.md)

## Documentation maintenance rule
After each meaningful change, record: date, branch, commit, reason, files, exact verification result, failure/regression if any, whether the user actually tested it, whether the Pi was deployed, and the next action. Never claim external UI work is merged without a real branch/commit. Keep this index and the handoffs editable as the project evolves.
