var Pong = require('./lib/pong.js');
new Pong({
	port: process.env.PORT || 8000
});