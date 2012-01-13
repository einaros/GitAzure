var http = require('http');

function makeServer(port, cb) {
  var srv = http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(req.url);
  });
  srv.listen(port, '127.0.0.1', cb);
  return srv;
}

function request(port, path, data, cb) {
  if (typeof data == 'function') { 
    cb = data;
    data = null;
  }
  var options = {
    host: '127.0.0.1',
    port: port,
    path: path
  };
  if (data) {
    options.method = 'POST';
    var req = http.request(options, function(res) {
      var output = '';
      res.on('data', function(data) {
        output += data.toString('utf8');
      });
      res.on('end', function() {
        cb(output);
      });
    });
    req.write(data);
    req.end();
  }
  else 
  {
    var output = '';
    http.get(options, function(res) {
      res.on('data', function(data) {
        output += data.toString('utf8');
      });
      res.on('end', function() {
        cb(output);
      });
    }).on('error', function(e) {
    });
  }
}

function fakeSpawn() {
  var emitter = new process.EventEmitter(); 
  emitter.stdout = new process.EventEmitter();
  emitter.stdin = new process.EventEmitter();
  emitter.stderr = new process.EventEmitter();
  return emitter;
}

module.exports = {
  makeServer: makeServer,
  request: request,
  fakeSpawn: fakeSpawn
}
