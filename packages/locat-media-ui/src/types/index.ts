/**
 * Authoritative TypeScript types for Locat Media Hub.
 * These types are the integration contract consumed by Locat 2.0.
 * The JSX dev preview in /app/frontend mirrors them 1:1.
 */

export type MediaType = "movie" | "episode" | "music" | "unknown";
export type PlaybackPathType = "direct_play" | "direct_stream" | "transcode" | "unsupported";
export type AudioModeKind = "pure_audio" | "enhanced_dsp";
export type ScanStatus = "idle" | "scanning" | "failed" | "done";
export type BitPerfectStatus = "verified" | "unverified" | "unavailable";

export interface VideoStreamInfo {
  codec: string;
  width: number;
  height: number;
  bit_rate?: number | null;
  fps?: number | null;
  pixel_format?: string | null;
  hdr?: string | null;
  profile?: string | null;
  level?: string | null;
}

export interface AudioStreamInfo {
  codec: string;
  channels: number;
  channel_layout?: string | null;
  sample_rate: number;
  bit_depth?: number | null;
  bit_rate?: number | null;
  language?: string | null;
  default: boolean;
}

export interface SubtitleStreamInfo {
  codec: string;
  language?: string | null;
  forced: boolean;
  default: boolean;
  index: number;
}

export interface MediaLibrary {
  id: string;
  name: string;
  root_path: string;
  kind: MediaType;
  scan_status: ScanStatus;
  item_count: number;
  last_scanned_at?: string | null;
}

export interface MediaItem {
  id: string;
  library_id: string;
  media_type: MediaType;
  path: string;
  size_bytes: number;
  container: string;
  duration_seconds?: number | null;
  title: string;
  year?: number | null;
  series_name?: string | null;
  season_number?: number | null;
  episode_number?: number | null;
  overview?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
  genres: string[];
  video_streams: VideoStreamInfo[];
  audio_streams: AudioStreamInfo[];
  subtitle_streams: SubtitleStreamInfo[];
  favorite: boolean;
  play_count: number;
  last_position_seconds: number;
  last_played_at?: string | null;
}

export interface MusicTrack {
  id: string;
  library_id: string;
  path: string;
  size_bytes: number;
  container: string;
  title: string;
  artist: string;
  album_artist: string;
  album: string;
  composer: string;
  genre: string;
  year?: number | null;
  track_number?: number | null;
  disc_number?: number | null;
  duration_seconds?: number | null;
  audio?: AudioStreamInfo | null;
  has_embedded_cover: boolean;
  cover_art_mime?: string | null;
  replaygain_track_gain_db?: number | null;
  replaygain_album_gain_db?: number | null;
  favorite: boolean;
  play_count: number;
}

export interface EqBand {
  frequency_hz: number;
  gain_db: number;
}

export interface ParametricFilter {
  kind: "peaking" | "lowshelf" | "highshelf" | "lowpass" | "highpass" | "notch";
  frequency_hz: number;
  gain_db: number;
  q: number;
  enabled: boolean;
}

export interface EqPreset {
  id: string;
  name: string;
  bands_mode: "10" | "15" | "31";
  preamp_db: number;
  bands: EqBand[];
  parametric: ParametricFilter[];
  replaygain_mode: "off" | "track" | "album";
  limiter_enabled: boolean;
  balance: number;
  bypass: boolean;
  output_device_id?: string | null;
  is_builtin: boolean;
}

export interface PlaybackDecision {
  item_id: string;
  path_type: PlaybackPathType;
  reason: string;
  transcode_profile?: string | null;
  selected_video_stream?: number | null;
  selected_audio_stream?: number | null;
  selected_subtitle_stream?: number | null;
  warnings: string[];
}

export interface AudioOutputCapabilities {
  runtime: "web" | "windows" | "android" | string;
  device_name?: string | null;
  output_sample_rate?: number | null;
  output_bit_depth?: number | null;
  supports_exclusive: boolean;
  supports_bit_perfect: boolean;
  bit_perfect: BitPerfectStatus;
  reason: string;
  active_mode: AudioModeKind;
  dsp_enabled: boolean;
  resampling_detected?: boolean | null;
}

export interface Playlist {
  id: string;
  name: string;
  track_ids: string[];
  description: string;
}

/** Props for the Locat Media Hub <MediaHub /> entrypoint. */
export interface LocatMediaHubProps {
  apiBaseUrl: string;             // e.g. `${LOCAT_API}/api/media`
  authToken?: string | null;      // bearer token from Locat auth adapter
  deviceId?: string;              // Locat-managed device id (for per-device audio modes)
  featureFlags?: Record<string, boolean>;
}
