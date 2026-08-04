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
stash () {  # $1 = original filename with spaces
  if [[ -f "new-videos/$1" && ! -f "$ORIG/$1" ]]; then
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

# convenience: absolute-ish source paths
R="$ORIG/Riptide.mp4"
A="$ORIG/All I Want is You.mp4"
D="$ORIG/Dancing in the Dark.mp4"
W="$ORIG/Wild World.mp4"
H="$ORIG/House of the RIsing Sun.mp4"
F="$ORIG/Forever.mp4"

# 40%-in start points (seconds)
START_RIPTIDE=84.0
START_ALLWANT=27.0
START_DANCING=51.2
START_WILD=62.1
START_HOUSE=34.4
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
echo "== hero-loop.mp4 (24s, silent) =="
ffmpeg -y -v error \
  -ss "$START_RIPTIDE" -t 6 -i "$R" \
  -ss "$START_DANCING" -t 6 -i "$D" \
  -ss "$START_WILD"    -t 6 -i "$W" \
  -ss "$START_HOUSE"   -t 6 -i "$H" \
  -filter_complex "[0:v]scale=1280:720,setsar=1,fps=30[v0];\
[1:v]scale=1280:720,setsar=1,fps=30[v1];\
[2:v]scale=1280:720,setsar=1,fps=30[v2];\
[3:v]scale=1280:720,setsar=1,fps=30[v3];\
[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]" \
  -map "[v]" -an -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p \
  -movflags +faststart hero-loop.mp4

# ─── 4. Highlight reel: 5x 15s with audio, per-excerpt loudnorm, <=12MB ────
echo "== highlight-reel.mp4 (75s, with audio) =="
ffmpeg -y -v error \
  -ss "$START_RIPTIDE" -t 15 -i "$R" \
  -ss "$START_ALLWANT" -t 15 -i "$A" \
  -ss "$START_DANCING" -t 15 -i "$D" \
  -ss "$START_WILD"    -t 15 -i "$W" \
  -ss "$START_HOUSE"   -t 15 -i "$H" \
  -filter_complex "\
[0:v]scale=1280:720,setsar=1,fps=30[v0];[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[a0];\
[1:v]scale=1280:720,setsar=1,fps=30[v1];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a1];\
[2:v]scale=1280:720,setsar=1,fps=30[v2];[2:a]loudnorm=I=-16:TP=-1.5:LRA=11[a2];\
[3:v]scale=1280:720,setsar=1,fps=30[v3];[3:a]loudnorm=I=-16:TP=-1.5:LRA=11[a3];\
[4:v]scale=1280:720,setsar=1,fps=30[v4];[4:a]loudnorm=I=-16:TP=-1.5:LRA=11[a4];\
[v0][a0][v1][a1][v2][a2][v3][a3][v4][a4]concat=n=5:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart new-videos/highlight-reel.mp4

echo "== highlight-reel-poster.jpg =="
ffmpeg -y -v error -ss 2 -i new-videos/highlight-reel.mp4 -frames:v 1 \
  -vf scale=1280:720 -q:v 3 new-videos/highlight-reel-poster.jpg

# ─── 5. Re-encode the six full takes (kebab-case, CRF 27) ──────────────────
encode_take () {  # $1=source  $2=out-basename
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

# ─── 6. Photos: 800px srcset variants + recompress large originals ─────────
GRID=(screenshot nonamebar-09 TP_5.5Pascal_Winters_04 TP_5.5Pascal_Winters_08 nonamebar-03 TP_5.5Pascal_Winters_07)
for name in "${GRID[@]}"; do
  echo "== new-photos/$name-800.jpg =="
  sips --resampleWidth 800 "new-photos/$name.jpg" \
       -s format jpeg -s formatOptions 80 \
       --out "new-photos/$name-800.jpg" >/dev/null
done
# The two portrait photos start over 300KB. They only ever display at <=800px
# (the 800w srcset variant carries the display); the "full" variant is retina
# headroom only, so cap it at 1200px. q80 actually *inflates* these already-lean
# sources, so tune quality per-file to land under 300KB.
# NOTE: run from pristine sources — `git checkout` these two first if re-running.
echo "== new-photos/TP_5.5Pascal_Winters_04.jpg (1200w, <=300KB) =="
sips --resampleWidth 1200 new-photos/TP_5.5Pascal_Winters_04.jpg \
     -s format jpeg -s formatOptions 74 --out new-photos/TP_5.5Pascal_Winters_04.jpg >/dev/null
echo "== new-photos/TP_5.5Pascal_Winters_07.jpg (1200w, <=300KB) =="
sips --resampleWidth 1200 new-photos/TP_5.5Pascal_Winters_07.jpg \
     -s format jpeg -s formatOptions 62 --out new-photos/TP_5.5Pascal_Winters_07.jpg >/dev/null

echo "DONE."
