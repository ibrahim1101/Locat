# Locat Remote engineering history

## 2026-10-11 — autonomous isolated prototype

Inspected main README/package and current 2.0 documentation/branch layout.
Main is explicitly an outdated baseline. Created `feat/locat-remote-prototype`
from main solely for an additive, self-contained `remote/` change. No shared
application files, existing CI workflows, Docker, Cinema, Android or messaging
code changed. Future integration should cherry-pick the remote commits onto the
then-current application branch after review; this PR is not a core branch sync.

Architecture: standard-library Python signaling/session authority hosted on the
Windows machine, browser-hosted screen capture and direct WebRTC media, browser
client, optional ctypes Windows input dispatcher. Separate host/client bearer
credentials; one-use 128-bit pairing secret expires after five minutes; explicit
host approval, 30-minute session ceiling and five-second heartbeat lease.
No database or coupling to Locat account authentication. Input is HTTPS POST,
serialized under the session lock, sequence-checked and rate-bounded. Signaling
queues bounded; host can revoke control while continuing approved viewing.

Commit 150e365: pairing authority, HTTP transport, optional input bridge and
32 passing authority/HTTP tests. Then added UI, controller keyboard mapping,
stream controls, input release on focus loss, heartbeat checks, native-failure
revocation, and tests with a fake user32 dispatcher. Native failure revokes
session rather than permitting further input.

Verification: Python compile and JavaScript syntax checks passed. Initial
security/HTTP suite: 32 passed. Final expanded results recorded in README.
Browser integration script uses synthetic canvas capture and real WebRTC,
explicitly not OS capture. Runtime blocked because Playwright Chromium is absent.
Attempted `npx playwright install chromium`; automatic approval review rejected
installation under the user's no-install constraint. Did not bypass rejection.
No browser runtime, native Windows capture/input, Android, game, throughput,
latency or encoder-hardware acceptance claim is made.

Remaining: standalone native Windows DXGI/WGC capture/encoder, audio, virtual
XInput, native client packaging, Locat identity binding, host consent dialog
outside the web page, hardened HTTP worker limits, TURN/NAT traversal,
measured latency/quality and Windows/Android physical acceptance.
