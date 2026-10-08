# Locat — Private, Self-Hosted Messaging

**Locat** is an open-source encrypted messaging project designed for people who want to host their own messaging server, including on a Raspberry Pi.

> **Development status:** Locat 1.0 is actively under development. The current application, installation instructions, Android APK workflow, and engineering documentation are maintained on the [`feat/locat-1.0` development branch](https://github.com/ibrahim1101/Locat/tree/feat/locat-1.0). This `main` branch is not yet the latest deployable release.

## Explore Locat

- **[Current project README](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/README.md)** — current functionality, limitations and architecture.
- **[Beginner installation guide](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/docs/INSTALLATION.md)** — Raspberry Pi, Linux, Docker and HTTPS setup.
- **[Development roadmap](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/docs/LOCAT-1.0-PLAN.md)** — implementation goals and verification notes.
- **[Engineering history and handoff](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/docs/DEVELOPMENT_HANDOFF_2026-10-08.md)** — progress, tests, failures and fixes.
- **[Android APK builds](https://github.com/ibrahim1101/Locat/actions/workflows/android-apk.yml)** — GitHub Actions artifacts for the development branch.

## What Locat is building

Locat combines device-side encryption, direct and group conversations, self-hosted accounts, local chat history, profiles, friend management, and optional background notifications. Its Android application is built with Capacitor; native Firebase Cloud Messaging support is **in progress**, not yet verified end to end.

Messages are encrypted on clients before being sent to the server. The server still handles account and delivery metadata; Locat is **not** a Signal Protocol implementation and does not currently provide Signal-style forward secrecy.

## Getting started

**Do not deploy this outdated `main` branch as the current Locat server.** Follow the development branch's [installation guide](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/docs/INSTALLATION.md) and its explicit branch-selection instructions.

## Development and releases

The `feat/locat-1.0` branch is used for ongoing implementation and testing. The default branch will be brought in sync with application code when the release is ready and validated. Until then, links above point to the maintained source of truth.

## License

The active Locat development branch uses the **GNU General Public License v3.0 (GPL-3.0-only)**. See its [LICENSE](https://github.com/ibrahim1101/Locat/blob/feat/locat-1.0/LICENSE) file.

Copyright © 2026 Shaik Ibrahim.
