#!/usr/bin/env node

var readline = require('readline')
  , rl = readline.createInterface(process.stdin, process.stdout)
  , util = require('util')
  , spawn = require('child_process').spawn
  , fs = require('fs');

function copyFiles(src, dst, cb) {
  var xcopy = spawn('xcopy', ['/s', src, dst]);
  xcopy.stdout.on('data', function (data) {});
  xcopy.stderr.on('data', function (data) {
    console.log(data.toString('utf8'));
  });
  xcopy.on('exit', function (code) {
    cb(code == 0);
  });
}

function fileExists(path) {
  try {
    fs.statSync(path);
  }
  catch (e) { return false; }
  return true;
}

/*if (!fileExists('../ServiceDefinition.csdef')) {
  console.error('Please run GitAzure from within a node.js web role');
  process.exit(-1);
}*/
var depsFolder = __dirname + '\\..\\deps\\';
copyFiles(depsFolder + '7z\\7za.exe', 'bin\\', function(code) {
  if (!code) {
    console.error('File copy failed. Please verify that the current folder has a "bin" subfolder, which is writable.');
    process.exit(-1);
    return;
  }
  copyFiles(depsFolder + 'scripts\\*', 'bin\\', function(code) {
    if (!code) {
      console.error('File copy failed. Please verify that the current folder has a "bin" subfolder, which is writable.');
      process.exit(-1);
      return;
    }

  });
});
