var should = require('should')
  , http = require('http')
  , child_proc = require('child_process')
  , GitAzure = require('../')
  , util = require('./util')
  , fs = require('fs')
  , port = 20000;

describe('GitAzure', function() {
  var originalSpawn = child_proc.spawn;
  var originalUtimesSync = fs.utimesSync;
  beforeEach(function(){
    child_proc.spawn = originalSpawn;
    fs.utimesSync = originalUtimesSync;
  }) 

  describe('#listen', function() {
    it('leaves other requests alone', function(done) {
      var srv = util.makeServer(++port, function() {
        GitAzure.listen(srv, 'https://github.com/einaros/Test');
        util.request(port, '/foo', function (data) {
          data.should.eql('/foo');
          srv.close();
          done();
        })
      });
    });

    it('processes requests to hook url, without any parameters', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv);
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/master'
        }
        var called = false;
        hook.processPayload = function(payload, res) { called = true; res.end(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        })
      });
    });

    it('processes requests to hook url, matching the repository url and custom branch', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/azure'
        }
        var called = false;
        hook.processPayload = function(payload, res) { called = true; res.end(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        })
      });
    });

    it('does not process requests to hook url, matching the repository url but missing custom branch', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/master'
        }
        var called = false;
        hook.processPayload = function(payload, res) { called = true; res.end(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        })
      });
    });

    it('does not process requests to hook url, matching the branch but missing respository url', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test2'
          },
          ref: 'refs/heads/azure'
        }
        var called = false;
        hook.processPayload = function(payload, res) { called = true; res.end(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        })
      });
    });

    it('executes git pull and no npm for simple update', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/azure',
          commits: [
            { modified: [ 'foo' ] }, 
            { modified: [ 'bar' ] }, 
          ]
        }

        var order = [];
        child_proc.spawn = function(command, args) {
          args.unshift(command);
          order.push(args);
          var proc = util.fakeSpawn();
          process.nextTick(function() { proc.emit('exit', 0); });
          return proc;
        }
        fs.utimesSync = function(path) { }

        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          order.length.should.eql(1);
          order[0].should.eql(['git', 'pull', 'origin', 'azure']);
          srv.close();
          done();
        })
      });
    });

    it('executes git pull, npm install and npm prune for changeset which updates package.json', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/azure',
          commits: [
            { modified: [ 'foo' ] }, 
            { modified: [ 'package.json' ] }, 
          ]
        }

        var order = [];
        child_proc.spawn = function(command, args) {
          args.unshift(command);
          order.push(args);
          var proc = util.fakeSpawn();
          process.nextTick(function() { proc.emit('exit', 0); });
          return proc;
        }
        fs.utimesSync = function(path) { }

        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          order.length.should.eql(3);
          order[0].should.eql(['git', 'pull', 'origin', 'azure']);
          order[1].should.eql(['bin\\npm.cmd', 'install']);
          order[2].should.eql(['bin\\npm.cmd', 'prune']);
          srv.close();
          done();
        })
      });
    });
  });
});
