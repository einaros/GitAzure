var should = require('should')
  , http = require('http')
  , child_proc = require('child_process')
  , GitAzure = require('../')
  , azure = require('azure')
  , util = require('./util')
  , fs = require('fs')
  , port = 20000;

describe('GitAzure', function() {
  var originalSpawn = child_proc.spawn;
  var originalUtimesSync = fs.utimesSync;
  beforeEach(function(){
    child_proc.spawn = originalSpawn;
    fs.utimesSync = originalUtimesSync;
  });

  describe('payload processing', function() {

    it('does not process requests outside of hook url', function(done) {
      var srv = util.makeServer(++port, function() {
        GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test' });
        util.request(port, '/foo', function (data) {
          data.should.eql('/foo');
          srv.close();
          done();
        });
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
        hook.updateRepository = function(cb) { called = true; cb(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        });
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
        hook.updateRepository = function(cb) { called = true; cb(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.be.ok;
          done();
        });
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
        hook.updateRepository = function(cb) { called = true; cb(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        });
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
        hook.updateRepository = function(cb) { called = true; cb(); }
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          srv.close();
          called.should.not.be.ok;
          done();
        });
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
          order.length.should.eql(3);
          order[0].should.eql(['git', 'fetch', 'origin']);
          order[1].should.eql(['git', 'diff', '--name-only', 'origin/azure']);
          order[2].should.eql(['git', 'reset', '--hard', 'origin/azure']);
          srv.close();
          done();
        });
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
          ]
        }

        var order = [];
        child_proc.spawn = function(command, args) {
          args.unshift(command);
          order.push(args);
          var proc = util.fakeSpawn();
          process.nextTick(function() { 
            // fake changed files
            if ((/\bgit$/).test(command) && args[1] == 'diff') {
              proc.stdout.emit('data', 'History.md\nREADME.md\nlib/socket.js\nlib/websocket.io.js\npackage.json');
            } 
            proc.emit('exit', 0);
          });
          return proc;
        }
        fs.utimesSync = function(path) { }

        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
          order.length.should.eql(5);
          order[0].should.eql(['git', 'fetch', 'origin']);
          order[1].should.eql(['git', 'diff', '--name-only', 'origin/azure']);
          order[2].should.eql(['git', 'reset', '--hard', 'origin/azure']);
          order[3].should.eql(['bin\\npm.cmd', 'install']);
          order[4].should.eql(['bin\\npm.cmd', 'prune']);
          srv.close();
          done();
        });
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
            { modified: [ 'foo' ] }
          ]
        }

        child_proc.spawn = function(command, args) {
          var proc = util.fakeSpawn();
          process.nextTick(function() { 
            // fake changed files
            if ((/\bgit$/).test(command) && args[0] == 'diff') {
              proc.stdout.emit('data', 'lib/web.io.js\ngitazure.json');
            } 
            proc.emit('exit', 0);
          });
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
        });
      });
    });

    it('will not process two updates simultaneously', function(done) {
      var srv = util.makeServer(++port, function() {
        var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'foobar' });
        var payload = {
          repository: {
            url: 'https://github.com/einaros/Test'
          },
          ref: 'refs/heads/foobar',
          commits: [
            { modified: [ 'foo' ] }
          ]
        }

        var queuedSpawns = [];
        var success = true;
        child_proc.spawn = function(command, args) {
          if (queuedSpawns.length > 0) success = false;
          var proc = util.fakeSpawn();
          if (args[0] !== 'fetch') process.nextTick(function() { proc.emit('exit', 0); });
          else queuedSpawns.push(function() { proc.emit('exit', 0); });
          return proc;
        }
        fs.utimesSync = function(path) {}

        var req = 0;
        srv.on('request', function() {
          if (++req == 1) {
            util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
              success.should.be.ok;
              srv.close();
              done();
            });
          }
          else if (req == 2) {
            // it's silly for this test to rely on a timeout. halting problem, anyone?
            setTimeout(function() {
              (queuedSpawns.pop())();            
            }, 200);
          }
        });
        util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
            (queuedSpawns.pop())();
        });
      });
    });

  });

  describe('cluster functionionality', function() {

    describe('#updateClusterBlob', function() {

      it('uses blob service', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('createBlockBlobFromText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          hook.updateClusterBlob(function() { });
          order.length.should.eql(2);
          order[0].should.eql('createContainerIfNotExists');
          order[1].should.eql('createBlockBlobFromText');
          srv.close();
          done();
        });
      });

    });

    describe('#checkClusterBlob', function() {

      it('does not use blob service on first call', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('getBlobToText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          hook.checkClusterBlob(function() { });
          order.length.should.eql(0);
          srv.close();
          done();
        });
      });

      it('uses blob service on second call', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('getBlobToText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          hook.updateClusterBlob(function() { });
          order = [];
          hook.checkClusterBlob(function() { });
          order.length.should.eql(2);
          order[0].should.eql('createContainerIfNotExists');
          order[1].should.eql('getBlobToText');
          srv.close();
          done();
        });
      });

      it('indicates that an update should be made when the timestamp returned is ahead that of the last local update', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('getBlobToText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          hook.updateClusterBlob(function() { });
          var date = Date.now() + 10;
          text = date.toString();
          hook.checkClusterBlob(function(error, update) { 
            update.should.be.ok;
          });
          srv.close();
          done();
        });
      });

      it('indicates that an update should not be made when the timestamp returned is behind that of the last local update', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('getBlobToText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          var date = Date.now();
          text = date.toString();
          hook.updateClusterBlob(function() { });
          hook.checkClusterBlob(function(error, update) { 
            update.should.not.be.ok;
          });
          srv.close();
          done();
        });
      });

      it('must provide the last update timestamp', function(done) {
        var srv = util.makeServer(++port, function() {
          var order = [];
          var text = '';
          azure.createBlobService = function() {
            return {
              createContainerIfNotExists: function(containerName, options, cb) {
                order.push('createContainerIfNotExists');
                cb(null);
              },
              createBlockBlobFromText: function(containerName, blobName, text, cb) {
                order.push('createBlockBlobFromText');
                cb(null);
              },
              getBlobToText: function(containerName, blobName, cb) {
                order.push('getBlobToText');
                cb(null, text);
              }
            }
          }
          var hook = GitAzure.listen(srv, { repoUrl: 'https://github.com/einaros/Test', branch: 'azure', npmPrune: false });
          hook.updateClusterBlob(function() { });
          var date = Date.now();
          text = date.toString();
          hook.checkClusterBlob(function(error, update, timestamp) { 
            timestamp.should.eql(date);
          });
          srv.close();
          done();
        });
      });

    });

  });

  describe('configuring', function() {

    describe('npm', function() {

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
            ]
          }

          var order = [];
          child_proc.spawn = function(command, args) {
            args.unshift(command);
            order.push(args);
            var proc = util.fakeSpawn();
            process.nextTick(function() { 
              // fake changed files
              if ((/\bgit$/).test(command) && args[1] == 'diff') {
                proc.stdout.emit('data', 'History.md\nREADME.md\nlib/socket.js\nlib/websocket.io.js\npackage.json');
              } 
              proc.emit('exit', 0);
            });
            return proc;
          }
          fs.utimesSync = function(path) { }

          util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
            order.length.should.eql(4);
            order[0].should.eql(['git', 'fetch', 'origin']);
            order[1].should.eql(['git', 'diff', '--name-only', 'origin/azure']);
            order[2].should.eql(['git', 'reset', '--hard', 'origin/azure']);
            order[3].should.eql(['bin\\npm.cmd', 'install']);
            srv.close();
            done();
          });
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
            ]
          }

          var order = [];
          child_proc.spawn = function(command, args) {
            args.unshift(command);
            order.push(args);
            var proc = util.fakeSpawn();
            process.nextTick(function() { 
              // fake changed files
              if ((/\bgit$/).test(command) && args[1] == 'diff') {
                proc.stdout.emit('data', 'History.md\nREADME.md\nlib/socket.js\nlib/websocket.io.js\npackage.json');
              } 
              proc.emit('exit', 0);
            });
            return proc;
          }
          fs.utimesSync = function(path) { }

          util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
            order.length.should.eql(3);
            order[0].should.eql(['git', 'fetch', 'origin']);
            order[1].should.eql(['git', 'diff', '--name-only', 'origin/master']);            
            order[2].should.eql(['git', 'reset', '--hard', 'origin/master']);
            srv.close();
            done();
          });
        });
      });

    });

    describe('clustering', function() {

      it('does not immediately poll blob when clustering is left off', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'master'
          });

          child_proc.spawn = function(command, args) {
            process.nextTick(function() { proc.emit('exit', 0); });
            return proc;
          }
          fs.utimesSync = function(path) { }
          var success = true;
          hook.checkClusterBlob = function(cb) {
            success = false;
          }

          setTimeout(function() {
            success.should.be.ok;
            srv.close();
            done();
          }, 10);
        });
      });

      it('immediately polls blob when clustering is on', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'master',
            cluster: true
          });

          child_proc.spawn = function(command, args) {
            process.nextTick(function() { proc.emit('exit', 0); });
            return proc;
          }
          fs.utimesSync = function(path) { }
          var success = false;
          hook.checkClusterBlob = function(cb) {
            success = true;
            cb();
          }

          setTimeout(function() {
            success.should.be.ok;
            srv.close();
            done();
          }, 10);
        });
      });

      it('does not update cluster blob when clustering is left off', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'foobar'
          });
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
          fs.utimesSync = function(path) {}
          hook.checkClusterBlob = function(cb) {
            cb();
          }
          var success = true;
          hook.updateClusterBlob = function(cb) {
            success = false;
            cb();
          }

          util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
            success.should.be.ok;
            srv.close();
            done();
          });
        });
      });

      it('updates cluster blob when clustering is enabled', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'foobar',
            cluster: true
          });
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
          fs.utimesSync = function(path) {}
          hook.checkClusterBlob = function(cb) {
            cb();
          }
          var success = false;
          hook.updateClusterBlob = function(cb) {
            success = true;
            cb();
          }

          util.request(port, '/githook', 'payload=' + encodeURIComponent(JSON.stringify(payload)), function (data) {
            success.should.be.ok;
            srv.close();
            done();
          });
        });
      });

      it('polls checkClusterBlob regularly when clustering is enabled', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'master',
            cluster: true,
            clusterUpdatePollInterval: 10
          });

          child_proc.spawn = function(command, args) {
            process.nextTick(function() { proc.emit('exit', 0); });
            return proc;
          }
          fs.utimesSync = function(path) { }
          var checks = 0;
          hook.checkClusterBlob = function(cb) {
            if (++checks == 4) {
              srv.close();
              done();
            }
            cb(null, false, 0);
          }
        });
      });

      it('updates repository when polled checkClusterBlob indicates that an update should be made', function(done) {
        var srv = util.makeServer(++port, function() {
          var hook = GitAzure.listen(srv, {
            repoUrl: 'https://github.com/einaros/Test',
            branch: 'master',
            cluster: true,
            clusterUpdatePollInterval: 10
          });

          child_proc.spawn = function(command, args) {
            process.nextTick(function() { proc.emit('exit', 0); });
            return proc;
          }
          fs.utimesSync = function(path) { }
          var checks = 0;
          hook.checkClusterBlob = function(cb) {
            if (++checks == 2) {
              cb(null, true, 1337);
            }
            else cb(null, false, 0);
          }
          hook.updateRepository = function(cb) {
            cb();
            hook.lastAzureUpdateTimestamp.should.eql(1337);
            srv.close();
            done();
          }
        });
      });

    });

  });
});
