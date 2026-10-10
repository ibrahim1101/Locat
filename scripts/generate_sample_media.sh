#!/usr/bin/env bash
# Generates small royalty-free sample media so Locat Media Hub has
# something to index out of the box.
set -euo pipefail
ROOT="${1:-/app/media_samples}"
mkdir -p "$ROOT/cinema" "$ROOT/music"

CINEMA_MP4="$ROOT/cinema/Sample.Movie.(2024).mp4"
CINEMA_MKV="$ROOT/cinema/Sample.Episode.S01E01.mkv"
MUSIC_FLAC="$ROOT/music/Locat Demo Band - Sine Wave Demo.flac"
MUSIC_MP3="$ROOT/music/Locat Demo Band - Pulse Demo.mp3"

if [ ! -f "$CINEMA_MP4" ]; then
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i testsrc2=size=1280x720:rate=24:duration=6 \
    -f lavfi -i sine=frequency=440:duration=6 \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p -movflags +faststart \
    -c:a aac -b:a 128k -shortest "$CINEMA_MP4"
fi

if [ ! -f "$CINEMA_MKV" ]; then
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i testsrc=size=854x480:rate=24:duration=4 \
    -f lavfi -i sine=frequency=660:duration=4 \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
    -c:a ac3 -b:a 192k -shortest "$CINEMA_MKV"
fi

if [ ! -f "$MUSIC_FLAC" ]; then
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "sine=frequency=440:duration=5,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo" \
    -metadata title="Sine Wave Demo" -metadata artist="Locat Demo Band" \
    -metadata album="Locat Media Hub Samples" -metadata album_artist="Locat Demo Band" \
    -metadata date="2024" -metadata track="1" -metadata genre="Test" \
    -c:a flac "$MUSIC_FLAC"
fi

if [ ! -f "$MUSIC_MP3" ]; then
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "sine=frequency=220:duration=5,aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=stereo" \
    -metadata title="Pulse Demo" -metadata artist="Locat Demo Band" \
    -metadata album="Locat Media Hub Samples" -metadata album_artist="Locat Demo Band" \
    -metadata date="2024" -metadata track="2" -metadata genre="Test" \
    -c:a libmp3lame -b:a 192k "$MUSIC_MP3"
fi

ls -la "$ROOT/cinema" "$ROOT/music"
