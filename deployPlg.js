#!/usr/bin/env node
'use strict';

function main(pluginFileNames) {
  var fs = require('fs');
  var path = require('path');
  var config = require('./util').loadConfig();

  var pluginFiles = pluginFileNames && pluginFileNames.length
    ? pluginFileNames
    : config.pluginFilename
      ? [config.pluginFilename, 'Test' + config.pluginFilename]
      : fs.readdirSync(config.buildDir)
          .filter(function(filename) {return filename.match(/\.plg$/);});

  var destDirectory = path.join(config.plgPath, config.plgCategory);
  fs.mkdirSync(destDirectory, {recursive: true});

  console.log('Deploying plugins to ' + destDirectory + '...' );
  pluginFiles.forEach(function(filename) {
    console.log(filename);

    var fileToCopy = path.join(config.buildDir, filename);
    if (fs.existsSync(fileToCopy)) {
      fs.copyFileSync(fileToCopy, path.join(destDirectory, filename));
    } else {
      console.log('(%s not found)', fileToCopy);
    }
  });

  if (config.linkLibraries) {
    config.linkLibraries.forEach(function(filename) {
      console.log('copying linked library %s', filename);
      var fileToCopy = path.join(config.libDir, filename);
      if (fs.existsSync(fileToCopy)) {
        fs.copyFileSync(fileToCopy, path.join(destDirectory, filename));
      } else {
        console.log('library %s could not be copied', fileToCopy);
      }
    });
  }

  console.log('done');
  console.log('Restart Sibelius to load the deployed plugins.');
}

main(process.argv.slice(2));
