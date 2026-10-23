'use strict';

var fs = require('fs');
var path = require('path');

module.exports = {
  writeUTF16: writeUTF16,
  readText: readText,
  readLines: readLines,
  loadConfig: loadConfig
};

var UTF16LE_BOM = Buffer.from([0xff, 0xfe]);

// Detect the encoding of a file: Sibelius writes UTF-16 LE with BOM,
// files created in an external editor are usually UTF-8.
function detectEncoding(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf16le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf16be';
  // UTF-16 LE without BOM: ASCII characters have a zero high byte
  if (buffer.length >= 2 && buffer[0] !== 0 && buffer[1] === 0) return 'utf16le';
  return 'utf8';
}

// Read a text file in its detected encoding, without BOM.
function readText(filename) {
  var buffer = fs.readFileSync(filename);
  var encoding = detectEncoding(buffer);
  var text;
  if (encoding === 'utf16be') {
    var swapped = Buffer.from(buffer);
    swapped.swap16();
    text = swapped.toString('utf16le');
  } else {
    text = buffer.toString(encoding);
  }
  return text.replace(/^﻿/, '');
}

// Read a text file as an array of lines (same semantics as readline:
// no trailing empty line if the file ends with a newline).
function readLines(filename) {
  var lines = readText(filename).split(/\r\n|\r|\n/);
  if (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

// Write data as UTF-16 LE. A BOM is written only at the start of a file,
// so appending to an existing file does not insert a BOM mid-file.
function writeUTF16(filename, data, opts) {
  var append = !!(opts && opts.append && fs.existsSync(filename));
  var buffer = Buffer.from(data, 'utf16le');
  if (append) {
    fs.appendFileSync(filename, buffer);
  } else {
    fs.writeFileSync(filename, Buffer.concat([UTF16LE_BOM, buffer]));
  }
}

function loadConfig() {
  var configFile = path.join(process.cwd(), 'plgconfig.js');
  if (!fs.existsSync(configFile)) {
    console.log('No plgconfig.js found in %s - run initPlg first', process.cwd());
    process.exit(1);
  }
  return require(configFile);
}
