var Faye = require('faye');
var Express = require('express');

var GameManager = function(opts) { this.init(opts); };
GameManager.prototype = {
	init: function(opts) {
		console.log("Options: ", opts);
		var self = this;
		self.games = [];

		var app = self.app = Express.createServer();
		app.use('/', Express['static'](opts.staticDir));
		app.use(Express.bodyParser());

		app.get( '/games/', function(req, res) { self.listGames(req, res); });
		app.post('/games/', function(req, res) { self.createGame(req, res); });

		app.post('/join/', function(req, res) { self.joinGame(req, res); });

		var bayeux = self.bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		bayeux.attach(app);
		app.listen(opts.port);
	},

	createGame: function(request, response) {
		console.log("createGame:", request.body);
		this.games.push(request.body.game);
		response.send(this.games, 200);
	},

	listGames: function(request, response) {
		console.log("listGames");
		response.send(this.games);
	},

	joinGame: function(request, response) {
		console.log("joinGame:", request.body);
		response.send({
			name: request.body.game.name
		}, 200);
	}
};

module.exports = GameManager;
