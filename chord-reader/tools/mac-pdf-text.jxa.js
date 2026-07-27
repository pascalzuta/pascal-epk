// Reads a chord sheet out of a PDF using only what macOS already has, so
// nothing needs installing.
//
// Run by osascript, never by node:
//     osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>
//
// Two ways in, tried in that order:
//
//   1. Real text. Apple's PDF engine can report the exact rectangle every
//      character sits in.
//   2. If the page turns out to be a picture of a chord sheet rather than a
//      chord sheet, the same text recognition the Photos app uses reads the
//      picture, and reports a rectangle for every word.
//
// Either way we end up with words and their positions, and the columns are
// rebuilt from those. That is what tells the converter which chord sits over
// which syllable. If any page had to be read as a picture, the very first line
// of output is the marker %%READ-AS-PICTURE%% so you can be told.

ObjC.import('Quartz');
ObjC.import('Vision');
ObjC.import('Foundation');

var MEDIA_BOX = 0; // kPDFDisplayBoxMediaBox
var ACCURATE = 0; // VNRequestTextRecognitionLevelAccurate
var RENDER_SCALE = 3; // bigger picture, better recognition
var TOO_LITTLE_TEXT = 20; // fewer characters than this means there is none

function median(numbers) {
  if (numbers.length === 0) return 0;
  var sorted = numbers.slice().sort(function (a, b) {
    return a - b;
  });
  return sorted[Math.floor(sorted.length / 2)];
}

// --- 1. the page as real text ----------------------------------------------

function charactersOnPage(page) {
  var text = ObjC.unwrap(page.string) || '';
  var count = page.numberOfCharacters;
  var characters = [];

  for (var i = 0; i < count; i++) {
    var ch = text[i];
    if (ch === undefined || ch === '\n' || ch === '\r') continue;

    var box;
    try {
      box = page.characterBoundsAtIndex(i);
    } catch (e) {
      continue;
    }
    if (!(box.size.width > 0) || !(box.size.height > 0)) continue;

    characters.push({
      ch: ch,
      x: box.origin.x,
      y: box.origin.y,
      w: box.size.width,
      h: box.size.height,
    });
  }
  return characters;
}

// Characters are gathered into words. Placing single characters on a grid
// pushes them into each other, because real type is not evenly spaced: an "i"
// is half the width of an "m".
function charactersToWords(characters) {
  var widths = characters
    .filter(function (c) {
      return c.ch !== ' ';
    })
    .map(function (c) {
      return c.w;
    });
  var gapThatSeparates = median(widths) * 0.4;

  var byLine = {};
  characters.forEach(function (c) {
    var key = Math.round(c.y);
    if (!byLine[key]) byLine[key] = [];
    byLine[key].push(c);
  });

  var words = [];
  Object.keys(byLine).forEach(function (key) {
    var row = byLine[key].sort(function (a, b) {
      return a.x - b.x;
    });
    var word = null;
    row.forEach(function (c) {
      var separated =
        word === null || c.ch === ' ' || c.x - (word.x + word.w) > gapThatSeparates;
      if (separated) {
        if (c.ch === ' ') {
          word = null;
          return;
        }
        word = { text: c.ch, x: c.x, y: c.y, w: c.w, h: c.h };
        words.push(word);
      } else {
        word.text += c.ch;
        word.w = c.x + c.w - word.x;
      }
    });
  });
  return words;
}

// --- 2. the page as a picture ----------------------------------------------

