# Locat Remote — isolated experimental prototype

This additive module does not change the Locat application, Android APK,
Cinema, Docker, messaging or account security. Do not deploy it as a service
or expose it to the public Internet. Python 3.10+ is the only runtime dependency.
It runs in the foreground; there is no installer, elevated service or unattended
access. Review [engineering history](ENGINEERING_HISTORY.md).

## What is implemented

- Browser screen-capture host intended for Windows Chrome/Edge; the OS/browser
  screen chooser is mandatory. This is not a standalone native capture engine.
- Direct WebRTC video with no configured external STUN/TURN. Client negotiates
  after a one-use invitation and explicit authenticated host approval.
- Resolution, frame-rate and sender bitrate controls, encoder/receiver stats,
  connection state and disconnect UI. Browser may negotiate below requested settings.
- Optional Windows primary-monitor mouse/keyboard injection using user32;
  bounded key allowlist, normalized pointer/touch, monotonic input sequence,
  rate limit and revocation/release under one lock.
- Browser gamepad API mapped to WASD, arrows and Space/Escape/E/R. This is
  keyboard emulation, not virtual Xbox/XInput support; no analog trigger support.
- Host can revoke control immediately while retaining approved viewing.

## Windows: local viewing smoke test (PowerShell)

Run commands only in your own checkout; Python must already be installed.

```powershell
git fetch origin
git switch feat/locat-remote-prototype
git pull --ff-only origin feat/locat-remote-prototype
py -3 remote/server.py
```

Open `http://127.0.0.1:8765` in Chrome or Edge. Paste the terminal's host
credential, click **Host console**, then **Create invitation**. Open the same
URL in a separate browser/incognito window, paste the invitation and click
**Request connection**. In the host tab click **Approve pending viewer**,
then **Select screen and stream** and choose a screen. Verify moving content
on the viewer, receiver dimensions/FPS, and disconnect from both sides.
Keep the host tab foregrounded; background timer throttling can expire the lease.

## Windows: optional control acceptance

Stop the server with Ctrl+C and run:

```powershell
py -3 remote/server.py --enable-windows-input
```

Repeat pairing; explicitly check **Approve Windows input** before approval.
Select the **primary monitor** (no cropped window or second monitor).
Use a non-sensitive test application such as Notepad on that monitor.
Click the viewer to focus keyboard input. Verify letters, arrows, mouse clicks,
release after focus loss, **Revoke control, keep viewing**, screen-sharing stop,
client disconnect, and Ctrl+C. Try closing host/client tabs while holding a key:
input must release within roughly six seconds (five-second lease + watchdog).
Never test inside an elevated application: UIPI may block injection. Secure
Desktop/UAC, Windows shortcuts, modifiers and admin elevation are unsupported.
This bridge uses legacy user32 dispatch, not a tested SendInput/DPI-aware implementation.

## Android Chrome: private HTTPS acceptance

There is no APK change in this branch. Test through Android Chrome. A network
origin needs a TLS certificate trusted by both devices, matching its hostname
or IP. Supply an existing certificate; this project does not install or generate
trust roots, change firewall rules or configure routing automatically.
Example with Windows private IP `192.168.1.10` (substitute your real address):

```powershell
py -3 remote/server.py --bind 0.0.0.0 --origin https://192.168.1.10:8765 --cert C:\certs\remote-cert.pem --key C:\certs\remote-key.pem --enable-windows-input
```

The certificate must cover that IP and be trusted; do not bypass trust warnings.
Open **the same HTTPS URL on the Windows host and Android phone**. Host credential
stays on Windows; share only the single-use pairing invitation with Android.
Approve and select the primary monitor on Windows. Verify live video, portrait/
landscape letterboxing, normalized touch movement/tap, revocation and disconnect.
On a primary monitor with a safe game, try 720p/30 FPS/8 Mbps, then 1080p/60 FPS,
and record received FPS, loss and responsiveness. Do not infer latency from FPS.
Controllers need browser/Android support; focus the video and opt in to mapping.
No external STUN/TURN: use one private LAN or a suitable private routed network;
connectivity across arbitrary NATs is not implemented.

