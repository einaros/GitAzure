var fs = require('fs');

var config = {
	branch: 'master',
	repoUrl: '',
	npmUpdate: true,
	npmPrune: true,
	serverScript: 'server.js'
}

fs.writeFileSync('gitazure.json', JSON.stringify(config, null, 2));