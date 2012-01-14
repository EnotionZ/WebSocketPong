/*var Pong = require('./lib/pong.js'),
	GameManager = Pong.GameManager;
	Game = Pong.Game;

new GameManager({
	port: process.env.PORT || 8000
});*/

var GameManager = require('./lib/game-manager.js'),
	gameManager = new GameManager({
		"port": process.env.PORT || 8000,
		"staticDir": __dirname + '/public'
	});

