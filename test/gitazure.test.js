var should = require('should')
  , http = require('http')
  , GitAzure = require('../')
  , port = 20000;

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

describe('GitAzure', function() {
  describe('#listen', function() {
    it('leaves other requests alone', function(done) {
      var srv = makeServer(++port, function() {
        GitAzure.listen(srv, 'https://github.com/einaros/Test');
        request(port, '/foo', function (data) {
          data.should.eql('/foo');
          srv.close();
          done();
        })
      });
    });

    it('processes requests to hook url, matching the repository url and branch', function(done) {
      var srv = makeServer(++port, function() {
        var hook = GitAzure.listen(srv, 'https://github.com/einaros/Test');
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/master'
        }
        var called = false;
        hook.processPayload = function(payload, branch, res) { called = true; res.end(); }
        request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        })
      });
    });

    it('processes requests to hook url, matching the repository url and custom branch', function(done) {
      var srv = makeServer(++port, function() {
        var hook = GitAzure.listen(srv, 'https://github.com/einaros/Test', 'azure');
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/azure'
        }
        var called = false;
        hook.processPayload = function(payload, branch, res) { called = true; res.end(); }
        request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        })
      });
    });

    it('does not process requests to hook url, matching the repository url but missing custom branch', function(done) {
      var srv = makeServer(++port, function() {
        var hook = GitAzure.listen(srv, 'https://github.com/einaros/Test', 'azure');
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/master'
        }
        var called = false;
        hook.processPayload = function(payload, branch, res) { called = true; res.end(); }
        request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        })
      });
    });

    it('does not process requests to hook url, matching the branch but missing respository url', function(done) {
      var srv = makeServer(++port, function() {
        var hook = GitAzure.listen(srv, 'https://github.com/einaros/Test', 'azure');
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test2'
          },
          ref: 'refs/heads/azure'
        }
        var called = false;
        hook.processPayload = function(payload, branch, res) { called = true; res.end(); }
        request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        })
      });
    });

  });
});