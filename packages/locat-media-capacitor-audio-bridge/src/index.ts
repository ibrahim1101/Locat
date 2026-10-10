/**
 * Locat Media — Capacitor Audio Bridge (TypeScript facade).
 *
 * Responsibility: provide the Locat React layer with HONEST
 * capabilities from the Android native audio stack and report
 * verified bit-perfect playback (or lack thereof) back to the Locat
 * media server via `POST /api/media/music/audio-mode/report-verified`.
 *
 * Status: SCAFFOLD. The Kotlin side under `android/` currently returns
 * the real AAudio capabilities it can observe without opening a stream;
 * actual bit-perfect verification requires opening the output stream in
 * exclusive performance mode and comparing the stream's sample rate /
 * encoding against the source track. Those steps are listed as TODO in
 * `LocatMediaAudioBridgePlugin.kt`.
 */
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type AudioBridgeMode = "pure_audio" | "enhanced_dsp";

export interface AudioOutputDevice {
  id: string;
  name: string;
  type: "builtin_speaker" | "wired_headset" | "usb_dac" | "bluetooth_a2dp" | "bluetooth_hearing_aid" | "aux" | "hdmi" | "unknown";
  isDefault: boolean;
}

export interface NativeAudioCapabilities {
  runtime: "android";
  device: AudioOutputDevice | null;
  supportsExclusive: boolean;        // AAudio EXCLUSIVE sharing mode available?
  supportsLowLatency: boolean;
  outputSampleRate: number | null;   // Hz observed on the active stream
  outputBitDepth: number | null;     // 16 / 24 / 32 (float)
  resamplingDetected: boolean | null;
  /** TRUE only when the native layer has opened the stream in
   *  exclusive mode AND the stream's rate/encoding match the source.
   *  Server treats this as `bit_perfect = verified`. */
  verifiedBitPerfect: boolean;
  reason: string;
}

export interface AudioBridgePluginEvents {
  deviceChanged: (device: AudioOutputDevice | null) => void;
  bitPerfectChanged: (verified: boolean, reason: string) => void;
}

export interface LocatMediaAudioBridgePlugin {
  /** Query current native audio capabilities. SAFE to call any time. */
  getCapabilities(): Promise<NativeAudioCapabilities>;

  /** Switch playback pipeline. The Android plugin reconfigures the
   *  AAudio stream (exclusive vs shared) and reports back. */
  setMode(options: { mode: AudioBridgeMode }): Promise<NativeAudioCapabilities>;

  /** Instruct the native layer to open an exclusive-mode stream for a
   *  specific track configuration and attempt bit-perfect verification.
   *  Resolves to the final capabilities. */
  verifyBitPerfect(options: {
    trackSampleRate: number;
    trackBitDepth: number;
    trackChannels: number;
  }): Promise<NativeAudioCapabilities>;

  /** Report the native-measured capabilities to the Locat media server.
   *  Backend endpoint: POST /api/media/music/audio-mode/report-verified
   *  Server rejects the call if the authenticated user isn't admin.
   *  Returns the server response. */
  reportToServer(options: {
    apiBaseUrl: string;
    authToken: string;
    deviceId: string;
    capabilities: NativeAudioCapabilities;
  }): Promise<{ ok: boolean }>;

  /** List all currently connected output devices. */
  listOutputDevices(): Promise<{ devices: AudioOutputDevice[] }>;

  addListener<E extends keyof AudioBridgePluginEvents>(
    event: E, handler: AudioBridgePluginEvents[E],
  ): Promise<PluginListenerHandle>;
}

export const LocatMediaAudioBridge = registerPlugin<LocatMediaAudioBridgePlugin>(
  "LocatMediaAudioBridge",
);
