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
		console.log("Options: ", opts);
		var self = this;
		self.games = [];
		self.nextId = 1;

		var app = self.app = Express.createServer();
		app.configure(function() {
			app.use('/', Express['static'](opts.staticDir));
			app.use(Express.bodyParser());
		});

		var bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		self.client = bayeux.getClient();
		bayeux.attach(app);

		new GameManagerController({app: app,  gameManager: self});
		app.listen(opts.port);
	},

	createGame: function(gameMeta) {
		gameMeta.id = this.nextId++;
		this.games.push(gameMeta);
		this.client.publish('/games', gameMeta);
		return gameMeta;
	},

	listGames: function() {
		return this.games;
	},

	joinGame: function(gameMeta) {
		console.log("joinGame:", gameMeta);
		return gameMeta;
	}
};

module.exports = GameManager;
