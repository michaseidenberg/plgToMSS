#!/usr/bin/env node
'use strict';

function main(pluginFileNames) {
  var fs = require('fs');
  var path = require('path');
  var config = require('./util').loadConfig();

  var pluginDirectory = path.join(config.plgPath, config.plgCategory);
  var pluginFiles = pluginFileNames && pluginFileNames.length
    ? pluginFileNames
    : config.pluginFilename
      ? [config.pluginFilename]
      : fs.readdirSync(pluginDirectory)
        .filter(function(filename) {return filename.match(/\.plg$/);});

  var importDirectory = config.importDir;
  fs.mkdirSync(importDirectory, {recursive: true});

  console.log('Importing plugins from ' + pluginDirectory + '...' );
  pluginFiles.forEach(function(filename) {
    console.log(filename);

    fs.copyFileSync(path.join(pluginDirectory, filename), path.join(importDirectory, filename));
  });
  console.log('done');
}

main(process.argv.slice(2));
