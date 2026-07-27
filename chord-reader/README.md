# Chord reader

A private chord sheet reader for live guitar playing. Nothing here has anything
to do with the EPK website in the rest of this repository.

Being built in three steps. **Step 1 (converting PDFs) is done.** Steps 2 and 3
are not started yet.

## Step 1 — turning your PDFs into one song file

### What you need once, the first time

The script uses a small free tool called `pdftotext` to pull the text out of a
PDF. To install it, open Terminal and type:

    brew install poppler

If Terminal replies `brew: command not found`, install Homebrew first from
https://brew.sh and then run the line above again.

If you skip this, the script will tell you so in plain words rather than
failing in a confusing way.

### Running it

Whenever you add new PDFs, open Terminal and run these two lines:

    cd ~/path/to/pascal-epk/chord-reader
    node tools/pdf-to-chordpro.mjs ~/path/to/your/pdf/folder

Replace both paths with your real ones. It prints one line per PDF as it reads
them, then tells you where it saved the result.

By default it writes everything into one file here:

    chord-reader/library/songs.chordpro

That `library` folder is ignored by git, so your real songs never leave your
Mac. Your original PDFs stay untouched — the script only reads them.

### Trying it without any PDFs

To see exactly what the script does, using an invented example song:

    node tools/pdf-to-chordpro.mjs --demo

It shows you the raw text on top and the converted version underneath, so you
can see the chords being lifted onto the lyric lines.

### What it understands

- The header at the top: **tuning**, **capo** and **key**.
- Section names in square brackets: `[Intro]`, `[Verse 1]`, `[Chorus]`,
  `[Interlude]`, `[Outro]` and anything else in that shape.
- Chord lines sitting directly above their lyric line. Each chord ends up
  exactly where it sat in the PDF, even mid-word — that is on purpose, it is
  where you actually change chord.
- Chord-only lines, including repeat markers like `x2`.
- Songs that run over more than one page.

It ignores pictures, page numbers and web addresses left behind by the export.

### If a song comes out wrong

Nothing is lost — your PDFs are untouched, so you can always run it again.
Step 2 includes a plain text editor so you can fix any song by hand.
