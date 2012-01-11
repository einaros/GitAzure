var urlMatch = /\/githook$/
  , fs = require('fs');

function GitHook(server, config) {
  this.config = config || {};
  this.config.npmInstall = typeof this.config.npmInstall == 'undefined' ? true : this.config.npmInstall;
  this.config.npmPrune = typeof this.config.npmPrune == 'undefined' ? true : this.config.npmPrune;
  this.config.repoUrl = typeof this.config.repoUrl == 'undefined' ? '' : this.config.repoUrl;
  this.config.branch = typeof this.config.branch == 'undefined' ? 'master' : this.config.branch;
  this.server = server;
  this.oldListeners = server.listeners('request');
  server.removeAllListeners('request');
  var self = this;
  server.on('request', function (req, res) {
    if (req.method == "POST" && urlMatch.test(req.url)) {
      var body = '';
      req.on('data', function(data) {
        body += data.toString('utf8');
      });
      req.on('end', function() {
        if (body.substr(0, 8) == 'payload=') {
          try {
            body = body.replace(/\+/g, ' ');
            var payload = JSON.parse(decodeURIComponent(body.substr(8)));
            if (self.config.repoUrl == '' || self.config.repoUrl == payload.repository.url) {
              if (self.isCorrectBranch(payload)) self.processPayload(payload, res);
              else res.end(); // incorrect branch - not worth passing an error for
            }
            else {
              console.error('GitHook repository url %s does not match payload url %s', repoUrl, payload.repository.url);
              res.end();
            }
          }
          catch (e) {
            // update threw exception
            console.error(e);
            res.writeHead(500);
            res.end();
          }
        }
        else {
          // payload not in body
          res.writeHead(400);
          res.end();
        }
      });
    }
    else {
      for (var i = 0, l = self.oldListeners.length; i < l; ++i) {
        self.oldListeners[i].call(self.server, req, res);
      }
    }
  });
}

module.exports = {
  listen: function(server, config) {
    return new GitHook(server, config);
  }
};

GitHook.prototype.processPayload = function(payload, res) {
  console.info('GitHook is pulling from the repository');
  var self = this;
  this.gitPull(function(error) {
    if (error) {
      console.error(error);
      res.end();
    }
    else {
      self.npmUpdate(payload, function(error) {
        if (error) console.error(error);
        fs.utimesSync(__dirname + '/server.js', new Date(), new Date());
        res.end();
      });
    }
  });  
}

GitHook.prototype.gitPull = function(cb) {
  var prevHome = process.env.appdata;
  process.env.home = 'bin';
  var util  = require('util')
    , spawn = require('child_process').spawn
    , git = spawn('git', ['pull', 'origin', this.config.branch])
    , output = '';
  process.env.home = prevHome;
  git.stdout.on('data', function (data) {
    output += data;
  });
  git.stderr.on('data', function (data) {
    output += data;      
  });
  git.on('exit', function (code) {
    if (code == 0) cb(null);
    else cb(output);
  });
}

GitHook.prototype.isCorrectBranch = function(payload) {
  return payload.ref == 'refs/heads/' + this.config.branch;
}

GitHook.prototype.isPackageJsonUpdated = function(payload) {
  for (var ci = 0, cl = payload.commits.length; ci < cl; ++ci) {
    var commit = payload.commits[ci];
    if (typeof commit.modified == 'undefined') continue;
    for (var mi = 0, ml = commit.modified.length; mi < ml; ++mi) {
      if ((/package\.json/i).test(commit.modified[mi])) {
        return true;
      }
    }
  }
  return false;
}

GitHook.prototype.npmUpdate = function(payload, cb) {
  if (this.config.npmInstall == false) {
    cb(null);
    return;
  }
  if (!this.isPackageJsonUpdated(payload)) {
    cb();
    return;
  }
  var self = this;
  this.npm('install', function(error) {
    if (error) cb(error);
    else {
      if (self.config.npmPrune) self.npm('prune', cb);
      else cb(null);
    }
  })
}

GitHook.prototype.npm = function(command, cb) {
  var util  = require('util')
    , spawn = require('child_process').spawn
    , output = ''
    , npmProc
    , prevEnv = {};
  try {
    // store env
    for (var env in process.env) prevEnv[env] = process.env[env];
    // update env vars used by npm
    process.env.userprofile = 'bin/npmtemp';
    process.env.home = 'bin/npmtemp';
    process.env.appdata = 'bin/npmtemp';
    process.env.TMPDIR = 'bin/npmtemp'
    npmProc = spawn(__dirname + '\\bin\\npm.cmd', [command])
  }
  finally {
    // restore env
    for (var env in process.env) process.env[env] = prevEnv[env];
  }
  npmProc.stdout.on('data', function (data) {
    output += data;
  });
  npmProc.stderr.on('data', function (data) {
    output += data;
  });
  npmProc.on('exit', function (code) {
    if (code == 0) cb(null);
    else cb(output);
  });  
}
