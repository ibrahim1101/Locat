# @locat/media-capacitor-audio-bridge

Capacitor plugin that gives Locat Music an **honest** native Android
audio capability bridge.

## What it does

- Exposes `getCapabilities()` → the real AudioManager-observed default
  device, API-level availability of AAudio exclusive-sharing mode,
  low-latency support flag.
- `verifyBitPerfect()` → attempts to open an AAudio stream in EXCLUSIVE
  sharing mode at the source track's sample rate / bit depth, and only
  reports `verifiedBitPerfect: true` when the opened stream really
  matches.
- `reportToServer()` → POSTs the native-measured capabilities to
  `/api/media/music/audio-mode/report-verified`. The server rejects
  non-admin bearers so this call is only accepted from the trusted
  Locat Android app.

## What is STILL scaffold

The Kotlin plugin reports the state it can observe without opening a
stream. The actual exclusive-mode open + comparison lives in TODO
comments in `LocatMediaAudioBridgePlugin.kt::verifyBitPerfect`:

- Build an `AAudioStreamBuilder` with EXCLUSIVE sharing mode.
- Set the format matching the track's bit depth (e.g. `PCM_FLOAT` for
  32-bit float, `PCM_I16` for 16-bit).
- Set the sample rate and channel count.
- `AAudioStream_open`.
- Compare `getSharingMode()`, `getSampleRate()`, `getFormat()` against
  the requested values. Only if **all** match → `verified = true`.

Until this is implemented, the plugin is a conservative capability
reporter and NEVER lies: `verifiedBitPerfect` is always `false`.

## Integrating into Locat Android

1. Add the plugin to Locat's Capacitor Android project:
   ```
   npm install ./packages/locat-media-capacitor-audio-bridge
   npx cap sync android
   ```
2. Register the plugin in `MainActivity.java`:
   ```java
   add(com.locat.media.LocatMediaAudioBridgePlugin.class);
   ```
3. Call from the Locat Music React layer:
   ```ts
   import { LocatMediaAudioBridge } from "@locat/media-capacitor-audio-bridge";
   const caps = await LocatMediaAudioBridge.getCapabilities();
   if (caps.supportsExclusive) {
     const v = await LocatMediaAudioBridge.verifyBitPerfect({
       trackSampleRate: 96000, trackBitDepth: 24, trackChannels: 2,
     });
     await LocatMediaAudioBridge.reportToServer({
       apiBaseUrl: `${locatApi}/api/media`,
       authToken: locatAdminBearer,
       deviceId: locatDeviceId,
       capabilities: v,
     });
   }
   ```

## Non-goals

- No fallback to AudioTrack-only playback. If AAudio exclusive is
  unavailable, the plugin reports `verified = false` with a reason —
  the server UI will show `bit-perfect: unverified` or `unavailable`.
- No DSP in the bridge. The Locat DSP runs in the Locat Music JS layer
  (Enhanced DSP) or inside the host-selected ExoPlayer renderer; the
  bridge only validates the output path.
