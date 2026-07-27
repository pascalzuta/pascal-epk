// Reads the text layer out of a PDF using the PDF reader already built into
// macOS, so nothing has to be installed.
//
// Run by osascript, never by node:
//     osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>
//
// Apple's PDFKit can tell us the exact rectangle every single character sits
// in. That is better information than a text dump gives, so the columns are
// rebuilt from the real positions: characters are grouped into lines by how
// far down the page they are, then spaced out across the line by how far
// across they are. The result looks like "pdftotext -layout", which is what
// the converter expects.

ObjC.import('Quartz');
ObjC.import('Foundation');

function median(numbers) {
  if (numbers.length === 0) return 0;
  var sorted = numbers.slice().sort(function (a, b) {
    return a - b;
  });
  return sorted[Math.floor(sorted.length / 2)];
}

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
    var width = box.size.width;
    var height = box.size.height;
    // Characters PDFKit invented (line breaks and the like) have no size.
    if (!(width > 0) || !(height > 0)) continue;

    characters.push({ x: box.origin.x, y: box.origin.y, w: width, h: height, ch: ch });
  }
  return characters;
}

function pageToLayoutText(page) {
  var characters = charactersOnPage(page);
  if (characters.length === 0) return '';

  var heights = characters.map(function (c) {
    return c.h;
  });
  var widths = characters
    .filter(function (c) {
      return c.ch !== ' ';
    })
    .map(function (c) {
      return c.w;
    });

  var lineHeight = median(heights);
  var columnWidth = median(widths);
  if (!(columnWidth > 0)) columnWidth = lineHeight * 0.5;
  var sameLine = lineHeight * 0.6;

  // Down the page first. PDF pages measure upwards from the bottom, so a
  // larger y is higher up.
  characters.sort(function (a, b) {
    return b.y - a.y;
  });

  var lines = [];
  var current = null;
  characters.forEach(function (c) {
    if (current === null || Math.abs(current.y - c.y) > sameLine) {
      current = { y: c.y, chars: [] };
      lines.push(current);
    }
    current.chars.push(c);
  });

  var leftEdge = Math.min.apply(
    null,
    characters.map(function (c) {
      return c.x;
    })
  );

  return lines
    .map(function (line) {
      line.chars.sort(function (a, b) {
        return a.x - b.x;
      });

      // Group into words first. Placing single characters on a grid pushes
      // them into each other, because real type is not evenly spaced: an "i"
      // is half the width of an "m". Words keep their own spacing and only
      // their starting point is placed on the grid.
      var words = [];
      var word = null;
      var gapThatSeparates = columnWidth * 0.4;
      line.chars.forEach(function (c) {
        var separated =
          word === null ||
          c.ch === ' ' ||
          c.x - (word.x + word.width) > gapThatSeparates;
        if (separated) {
          if (c.ch === ' ') {
            word = null;
            return;
          }
          word = { x: c.x, width: c.w, text: c.ch };
          words.push(word);
        } else {
          word.text += c.ch;
          word.width = c.x + c.w - word.x;
        }
      });

      var out = '';
      words.forEach(function (w) {
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

function run(argv) {
  if (argv.length < 1) {
    $.NSFileHandle.fileHandleWithStandardError.writeData(
      $('usage: osascript -l JavaScript mac-pdf-text.jxa.js <file.pdf>\n').dataUsingEncoding(
        $.NSUTF8StringEncoding
      )
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
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(
    $(text).dataUsingEncoding($.NSUTF8StringEncoding)
  );
}
