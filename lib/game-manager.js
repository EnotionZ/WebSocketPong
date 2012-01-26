var Faye = require('faye');
var Express = require('express');
var Game = require('./game.js');

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
		//TODO: proper hierarchical URL for this
		app.post('/join/', function(r, s) { self.join(r, s); });
	},

	list: function(request, response) {
		response.send(this.gameManager.listGames());
	},

	create: function(request, response) {
		var game = this.gameManager.createGame(request.body.game);
		response.send('Created', 201);
	},

	join: function(request, response) {
		var game = this.gameManager.joinGame(request.body.game);
		response.send({
			name: game.name
		}, 200);
	}
};

var GameManager = function(opts) { this.init(opts); };
GameManager.prototype = {
	init: function(opts) {
		var self = this;

		self.settings = {
			port: opts.port,
			env: process.env.NODE_ENV,
			staticDir: opts.staticDir
		};

		self.games = [];
		self.nextId = 1;

		var app = self.app = Express.createServer();
		app.configure(function() {
			app.use('/', Express['static'](opts.staticDir));
			app.use(Express.bodyParser());
		});

		app.get('/config.json', function(r, s) { self.getConfig(r, s); });

		var bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		self.client = bayeux.getClient();
		bayeux.attach(app);

		new GameManagerController({
			app: app,
			gameManager: self,
			port: opts.port,
			staticDir: opts.staticDir
		});
		app.listen(opts.port);
	},

	getConfig: function(request, response) {
		var self = this;
		var jsonString = JSON.stringify({
			port: self.settings.port,
			env: self.settings.env
		});
		response.send(jsonString, 200);
	},

	createGame: function(gameMeta) {
		var self = this;

		gameMeta.id = this.nextId++;
		gameMeta.players = parseInt(gameMeta.players,10);
		var game = new Game({
			"id": gameMeta.id,
			"name": gameMeta.name,
			"players": gameMeta.players,
			"app": this.app,
			"client": this.client
		});

		game.bind("endGame", function() { self.removeGame(game); });

		this.games.push(game);
		this.client.publish('/games', gameMeta);
		return gameMeta;
	},

	removeGame: function(game) {
		var gameIndex = this.games.indexOf(game);
		this.games.splice(gameIndex,1);
		this.client.publish('/games', "refresh");
		console.log("Removing game with name ", game.name);
	},

	listGames: function() {
		var gameMetas = [];
		var self = this;
		self.games.forEach(function(game) {
			gameMetas.push({
				"id": game.id,
				"name": game.name
			});
		});
		return gameMetas;
	},

	joinGame: function(gameMeta) {
		console.log("joinGame:", gameMeta);
		return gameMeta;
	}
};

module.exports = GameManager;
