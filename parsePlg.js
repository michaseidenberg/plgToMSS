#!/usr/bin/env node
'use strict';

var util = require('./util');
var writeUTF16 = util.writeUTF16;

function main(args) {
  var fs = require('fs');
  var path = require('path');
  var config = util.loadConfig();

  var directory;
  var filename;
  var dialogsOnly = false;

  if (args.length === 0) {
    directory = config.srcDir;
    filename = path.join(config.importDir, config.pluginFilename);
  } else if (args.length === 1 && args[0] === 'test') {
    directory = config.testDir;
    filename = path.join(config.importDir, 'Test' + config.pluginFilename);
  } else if (args.length === 1 && args[0] === 'dialogs') {
    directory = config.srcDir;
    filename = path.join(config.importDir, config.pluginFilename);
    dialogsOnly = true;
  } else {
    filename = args[0];
    directory = args[1];
  }

  if (!directory || !filename) {
    console.log("Usage: parsePlg [plugin-filename output-directory | test | dialogs ]" );
    console.log("No args - parses configured plugin" );
    console.log("Arg is 'test' - parses configured test plugin" );
    console.log("Plugin file must be in configured import directory");
    process.exit(1);
  }

  var data = '';
  var currentModule = '';
  var currentModulePath = '';
  var filesWritten = {};
  var level = 0;
  var globals = [];
  var pendingFunc = null;

  // Sibelius writes method headers as 'Name "(args) {', but also
  // 'Name "(args){ code...', one-liners 'Name "(){ code }"', and
  // 'Name "(args)' with the opening brace on the next line
  var functionRegex = /^\s*(\w+)\s+"(\(\s*(?:\w+\s*(?:,\s*\w+\s*)*)?\))\s*(\{.*)?$/;
  var endFunctionRegex = /^(.*)}"\s*$/;
  var moduleLineRegex = /^\s*\/\/\$module\(([\w./]+)\)/;

  var dialogRegex = /^\s*(\w+)\s+"Dialog"\s*$/;
  var startDialogSegmentRegex = /^\s*\{/;
  var endDialogSegmentRegex = /^\s*}/;

  fs.mkdirSync(path.join(directory, 'dialog'), {recursive: true});

  console.log('Processing: %s', filename);

  var processFn = processLine;

  util.readLines(filename).forEach(function(line) {
    processFn(line);
  });

  if (!dialogsOnly) {
    writeGlobals();
  }

  console.log('Finished: written to ' + directory);

  // globals are kept verbatim (array data and multi-line strings contain
  // their own braces and indentation), only the plugin's outer braces and
  // surrounding blank lines go
  function writeGlobals() {
    var lines = globals.slice();
    trimBlank(lines);
    if (lines.length && lines[0].trim() === '{') lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === '}') lines.pop();
    trimBlank(lines);
    writeUTF16(path.join(directory, 'GLOBALS.mss'), lines.join('\n'));
  }

  function trimBlank(lines) {
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  }

  function processLine(line) {
    line = line.replace(/^[﻿￯]/, '');

    if (pendingFunc) {
      var header = pendingFunc;
      pendingFunc = null;
      if (line.trim()[0] === '{') {
        startFunction(header.name, header.args, line.trim());
      } else {
        // not a method after all
        globals.push(header.line);
        processLine(line);
      }
      return;
    }

    var func = functionRegex.exec(line);
    if (func) {
      if (func[3] === undefined) {
        pendingFunc = {name: func[1], args: func[2], line: line};
      } else {
        startFunction(func[1], func[2], func[3]);
      }
      return;
    }

    var dialog = dialogRegex.exec(line);
    if (dialog) {
      console.log('dialog ' + dialog[1]);
      data = line;
      data += '\n';
      processFn = processDialogLineFunc(path.join(directory, 'dialog', dialog[1] + '.msd'));
      return;
    }

    globals.push(line);
  }

  // rest is the remainder of the header line, starting with the opening brace
  function startFunction(name, args, rest) {
    console.log('function ' + name + args);
    data = 'function ' + name + args + ' ' + '{\n';
    processFn = processFunctionLineFunc(path.join(directory, name + '.mss'));
    rest = rest.substring(1);
    if (endFunctionRegex.exec(rest)) {
      processFn(rest);
    } else if (rest.trim().length) {
      processFn(rest.replace(/^\s+/, ''));
    }
  }

  function processDialogLineFunc(filename) {
    return function (line) {
      if (startDialogSegmentRegex.exec(line)) level++;
      if (endDialogSegmentRegex.exec(line)) level--;

      data += line;
      data += '\n';
      if (level === 0) {
        writeUTF16(filename, data);
        processFn = processLine;
      }
    }
  }

  function processFunctionLineFunc(filename) {
    return function (line) {
      var isModuleLine = moduleLineRegex.exec(line);
      if (isModuleLine) {
        currentModulePath = path.join(directory, path.dirname(isModuleLine[1]));
        currentModule = path.join(directory, isModuleLine[1]);
        data += line;
        data += '\n';
        return;
      }

      var isEndFunc = endFunctionRegex.exec(line);
      if (isEndFunc) {
        var ending = isEndFunc[1];
        if (ending.trim().length) {
          ending += '\n';
        } else {
          ending = '';
        }
        data += ending + '} //$end\n\n';
        if (dialogsOnly) {
          // methods are skipped, only dialogs are written
        } else if (currentModule) {
          fs.mkdirSync(currentModulePath, {recursive: true});
          writeUTF16(currentModule, data, {append: !!filesWritten[currentModule]});
          filesWritten[currentModule] = true;
        } else {
          console.log(filename);
          writeUTF16(filename, data);
          filesWritten[filename] = true;
        }
        currentModule = '';
        processFn = processLine;
        return;
      }

      data += line;
      data += '\n';
    }
  }
}

main(process.argv.slice(2));
