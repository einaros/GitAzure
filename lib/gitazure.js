var fs = require('fs')
  , azure = require('azure')
  , Step = require('step')
  , util = require('util')
  , Options = require('options')
  , urlMatch = /\/githook$/
  , appPath = __dirname + '/../../../'
  , gitAzurePath = __dirname + '/../'
  , azureBlobContainerName = 'GitAzure'
  , azureBlobName = 'LastUpdated';

function GitAzure(server, config) {
  this.config = new Options({
    npmInstall: true,
    npmPrune: true,
    repoUrl: '',
    branch: 'master',
    serverScript: 'server.js',
    cluster: false,
    clusterUpdatePollInterval: 30000
  }).merge(config);
  this.server = server;

  this.updateInProgress = false;
  this.callQueue = [];
  this.clusterTimeoutId = -1;
  this.lastAzureUpdateTimestamp = null;

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
        self.processRequestBody(body, res);
      });
    }
    else {
      for (var i = 0, l = self.oldListeners.length; i < l; ++i) {
        self.oldListeners[i].call(self.server, req, res);
      }
    }
  });
  server.on('close', function() { 
    if (self.clusterTimeoutId > 0) clearTimeout(self.clusterTimeoutId);
  });

  if (this.config.value.cluster) {
    process.nextTick(function() {
      self.checkClusterBlob(function(error, shouldUpdate, timestamp) {
        console.log('update!');
      });
    });
    this.setClusterUpdateTimer();
  }
}

module.exports = {
  listen: function(server, config) {
    return new GitAzure(server, config);
  }
};

GitAzure.prototype.log = function(severity) {
  var args = Array.prototype.slice.call(arguments, 1);
  for (var i = 0, l = args.length; i < l; ++i) {
    if (typeof args[i] == 'object')
      args[i] = severity == 'error' ? args[i].toString() : JSON.stringify(args[i], null, 2);
  }
  args[0] = new Date().toString() + ' [' + severity + '] ' + (args[0] || '');
  console.log.apply(null, args);
}

GitAzure.prototype.processRequestBody = function(body, res) {
  if (body.substr(0, 8) == 'payload=') {
    try {
      body = body.replace(/\+/g, ' ');
      var payload = JSON.parse(decodeURIComponent(body.substr(8)));
      this.log('info', 'Payload received:\n%s', payload);
      if (this.config.value.repoUrl == '' || this.config.value.repoUrl == payload.repository.url) {
        if (this.isCorrectBranch(payload)) {
          var self = this;
          // The repo url fits, and the correct branch has been updated, so trigger an update
          this.updateRepository(function() { 
            // When a payload-triggered update has completed running,
            // update the cluster blob if instructed by the config
            if (self.config.value.cluster) self.updateClusterBlob(function() { res.end(); });
            else res.end(); 
          });
        }
        else res.end(); // incorrect branch - not worth passing an error for
      }
      else {
        this.log('error', 'Repository url %s does not match payload url %s', this.config.value.repoUrl, payload.repository.url);
        res.end();
      }
    }
    catch (e) {
      // update threw exception
      this.log('error', e);
      res.writeHead(500);
      res.end();
    }
  }
  else {
    // payload not in body
    res.writeHead(400);
    res.end();
  }
}

GitAzure.prototype.processNextUpdateRequest = function() {
  if (this.callQueue.length > 0) {
    (this.callQueue.pop())();
  }
}

/*
 * Runs the entire update cycle, consisting of
 *   - git fetch
 *   - git diff
 *   - git reset
 *   - [optional] npm install
 *   - [optional] npm prune
 *   - touch server.js to trigger iisnode reset
 *   - [optional] touch gitazure's server.js to trigger issnode reset 
 */
GitAzure.prototype.updateRepository = function(cb) {
  if (this.updateInProgress) {
    this.callQueue.push(this.updateRepository.bind(this, cb));
    return;
  }
  this.updateInProgress = true;

  this.log('info', 'Pulling updates from repository');
  var updatedFiles = [];
  var self = this;
  Step(
    function fetch() {
      self.gitFetch(this);
    },
    function diff() {
      self.gitDiff(this);
    },
    function reset(error, updated) {
      if (error) throw error;
      if (typeof updated != 'undefined') {
        updatedFiles = updated.replace(/\r?\n$/g, '').split(/\r?\n/);
      }
      self.gitReset(this);
    },
    function update(error) {
      if (error) throw error;
      self.npmUpdate(updatedFiles, this);
    },
    function finalize(error) {
      if (error) throw error;
      // Touch the application, to make iisnode reload it
      fs.utimesSync(appPath + self.config.value.serverScript, new Date(), new Date());
      // Touch GitAzure's server script as well
      if (self.isGitazureJsonUpdated(updatedFiles)) {
        fs.utimesSync(gitAzurePath + 'server.js', new Date(), new Date());
      }
      // Continue
      process.nextTick(this);
    },
    function end(error) {
      if (error) {
        self.log('error', error);
      }
      try {
        cb();
      }
      finally {
        process.nextTick(this);
      }
    },
    function nextPayload() {
      self.updateInProgress = false;
      self.processNextUpdateRequest();
    }
  );
}

/*
 * Git fetch origin repo. 
 * Used in place of git pull in order to do diffs and to be able to deal with forced pushes.
 */
GitAzure.prototype.gitFetch = function(cb) {
  this.log('verbose', 'git fetch origin');
  this.git(['fetch', 'origin'], cb);
}

