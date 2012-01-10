var fs = require('fs');

function fileExists(path) {
  try {
    fs.statSync(path);
    return true;
  }
  catch (e) {
    return false;
  }
}

if (!fileExists('package.json')) {
  console.error('package.json not found, please do not run this script directly -- it is bootstrapped by the gitazure.cmd setup script');
  process.exit(-1);
}

var file = fs.readFileSync('package.json');
var package = JSON.parse(file);

var deps = package.dependencies;
if (typeof deps == 'undefined') {
  deps = package.dependencies = {};
}

var depKeys = Object.keys(deps);
if (depKeys.indexOf('GitAzure') == -1) {
  deps.GitAzure = 'https://github.com/einaros/GitAzure/tarball/master';
  fs.writeFileSync('package.json', JSON.stringify(package, null, 2));
}
