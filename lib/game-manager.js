var Faye = require('faye');
var Express = require('express');

//I'm sure this is not the right way to do this, but
//good Express-based MVC examples don't seem to exist
var GameManagerController = function(opts) { this.init(opts); };
GameManagerController.prototype = {
	init: function(opts) {
		var self = this;
		//TODO: throw error when app or gameManager are not provided
		var app = self.app = opts.app;
		self.gameManager = opts.gameManager;

		app.get('/games/', function(r, s) { self.list(r, s); });
		app.post('/games/', function(r, s) { self.create(r, s); });
	},

	list: function(request, response) {
		response.send(this.gameManager.listGames());
	},

	create: function(request, response) {
		var game = this.gameManager.createGame(request.body.game);
		response.send('Created', 201);
	}
};

var GameManager = function(opts) { this.init(opts); };
GameManager.prototype = {
	init: function(opts) {
		console.log("Options: ", opts);
		var self = this;
		self.games = [];
		self.nextId = 1;

		var app = self.app = Express.createServer();
		app.configure(function() {
			app.use('/', Express.['static'](opts.staticDir));
			app.use(Express.bodyParser());
		});

		app.post('/join/', function(req, res) { self.joinGame(req, res); });

		var bayeux = self.bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		bayeux.attach(app);
		app.listen(opts.port);

		new GameManagerController({app: app,  gameManager: self});
	},

	createGame: function(gameMeta) {
		gameMeta.id = this.nextId++;
		this.games.push(gameMeta);
		return gameMeta;
	},

	listGames: function() {
		return this.games;
	},

	joinGame: function(request, response) {
		console.log("joinGame:", request.body);
		response.send({
			name: request.body.game.name
		}, 200);
	}
};

module.exports = GameManager;
