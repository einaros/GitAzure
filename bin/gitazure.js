#!/usr/bin/env node

var readline = require('readline')
  , http = require('http')
  , url = require('url')
  , zlib = require('zlib');

function download(uri, cb) {
  var uri = url.parse(uri);
  var options = {
    host: uri.hostname,
    port: uri.port||80,
    path: uri.path
  };
  var buffers = [];
  var totalSize = 0;
  http.get(options, function(res) {
    if (res.statusCode > 300 && res.statusCode < 304) {
      var location = res.headers.location;
      if (typeof location == 'undefined') {
        cb(new Error('redirect missing location'));
        return;
      }
      process.nextTick(function() { download(location, cb); });
      return;
    }
    res.on('data', function(data) {
      buffers.push(data);
      totalSize += data.length;
    });
    res.on('end', function() {
      var merged = new Buffer(totalSize);
      var written = 0;
      for (var i = 0, l = buffers.length; i < l; ++i) {
        buffers[i].copy(merged, written);
        written += buffers[i].length;
      }
      cb(null, merged);
    });
  }).on('error', function(e) {
    cb(e);
  });
}

download('http://downloads.sourceforge.net/sevenzip/7za920.zip', function(error, buffer) {
  if (error) {
    console.error(error);
    process.exit(-1);
    return;
  }
  /*zlib.unzip(buffer, function(error, buffer) {
    if (error) {
      console.error(error);
      process.exit(-1);
      return;
    }
    console.log(buffer.length);
  });*/
  require('fs').writeFileSync('out', buffer);
});

/*
var gzip = zlib.createGzip();
var fs = require('fs');
var inp = fs.createReadStream('input.txt');
var out = fs.createWriteStream('input.txt.gz');
inp.pipe(gzip).pipe(out);
*/