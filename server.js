var Pong = require('./lib/pong.js'),
	GameManager = Pong.GameManager;
	Game = Pong.Game;

new GameManager({
	port: process.env.PORT || 8000
});
