# Locat 2.0 — Platform Roadmap
Reviewed 2026-10-10.

## Shared core
Keep React/Vite UI, WebCrypto/E2EE contracts, Hono/tRPC server, MariaDB/Drizzle and official Obsidian Ember brand. Use platform-specific adapters rather than framework migrations.

## Web / PWA
Supported client target. Browser file downloads and Web Push must be verified per browser and permission state. Service-worker support is not synonymous with native Android push.

## Android (Capacitor)
Preserve existing Capacitor design and HTTPS-only server onboarding. Preview application ID: com.shaikibrahim.locat.preview; original: com.shaikibrahim.locat. Prioritize Android native folder picker and file-save plugin, background notification registration/delivery, lock behavior, safe areas and emulator/physical-device tests. Local native Android project may be uncommitted on the user's Windows machine.

## Windows / Linux / macOS (Tauri 2)
src/lib/platform adapters provide a preliminary scaffold only. No src-tauri Rust project or installers have been implemented.
- Windows: target signed .exe/.msi packages and system tray.
- Linux: target .deb, AppImage, optionally .rpm depending on build tooling.
- macOS: target .app/.dmg with signing/notarization when credentials exist.
- Native features: file dialogs/save, notifications, deep links, OS secure storage, tray, optional startup, updates.
- Desktop app should connect over TLS to existing self-hosted backend, not bundle MariaDB by default.
- Establish cross-platform CI/builds and actual platform smoke tests before claiming releases.

## Release order
1. Stabilize shared core, E2EE and security.
2. Android native fixes and tests.
3. Tauri Rust shell and platform adapters on dedicated branch.
4. Cross-platform build/sign/release pipelines.
5. Distribution documentation and platform-specific QA.
