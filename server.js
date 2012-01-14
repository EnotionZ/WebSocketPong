/*var Pong = require('./lib/pong.js'),
	GameManager = Pong.GameManager;
	Game = Pong.Game;

new GameManager({
	port: process.env.PORT || 8000
});*/

var express = require('express'),
	GameManager = require('./lib/game-manager.js'),
	app = express.createServer(),
	gameManager = new GameManager({"app": app});

app.listen(process.env.PORT || 8000);
