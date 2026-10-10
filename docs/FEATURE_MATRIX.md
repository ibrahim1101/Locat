# Locat 2.0 — Feature Matrix
Source audit: 2026-10-10, feat/locat-2.0 @ 30fcd93. Statuses distinguish code presence from runtime verification.

| Module | Scope | Status | Verification gap |
| --- | --- | --- | --- |
| M0 | Core messenger, responsive UI | Implemented in part | Android cross-device E2EE regression |
| M0 | One-tap mobile Home and composer drafts | Code + unit/source tests | Manual Android navigation; plaintext drafts risk |
| M0 | App passcode, WebAuthn helper, background/auto lock | Code + tests | Security review; native biometric and bypass testing |
| M0 | Notification prefs, toast, web push worker filtering | Code + tests | Actual browser/background/Android push delivery |
| M0 | Inline image previews, MIME handling | Code + tests | Android screenshot/device smoke tests |
| M0 | Attachment downloads | Partial | Native plugin absent; WebView download not guaranteed |
| M1 | Sentinel events, webhook, timeline | Existing implementation | Real authenticated end-to-end fixtures and alert tests |
| M2 | Link pairing, transfers | Existing implementation | Proof-of-possession, revocation, replay security |
| M3 | Vault client-encrypted files | Planned | Architecture/security review and implementation |
| M4 | Dashboard and permission-scoped global search | Partial dashboard, search planned | Real data and authorization |
| M5 | Hub private server telemetry | Planned | Least-privilege agent |
| M6 | Secrets client-encrypted credential vault | Planned | Threat model and recovery |
| M7 | Calendar + Automate | Planned | Permissions, reminders, safe automation |
| M8 | Share expiring links, QR and Android sharing | Planned | Backend enforcement |
| M9 | Workspace team spaces, notes and Kanban | Planned | Server-side roles |
| M10 | Extensions | Planned | Server-enforced capabilities |
| M11 | LAN-only Offline, future mesh | Planned | Genuine peer discovery/authenticated LAN transport |

The development journal refers to a 13-module vision, but currently enumerates M0–M11. Do not invent an unnamed module.
