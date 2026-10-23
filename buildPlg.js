#!/usr/bin/env node

'use strict';

var util = require('./util');
var writeUTF16 = util.writeUTF16;

function main(args) {
  var fs = require('fs');
  var path = require('path');
  var config = util.loadConfig();

  var directory;
  var pluginFilename;

  if (args.length === 0) {
    directory = config.srcDir;
    pluginFilename = config.pluginFilename;
  } else if (args.length === 1 && args[0] === 'test') {
    directory = config.testDir;
    pluginFilename = 'Test' + config.pluginFilename;
  } else {
    directory = args[0];
    pluginFilename = args[1];
  }

  if (!directory || !pluginFilename) {
    console.log("Usage: buildPlg [directory plg-filename | test]" );
    console.log("No args - builds configured plugin" );
    console.log("Arg is 'test' - builds configured test plugin" );
    console.log("Plugin file is written to configured build directory");
    process.exit(1);
  }

  var output = '{\n';

  try {
    var globals = path.join(directory, 'GLOBALS.mss');
    addFileToOutput(globals);
  } catch (e) {
    // NOP
  }

  try {
    var dialogDirectory = path.join(directory, 'dialog');
    var dialogsDir = fs.readdirSync(dialogDirectory).sort();
    dialogsDir
      .filter(function(name) { return name.match(/.+\.msd$/)})
      .forEach(function(name) { addFileToOutput(path.join(dialogDirectory, name))});
  } catch (e) {
    // NOP
  }

  // files are processed in sorted order so that builds are reproducible
  function buildFromDir(dirPath) {
    var dir = fs.readdirSync(dirPath).sort();
    var fullPaths = dir.map(function(name) {
      return path.join(dirPath, name)
    });

    fullPaths
      .filter(function(path) { return path.match(/.+\.mss$/) && !path.match(/(^|\/)GLOBALS\.mss$/)})
      .forEach(addMethodFileToOutput);

    fullPaths
      .filter(function(path) { return fs.statSync(path).isDirectory(); })
      .forEach(buildFromDir);
  }

  function addFileToOutput(mssFilename) {
    var data = util.readText(mssFilename);

    if (data.length) {
      output += data;
      output += '\n';
    }
  }

  function end() {
    output += '}\n';
    writeUTF16(path.join(config.buildDir, pluginFilename), output);
    console.log('written plugin code to ' + pluginFilename);
  }

  var funcRegex = /function\s*([_a-zA-Z][_a-zA-Z0-9$]*)\s*(\(.*\))\s*\{/;
  var moduleLineRegex = /\s*\/\/\$module\(([\w/]+\.mss)\)/;

  function proposedFromPath(mssFilename) {
    return path.relative(directory, mssFilename).split(path.sep).join('/');
  }

  function addMethodFileToOutput(mssFilename) {

    var proposedModuleName = proposedFromPath(mssFilename);

    var head = '';
    var moduleName = '';
    var module = '';
    var body = '';

    util.readLines(mssFilename).forEach(function(line) {
      var func = funcRegex.exec(line);
      if (func) {
        var mssFuncLine = '\t' + func[1] + ' "' + func[2] + ' {\n';
        console.log('function: ' + func[1]);
        head = mssFuncLine;
        // anything between the previous //$end and this header is not code
        body = '';
        if (func[1] + '.mss' !== proposedModuleName) {
          module = '//$module(' + proposedModuleName + ')\n'
        }
      } else if (line.match(/^}\s*\/\/\$end/)) {
        body = body + '}"\n';
        output += head;
        if (module.length) output += module;
        output += body;
        output += '\n';
        head = module = body = '';
      } else if (moduleName = moduleLineRegex.exec(line)) {
        module = '//$module(' + moduleName[1] + ')\n'
      } else {
        body += line;
        body += '\n';
      }
    });
  }

  buildFromDir(directory);
  end();
}

main(process.argv.slice(2));