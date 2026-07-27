#!/bin/bash
# Double-click this file to run the chord reader on this Mac.
#
# It updates itself, converts any new PDFs, builds the app and opens it in your
# browser. Nothing here is typed by you.

cd "$(dirname "$0")" || exit 1

PDF_NOTE="library/where-my-pdfs-are.txt"

RULE='----------------------------------------------------------'

say() { printf '\n%s\n' "$1"; }
oops() {
  printf '\n%s\n%s\n%s\n\n' "$RULE" "$1" "$RULE"
  printf 'Press Enter to close this window.\n'
  read -r _
  exit 1
}

printf '\n=== Chord Reader ===\n'

# --- the one thing that has to be installed ---------------------------------

if ! command -v node >/dev/null 2>&1; then
  oops "This Mac does not have Node installed, which the app needs.

Install it once from  https://nodejs.org  (choose the big green LTS
button, then open the downloaded file and click through), then
double-click this file again."
fi

# --- pick up any changes ------------------------------------------------------

say "Checking for updates..."
git -C .. pull --ff-only origin main 2>/dev/null || say "(Could not check for updates. Carrying on with what is here.)"

if [ ! -d node_modules ]; then
  say "First run, so this next part takes a minute or two..."
  npm install || oops "Something went wrong setting up. Send the lines above to Claude."
fi

# --- your songs ---------------------------------------------------------------

FOLDER=""
[ -f "$PDF_NOTE" ] && FOLDER=$(cat "$PDF_NOTE")

if [ -n "$FOLDER" ] && [ -d "$FOLDER" ]; then
  say "Reading your PDFs from: $FOLDER"
  node tools/pdf-to-chordpro.mjs "$FOLDER" || say "(The PDFs could not be read. Using whatever songs were there before.)"
else
  printf '\nWhere are your chord sheet PDFs?\n'
  printf 'Drag the folder from Finder onto this window, then press Enter.\n'
  printf '(Or just press Enter to skip and use the demo songs.)\n\n> '
  read -r DROPPED
  # Finder wraps dragged paths in quotes and escapes spaces; tidy both up.
  DROPPED=$(printf '%s' "$DROPPED" | sed "s/^['\"]//; s/['\"]$//; s/\\\\ / /g")
  if [ -n "$DROPPED" ] && [ -d "$DROPPED" ]; then
    mkdir -p library
    printf '%s' "$DROPPED" > "$PDF_NOTE"
    say "Reading your PDFs from: $DROPPED"
    node tools/pdf-to-chordpro.mjs "$DROPPED" || say "(The PDFs could not be read. Carrying on without them.)"
  elif [ -n "$DROPPED" ]; then
    say "There is no folder at: $DROPPED — carrying on with the demo songs."
  fi
fi

# --- build and open -----------------------------------------------------------

say "Building the app..."
npm run build >/dev/null || oops "The app could not be built. Send the lines above to Claude."

say "Starting. Your browser will open in a moment."
npx vite preview --port 4173 --host >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT INT TERM

sleep 3
open "http://localhost:4173/" 2>/dev/null || say "Open this in your browser:  http://localhost:4173/"

printf '\n%s\n' "$RULE"
printf 'The chord reader is running at  http://localhost:4173\n\n'
printf 'LEAVE THIS WINDOW OPEN while you use it.\n'
printf 'To stop: click this window and press  Control + C\n'
printf '%s\n\n' "$RULE"

wait $SERVER
