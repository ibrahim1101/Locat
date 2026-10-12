# Unified Locat LAN diagnostic increment — 2026-10-12

Branch: `feat/locat-unified-platforms`, draft PR #6. The earlier reviewed branch head was `3d9a934`. This increment adds:

- `scripts/check-lan.mjs`: read-only Node 22+ LAN readiness check. It accepts only a clean HTTPS origin, checks that local DNS resolves to routable private addresses, uses normal TLS trust, disallows redirects, and checks the actual `/api/ready` response (`app: Locat`, `status: ready`).
- `scripts/check-lan.test.mjs`: five Node built-in test cases for private address classification, HTTPS origin validation, readiness response shape, redirect rejection and successful mocked readiness.
- `docs/LAN_READINESS.md`: operator instructions and scope limitations.

The diagnostic was previously prepared offline; this run successfully committed it and the tests. Five corresponding regression tests passed locally on Node 22.16.0. The GitHub workflow and package.json test-script integration could not be committed because the connector rejected those writes. Until CI includes the new test explicitly, run `node --test scripts/check-lan.test.mjs` manually.

This is a diagnostic, not proof of deployed LAN connectivity. Actual Windows Docker Desktop startup, Raspberry Pi 5 ARM64 build/runtime, Android WebView certificate trust, native client onboarding, messaging and physical media/Remote acceptance are all NOT TESTED. No live Pi/database was touched; main and other development branches were not changed.

Next P0: integrate test execution into existing CI, validate Compose on actual Windows and Pi ARM64, confirm trusted HTTPS and secure native onboarding, restore original Locat visual/navigation parity and missing original features, and rebuild/test Windows NSIS and signed Android APK before October 13 release. Keep the release labeled preview/beta until acceptance gates pass.
