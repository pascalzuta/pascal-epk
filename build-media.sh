#!/usr/bin/env bash
# build-media.sh — regenerate every derived media asset for zuta.co
#
# Requires: ffmpeg, ffprobe, sips (macOS).
# Idempotent: re-running overwrites outputs. Source of truth = _originals/.
#
# Run from the repo root:  bash build-media.sh
#
# ─── SOURCE FACTS (ffprobe) ────────────────────────────────────────────────
#   riptide                 210.0s   1280x720
#   all-i-want-is-you        67.6s   1280x720
#   dancing-in-the-dark     128.1s   1280x720
#   wild-world              155.2s   1280x720
#   house-of-the-rising-sun  86.1s   1280x720
#   forever                 247.3s   1280x720
#
# Excerpt start = ~40% into each song. Edit the START_* values below to re-cut.
set -euo pipefail
cd "$(dirname "$0")"

ORIG="_originals"
mkdir -p "$ORIG"

# ─── 1. Stash pristine originals (only on first run) ───────────────────────
# (bash 3.2 compatible — no associative arrays)
# macOS filenames are case-insensitive, so `-f new-videos/Riptide.mp4` is true
# even when only the encoded riptide.mp4 is there. Match the exact name instead,
# or the encoded take gets swallowed and then re-encoded on top of itself.
stash () {  # $1 = original filename with spaces
  if ls "new-videos" | grep -Fxq "$1" && [[ ! -f "$ORIG/$1" ]]; then
    mv "new-videos/$1" "$ORIG/$1"
    echo "stashed  $1 -> $ORIG/"
  fi
}
stash "Riptide.mp4"
stash "All I Want is You.mp4"
stash "Dancing in the Dark.mp4"
stash "Wild World.mp4"
stash "House of the RIsing Sun.mp4"
stash "Forever.mp4"

# convenience: source paths.
# _originals/ is the preferred source, but it is gitignored and may be absent on
# a fresh clone. Fall back to the already-encoded take in new-videos/ so the
# script still runs; the excerpt timecodes are identical either way.
src () {  # $1 = original filename with spaces   $2 = kebab-case fallback
  if [[ -f "$ORIG/$1" ]]; then echo "$ORIG/$1"; else echo "new-videos/$2.mp4"; fi
}
R="$(src "Riptide.mp4" riptide)"
A="$(src "All I Want is You.mp4" all-i-want-is-you)"
D="$(src "Dancing in the Dark.mp4" dancing-in-the-dark)"
W="$(src "Wild World.mp4" wild-world)"
H="$(src "House of the RIsing Sun.mp4" house-of-the-rising-sun)"
F="$(src "Forever.mp4" forever)"

# 40%-in start points (seconds)
START_RIPTIDE=84.0
START_ALLWANT=27.0
START_DANCING=51.2
START_WILD=62.1
START_HOUSE=54.0   # hero-loop opens here; picked for the light on his face
START_FOREVER=98.9

# ─── 2. Still images (sips) ────────────────────────────────────────────────
echo "== hero-poster.jpg (<=200KB) =="
sips --resampleWidth 1600 pascal-hero-bw.jpg -s format jpeg -s formatOptions 65 \
     --out hero-poster.jpg >/dev/null

echo "== og-image.jpg (1200x630 from nonamebar-09) =="
sips --resampleWidth 1200 new-photos/nonamebar-09.jpg --out /tmp/_og.jpg >/dev/null
sips -c 630 1200 /tmp/_og.jpg -s format jpeg -s formatOptions 88 --out og-image.jpg >/dev/null
rm -f /tmp/_og.jpg

# ─── 3. Hero loop: 4x 6s hard-cut, muted, no audio track, <=4MB ────────────
# Clip order: House of the Rising Sun leads, so the first thing that moves after
# the poster hold is the disco-ball room. Then it alternates rooms: house (bar
# with the disco ball) → riptide (living room) → dancing (disco ball) → wild
# world (living room).
echo "== hero-loop.mp4 (24s, silent) =="
ffmpeg -y -v error \
  -ss "$START_HOUSE"   -t 6 -i "$H" \
  -ss "$START_RIPTIDE" -t 6 -i "$R" \
  -ss "$START_DANCING" -t 6 -i "$D" \
  -ss "$START_WILD"    -t 6 -i "$W" \
  -filter_complex "[0:v]scale=1280:720,setsar=1,fps=30[v0];\
[1:v]scale=1280:720,setsar=1,fps=30[v1];\
[2:v]scale=1280:720,setsar=1,fps=30[v2];\
[3:v]scale=1280:720,setsar=1,fps=30[v3];\
[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]" \
  -map "[v]" -an -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p \
  -movflags +faststart hero-loop.mp4

# ─── 4. Re-encode the six full takes (kebab-case, CRF 27) ──────────────────
encode_take () {  # $1=source  $2=out-basename
  if [[ "$1" == "new-videos/$2.mp4" ]]; then
    echo "== $2.mp4 (already encoded, no original to re-encode from — skipped) =="
    return
  fi
  echo "== $2.mp4 =="
  ffmpeg -y -v error -i "$1" \
    -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart "new-videos/$2.mp4"
}
encode_take "$R" riptide
encode_take "$A" all-i-want-is-you
encode_take "$D" dancing-in-the-dark
encode_take "$W" wild-world
encode_take "$H" house-of-the-rising-sun
encode_take "$F" forever

# Photos in new-photos/ are used as-is (originals) — no derived variants.

echo "DONE."