function wordsByRecognisingPicture(page) {
  var bounds = page.boundsForBox(MEDIA_BOX);
  var size = $.NSMakeSize(
    bounds.size.width * RENDER_SCALE,
    bounds.size.height * RENDER_SCALE
  );
  var picture = page.thumbnailOfSizeForBox(size, MEDIA_BOX);
  var data = picture.TIFFRepresentation;

  var handler = $.VNImageRequestHandler.alloc.initWithDataOptions(data, $());
  var request = $.VNRecognizeTextRequest.alloc.init;
  request.recognitionLevel = ACCURATE;
  // Left on, this "corrects" chord names into English words. Am becomes Are.
  request.usesLanguageCorrection = false;

  handler.performRequestsError($([request]), $());

  var results = request.results;
  if (!results || results.isNil()) return [];

  var words = [];
  var count = results.count;
  for (var i = 0; i < count; i++) {
    var observation = results.objectAtIndex(i);
    var candidates = observation.topCandidates(1);
    if (candidates.isNil() || candidates.count === 0) continue;

    var candidate = candidates.objectAtIndex(0);
    var line = ObjC.unwrap(candidate.string) || '';

    // Each word is asked for its own rectangle, because a whole recognised
    // line tells us nothing about where within it a chord sits.
    var finder = /\S+/g;
    var match;
    while ((match = finder.exec(line)) !== null) {
      var box = null;
      try {
        var piece = candidate.boundingBoxForRangeError(
          $.NSMakeRange(match.index, match[0].length),
          $()
        );
        if (piece && !piece.isNil()) box = piece.boundingBox;
      } catch (e) {
        box = null;
      }
      if (box === null) box = observation.boundingBox;

      // Vision measures 0 to 1 across the picture, from the bottom left.
      words.push({
        text: match[0],
        x: box.origin.x * size.width,
        y: box.origin.y * size.height,
        w: box.size.width * size.width,
        h: box.size.height * size.height,
      });
    }
  }
  return words;
}

// --- laying the words back out ----------------------------------------------

function wordsToLayoutText(words) {
  if (words.length === 0) return '';

  var lineHeight = median(
    words.map(function (w) {
      return w.h;
    })
  );
  // A typical single character width, worked out from whole words so that it
  // does not matter whether they came from text or from a picture.
  var columnWidth = median(
    words.map(function (w) {
      return w.w / Math.max(1, w.text.length);
    })
  );
  if (!(columnWidth > 0)) columnWidth = lineHeight * 0.5;
  var sameLine = lineHeight * 0.6;

  // Down the page first. PDF pages measure upwards from the bottom, so a
  // larger y is higher up.
  words.sort(function (a, b) {
    return b.y - a.y;
  });

  var lines = [];
  var current = null;
  words.forEach(function (w) {
    if (current === null || Math.abs(current.y - w.y) > sameLine) {
      current = { y: w.y, words: [] };
      lines.push(current);
    }
    current.words.push(w);
  });

  var leftEdge = Math.min.apply(
    null,
    words.map(function (w) {
      return w.x;
    })
  );

  return lines
    .map(function (line) {
      line.words.sort(function (a, b) {
        return a.x - b.x;
      });
      var out = '';
      line.words.forEach(function (w) {
        var column = Math.round((w.x - leftEdge) / columnWidth);
        // Words never touch: there is always at least one space between them.
        if (column <= out.length) column = out.length === 0 ? 0 : out.length + 1;
        while (out.length < column) out += ' ';
        out += w.text;
      });
      return out.replace(/\s+$/, '');
    })
    .join('\n');
}

// --- putting it together ----------------------------------------------------

var hadToReadAPicture = false;

function pageToLayoutText(page) {
  var characters = charactersOnPage(page);
  if (characters.length >= TOO_LITTLE_TEXT) {
    return wordsToLayoutText(charactersToWords(characters));
  }
  hadToReadAPicture = true;
  return wordsToLayoutText(wordsByRecognisingPicture(page));
}

function write(handle, text) {
  handle.writeData($(text).dataUsingEncoding($.NSUTF8StringEncoding));
}

function run(argv) {
  if (argv.length < 1) {
    write(
      $.NSFileHandle.fileHandleWithStandardError,
      'usage: osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>\n'
    );
    return;
  }

  var url = $.NSURL.fileURLWithPath($(argv[0]));
  var doc = $.PDFDocument.alloc.initWithURL(url);
  if (!doc || doc.isNil()) throw new Error('this file could not be opened as a PDF');
  if (doc.isEncrypted && doc.isLocked) throw new Error('this PDF is locked');

  var pages = [];
  for (var i = 0; i < doc.pageCount; i++) {
    pages.push(pageToLayoutText(doc.pageAtIndex(i)));
  }

  var text = pages.join('\n\n');
  if (hadToReadAPicture) text = '%%READ-AS-PICTURE%%\n' + text;
  write($.NSFileHandle.fileHandleWithStandardOutput, text);
}
