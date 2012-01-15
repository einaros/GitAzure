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

  it('executes git and no npm for simple update', function(done) {
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
        order.length.should.eql(2);
        order[0].should.eql(['git', 'fetch', 'origin']);
        order[1].should.eql(['git', 'reset', '--hard', 'origin/azure']);
        srv.close();
        done();
      })
    });
  });

  it('executes git, npm install and npm prune for changeset which updates package.json', function(done) {
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
        order.length.should.eql(4);
        order[0].should.eql(['git', 'fetch', 'origin']);
        order[1].should.eql(['git', 'reset', '--hard', 'origin/azure']);
        order[2].should.eql(['bin\\npm.cmd', 'install']);
        order[3].should.eql(['bin\\npm.cmd', 'prune']);
        srv.close();
        done();
      })
    });
  });

  it('touches gitazure\'s server.js for gitazure.json update', function(done) {
    var srv = util.makeServer(++port, function() {
      var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'foobar' });
      var payload = {
        repository: {
          url: 'https://github.com/einaros/Test'
        },
        ref: 'refs/heads/foobar',
        commits: [
          { modified: [ 'gitazure.json' ] } 
        ]
      }

      child_proc.spawn = function(command, args) {
        var proc = util.fakeSpawn();
        process.nextTick(function() { proc.emit('exit', 0); });
        return proc;
      }
      var utimesOrder = [];
      fs.utimesSync = function(path) {
        utimesOrder.push(path);
      }

      util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
        utimesOrder.length.should.eql(2);
        utimesOrder[1].should.match(/GitAzure\/lib\/\.\.\/server.js$/);
        srv.close();
        done();
      })
    });
  });

  describe('custom config', function() {
    it('executes git and npm install but no npm prune for changeset which updates package.json, when npmPrune is false', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
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
          order[0].should.eql(['git', 'fetch', 'origin']);
          order[1].should.eql(['git', 'reset', '--hard', 'origin/azure']);
          order[2].should.eql(['bin\\npm.cmd', 'install']);
          srv.close();
          done();
        })
      });
    });

    it('executes git, but no npm install nor npm prune for changeset which updates package.json, when npmInstall is false', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'master', npmInstall: false });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/master',
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
          order.length.should.eql(2);
          order[0].should.eql(['git', 'fetch', 'origin']);
          order[1].should.eql(['git', 'reset', '--hard', 'origin/master']);
          srv.close();
          done();
        })
      });
    });      
  });
});
