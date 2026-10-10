/**
 * TypeScript React component contracts for Locat Media Hub.
 *
 * These are the declarations consumed by Locat 2.0. The JSX implementations
 * live in /app/frontend/src/locat-media-hub for the dev preview; both
 * trees are kept in lockstep.
 */

import type { FC } from "react";
import type {
  AudioModeKind,
  AudioOutputCapabilities,
  EqPreset,
  LocatMediaHubProps,
  MediaItem,
  MediaLibrary,
  MusicTrack,
  PlaybackDecision,
} from "../types";

/** Root entrypoint — mounts the Cinema+Music module into a Locat page. */
export declare const MediaHub: FC<LocatMediaHubProps>;

/** Cinema library grid. */
export declare const CinemaLibrary: FC<{
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
}>;

/** Cinema player — HTTP range stream + diagnostics panel. */
export declare const CinemaPlayer: FC<{
  item: MediaItem;
  streamUrl: string;
  decision: PlaybackDecision | null;
  onProgress?: (seconds: number) => void;
  onBack?: () => void;
}>;

/** Music library grid + album detail. */
export declare const MusicLibrary: FC<{
  tracks: MusicTrack[];
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
}>;

/** Music player bar — fed by the DualModeAudioEngine. */
export declare const MusicPlayer: FC<{
  track: MusicTrack | null;
  queue: MusicTrack[];
  mode: AudioModeKind;
  caps: AudioOutputCapabilities | null;
  onModeChange: (mode: AudioModeKind) => void;
}>;

/** 10/15/31-band graphic EQ + preamp + ReplayGain selector. */
export declare const EqualizerPanel: FC<{
  preset: EqPreset;
  disabled: boolean;        // true when Pure Audio is active
  onChange: (preset: EqPreset) => void;
  presets: EqPreset[];
  onSavePreset: (preset: EqPreset) => Promise<void>;
}>;

/** Honest audio mode toggle (Pure Audio vs Enhanced DSP) + bit-perfect status chip. */
export declare const AudioModeSwitch: FC<{
  mode: AudioModeKind;
  caps: AudioOutputCapabilities | null;
  onChange: (mode: AudioModeKind) => void;
}>;