For emulator access, if HTTPS/certificate uses `10.0.2.2`, host origin must be
`https://10.0.2.2:8765` and **both browser surfaces must use that exact origin**.
That alias is emulator-specific and commonly unusable from the host browser;
prefer the host's actual LAN IP with a matching certificate for both surfaces.
No `adb install` command applies because no Remote APK was produced.

## Reproducible verification

Linux/macOS:

```sh
PYTHONPATH=remote python -m unittest discover -s remote/tests -v
python -m compileall -q remote
node --check remote/app.js
node --check remote/tests/browser.cjs
```

Windows PowerShell:

```powershell
$env:PYTHONPATH = "remote"
py -3 -m unittest discover -s remote/tests -v
py -3 -m compileall -q remote
node --check remote/app.js
```

Optional browser verification on a development machine with Playwright and its
Chromium already available:

```sh
node remote/tests/browser.cjs
```

The script checks pairing, approval, a real peer connection carrying **synthetic
canvas video**, revocation and page errors. It never touches a personal desktop.
In the development environment 38 Python tests pass, compile/syntax checks pass;
browser runtime was blocked by missing Chromium and rejected installation.
No physical Windows or Android verification was possible. No application-wide
Node tests/build were run: root dependencies and application code are unchanged,
and this standalone module has no bundle or dependency installation step.

## Contracts and security model

- `POST /pair`, JSON `{code}`: consumes invitation, returns scoped client token,
  pending state. Possession alone does not approve view/control.
- `POST /action`, `Authorization: Bearer …`: JSON `type` of `status`, `poll`,
  `disconnect`, host-only `pairing`, `approve`, `revoke-control`; approved-session
  `signal` (host offer/client answer/either candidate); client-only `input`.
- Input envelope: `{type:"input",seq:integer,event:{kind:"move",x:0..1,y:0..1}}`,
  `{kind:"key",code:"KeyW",down:true}` or `{kind:"button",button:0..2,down:true}`.
  Unsupported events rejected. 240 input requests/second, 64 KiB HTTP body,
  128 queued signals/destination, 30-minute absolute session lifetime.
- Credentials stay in browser memory, never URL/localStorage; terminal prints
  the host credential intentionally. Restart rotates all credentials. No logs
  of requests, bearer tokens or pairing secrets; no file browsing endpoint.
- Exact Host and Origin checks protect POSTs; no CORS; no-store, CSP and
  frame-ancestor restriction. Non-loopback binding requires HTTPS certificate.
- Video uses WebRTC encryption; HTTPS protects signaling and native input on
  network connections. The server controls delivered JavaScript and is trusted;
  this is not independent end-to-end identity verification or Locat auth binding.
- Approve means trusting the viewer with whatever appears on the selected screen.
  Control can type into any focused non-elevated application, including a shell.
  The protocol has no command-execution endpoint, but input control itself is
  powerful. Keep control off for untrusted viewers. No clipboard/files/audio.
- Host web consent is credential-protected but is not a native trusted dialog.
  Theft of host credentials permits approval. Invitations are high-entropy rather
  than short PINs; rate limiting/worker caps against network DoS are incomplete.
- Heartbeat expiration releases held input. Explicit revocation is synchronous
  under the authority lock; an in-flight native call may finish first.
  Killing the Python process forcibly cannot guarantee key release.

## Remote Play evaluation / outstanding work

WebRTC is the selected prototype transport: direct media, congestion control,
browser codec negotiation and configurable bitrate; this is not a measured
competitive-gaming transport. Native input uses ordered HTTP requests, not a
low-latency data channel. Queued input and network conditions can add latency.
Hardware encoder use is browser-selected, not guaranteed; stats may report its
implementation. Requested 60 FPS is a target, not a verified result.

Next native candidate: Windows Graphics Capture/DXGI capture feeding NVENC,
AMF or Quick Sync with bounded frame queues into WebRTC. This needs native
code, hardware availability, codec negotiation and real Windows acceptance.
Audio capture, reliable high-FPS/high-resolution benchmarks, virtual gamepad
backend, multi-monitor/DPI-aware mapping, recovery/reconnect, TURN deployment,
Locat device identity, native host approval/tray and APK integration remain open.
Avoid gameplay with anti-cheat restrictions until compatibility is evaluated.
