var
GameManager = require('./lib/game-manager.js'),
gameManager = new GameManager({
	"port": process.env.PORT || 8000,
	"staticDir": __dirname + '/public'
});

