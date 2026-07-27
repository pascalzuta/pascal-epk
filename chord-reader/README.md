# Chord reader

A private chord sheet reader for live guitar playing. Nothing here has anything
to do with the EPK website in the rest of this repository.

All three steps are done: converting the PDFs, the reader, and the scrolling.

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
The reader has a plain text editor so you can fix any song by hand.

## Step 2 — the reader

### The first time

    cd ~/path/to/pascal-epk/chord-reader
    npm install

### Every time you want to use it

    npm run build
    npm run preview

Terminal prints an address. Open it in Safari. Leave that Terminal window
running while you use the app.

`npm run build` is what folds your songs into the app, so run it again after
every time you run the PDF converter.

While changing the app itself, `npm run dev` reloads as files are edited.

### What is in it

- **Songs** — everything in your library, tap one to open it.
- **Setlist** — put songs in the order you will play them, move them up and
  down. Once a song is in the setlist, its screen always shows the next song's
  title, and tapping that goes straight there.
- **Key** (top right of a song) — three controls:
  - **Transpose** moves the whole song up or down. The room hears the change.
  - **Capo** keeps the song sounding the same and changes the shapes instead.
    So Capo 2 on a song sounding in A shows you G shapes.
  - **Text size** for however far away the stand is.
  - The line under the top bar always reads: capo, shapes to play, and what it
    sounds like.
  - "Back to how it was written" undoes all of it.
- **Edit text** — the whole song file in a plain text box. Fix anything by hand
  on any device. Saving keeps the change on that device.
- The screen will not sleep while a song is open.

Settings, setlist and hand edits are remembered on each device separately.
There is no account and nothing is sent anywhere.

## Step 3 — the scrolling

Every song has two numbers, both under **Setup**:

- **Length** — how long the song runs, in minutes and seconds.
- **Start delay** — quiet seconds before the page starts moving.

A song you have never touched is three minutes with a five second delay, so it
works straight away.

Both are written into the song itself, as `{duration: 3:00}` and
`{start_delay: 5}`. That means they travel in your song file to every device
rather than being stuck on one, and you can see and change them in **Edit text**
like anything else.

### Playing

Press **Start**. Nothing moves for the delay — a large faint number counts it
down — and then the page creeps down at one steady speed, worked out so the last
line arrives exactly as the length runs out. It is a fraction of a pixel per
frame, so it slides rather than jumping line to line.

The controls are all one tap, and none of them need looking at:

- **Tap anywhere on the words** — moves on exactly one line and carries on from
  there at the same speed. This is how you get back in sync. It happens the
  instant you lift your finger.
- **Slower / Faster** — the two big buttons along the bottom. Each press is 5%,
  and the percentage shows in the line under the top bar once it is not 100%.
- **Pause** — the small button in the top right corner, deliberately far from
  where you tap. Press it again to carry on.
- **Restart** — the middle button at the bottom. Always goes back to the top and
  starts again, delay and all.

Dragging with your finger still works normally and the scroll picks up from
wherever you leave it, rather than snapping back.

Speeding up or slowing down is a deliberate change and stays as you set it; the
"finishes exactly on time" promise applies to the plan it starts with.

## Getting it onto the iPhone and iPad

iOS will only keep a web app for offline use if it came from a secure address.
Your Mac cannot give it one over wifi, so there is a songs-free copy of the app
published at **https://zuta.co/chords** and your songs are put in by hand on
each device.

**Nothing of yours is in that published copy.** `npm run publish` moves your
library out of the way before building, then searches every finished file for
your song titles and lyric lines and throws the build away if it finds any.

### Putting your songs on a device

1. On the Mac, open `chord-reader/library/songs.chordpro` and copy all of it.
2. Get that text onto the device (AirDrop the file, or Notes, or email it to
   yourself — whatever is easiest).
3. On the device, open https://zuta.co/chords in Safari.
4. **Share button → Add to Home Screen.** Do this before anything else.
5. Open the app from the home screen, tap **Edit text**, select everything
   that is there, paste yours in, and tap **Save**.

**Add it to the home screen — do not just bookmark it.** Safari throws away
stored data for ordinary web pages you have not opened in a week. Home screen
apps are left alone. Get this wrong and your songs will vanish before a gig.

The file on your Mac stays the master copy. If a device ever loses its songs,
paste them in again.

### Updating the published app

    npm run publish

That rewrites the `chords` folder at the top of this repository. Commit it and
push it to `main` and the new version is live. Devices pick it up next time they
are opened with a signal; songs already pasted in are not touched.
