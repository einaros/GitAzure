var http = require('http')
  , fs = require('fs')
  , port = process.env.port || 1337;

var server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('');
}).listen(port);

var config = null;
try {
	var data = fs.readFileSync('../../gitazure.json');
	config = JSON.parse(data);
}
catch (e) {}

require('./').listen(server, config);