/*
 * Get a list of files changed between current repo structure and the recently fetched origin.
 * Used to figure out whether or not to run npm install etc.
 */
GitAzure.prototype.gitDiff = function(cb) {
  this.log('verbose', 'git diff --name-only origin/%s', this.config.value.branch);
  this.git(['diff', '--name-only', 'origin/' + this.config.value.branch], cb);
}

/*
 * Git reset working copy to origin repo. 
 * Used in place of git pull in order to do diffs and to be able to deal with forced pushes.
 */
GitAzure.prototype.gitReset = function(cb) {
  this.log('verbose', 'git reset --hard origin/%s', this.config.value.branch);
  this.git(['reset', '--hard', 'origin/' + this.config.value.branch], cb);
}

/*
 * Verify that the payload branch fits the configured branch.
 */
GitAzure.prototype.isCorrectBranch = function(payload) {
  return payload.ref == 'refs/heads/' + this.config.value.branch;
}

/*
 * Checks whether package.json is present in the list of updated files.
 */
GitAzure.prototype.isPackageJsonUpdated = function(updatedFiles) {
  for (var ci = 0, cl = updatedFiles.length; ci < cl; ++ci) {
    var file = updatedFiles[ci];
    if ((/package\.json/i).test(file)) {
      return true;
    }
  }
  return false;
}

/*
 * Checks whether the gitazure.json config file is in the list of updated files.
 */
GitAzure.prototype.isGitazureJsonUpdated = function(updatedFiles) {
  for (var ci = 0, cl = updatedFiles.length; ci < cl; ++ci) {
    var file = updatedFiles[ci];
    if ((/gitazure\.json/i).test(file)) {
      return true;
    }
  }
  return false;
}

/*
 * Runs an npm install and prune, given that neither
 * are specifically disabled through config.
 */
GitAzure.prototype.npmUpdate = function(updatedFiles, cb) {
  if (this.config.value.npmInstall == false) {
    cb(null);
    return;
  }
  if (!this.isPackageJsonUpdated(updatedFiles)) {
    cb();
    return;
  }
  var self = this;
  if (this.config.value.npmInstall) {
    this.log('verbose', 'npm install');
    this.npm('install', function(error) {
      if (error) cb(error);
      else {
        if (self.config.value.npmPrune) {
          self.log('verbose', 'npm prune');
          self.npm('prune', cb);
        }
        else cb(null);
      }
    });
  }
  else cb(null);
}

/*
 * Wraps the npm executable
 */
GitAzure.prototype.npm = function(command, cb) {
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
    process.env.TMPDIR = 'bin/npmtemp';
    npmProc = spawn('bin\\npm.cmd', [command], {cwd: appPath});
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
    if (code == 0) cb(null, output);
    else cb(output);
  });
}

/*
 * Wraps the git executable
 */
GitAzure.prototype.git = function(params, cb) {
  var prevHome = process.env.home;
  process.env.home = process.env.githome;
  var util  = require('util')
    , spawn = require('child_process').spawn
    , git = spawn('git', params, {cwd: appPath})
    , output = '';
  process.env.home = prevHome;
  git.stdout.on('data', function (data) {
    output += data;
  });
  git.stderr.on('data', function (data) {
    output += data;
  });
  git.on('exit', function (code) {
    if (code == 0) cb(null, output);
    else cb(output);
  });
}

/*
 * Initializes cluster polling
 */
GitAzure.prototype.setClusterUpdateTimer = function() {
  var self = this;
  function onTimer() {
    try {
      if (!self.updateInProgress) {
        self.checkClusterBlob(function(error, shouldUpdate, timestamp) {
          if (shouldUpdate) {
            self.updateRepository(function() {
              self.lastAzureUpdateTimestamp = timestamp;
            });
          }
        });
      }
    }
    finally {
      self.clusterTimeoutId = setTimeout(onTimer, self.config.value.clusterUpdatePollInterval);      
    }
  }
  this.clusterTimeoutId = setTimeout(onTimer, this.config.value.clusterUpdatePollInterval);
}

/*
 * Checks whether another node in a cluster has gotten a repository push
 * since one was last seen by this node
 */
GitAzure.prototype.checkClusterBlob = function(cb) {
  if (this.lastAzureUpdateTimestamp == null) {
    process.nextTick(function() { cb(null, true); });
    return;
  }
  if (!this.blobService) {
    this.blobService = azure.createBlobService();
  }
  var self = this;
  this.blobService.createContainerIfNotExists(this.azureBlobContainerName, { publicAccessLevel : 'blob' }, function(error) {
    if (error) cb(error);
    self.blobService.getBlobToText(self.azureBlobContainerName, self.azureBlobName, function (error, text) {
      if (error) cb(error);
      var timestamp = parseInt(text);
      cb(null, timestamp > self.lastAzureUpdateTimestamp, timestamp);
    });
  });
}

/*
 * Updates the cluster blob, indicating an update to other nodes
 */
GitAzure.prototype.updateClusterBlob = function(cb) {
  if (!this.blobService) {
    this.blobService = azure.createBlobService();
  }
  this.lastAzureUpdateTimestamp = Date.now().toString();
  var self = this;
  this.blobService.createContainerIfNotExists(this.azureBlobContainerName, { publicAccessLevel : 'blob' }, function(error) {
    if (error) cb(error);
    self.blobService.createBlockBlobFromText(self.azureBlobContainerName, self.azureBlobName, self.lastAzureUpdateTimestamp, function (error) {
      cb(error);
    });
  });
}
