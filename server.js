var http = require('http');
var port = process.env.port || 1337;
var server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('');
}).listen(port);
require('lib/gitazure').listen(server);