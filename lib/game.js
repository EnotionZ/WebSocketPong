var http = require('http');
var sys = require('sys');
var url = require('url');

var nodeStatic = require('node-static');
var faye = require('faye');

var GameController = function(opts){ this.init(opts); };
GameController.prototype = {
	init: function(opts) {
		var self = this;

		self.game = opts.game;
		var app = self.app = opts.app;

		app.get('/games/' + opts.game.id, function(r, s) { self.get(r, s); });
		app.post('/games/' + opts.game.id + '/players/', function(r, s) { self.join(r, s); });
		console.log("Mounted game " + opts.game.name + " at /games/" + opts.game.id);
	},

	get: function(request, response) {
		response.render("game.jade", {
			layout: false, 
			gameMeta: this.game
		});
	},

	join: function(request, response) {
		this.game.playerJoined(request.body);
		response.send('Created', 201);
	}
};

var Game = function(opts){ this.init(opts); };
Game.prototype = {
	init: function(opts) {
		var self = this;

		self.boardWidth = 600;
		self.ballSize = 20;
		self.ballData = {};

		self.players = [];
		self.spectators = [];

		self.app = opts.app;
		self.id = opts.id;
		self.name = opts.name;

		self.client = opts.client;
		self.client.subscribe('/games/'+this.id+'/coord', function(info) { self.coordReceived(info); });

		new GameController({
			"game": self,
		    	"app": self.app
		});
	},


	/**
	 * Coordinates received, store player position in the server
	 */
	coordReceived: function(info) {
		var player = this.players[info.pos];
		player.left = info.left;
		player.top = info.top;
	},


	startPong: function() {
		var self = this;

		self.gameStarted = true;

		self.x = parseInt(Math.random()*(self.boardWidth - self.ballSize), 10);
		self.y = parseInt(Math.random()*(self.boardWidth - self.ballSize), 10);
		self.incX = self.incX || parseInt(Math.random()*8, 10);
		self.incY = self.incY || parseInt(Math.random()*8, 10);

		self.ballData = {
			x: self.x, y: self.y,
			incX: self.incX, incY: self.incY
		};

		var bd = self.ballData;
		setInterval(function() {

			bd.x = bd.x+bd.incX;
			bd.y = bd.y+bd.incY;

			if(bd.x < 0) bd.incX = Math.abs(bd.incX);
			if(bd.x > self.boardWidth-self.ballSize) bd.incX = -Math.abs(bd.incX);

			if(bd.y < 0) bd.incY = Math.abs(bd.incY);
			if(bd.y > self.boardWidth-self.ballSize) bd.incY = -Math.abs(bd.incY);

		}, 30);
	},


	/**
	 * Gets called when a player joins the game
	 * After 4 players are filled, subsequent users become pure subscribers
	 * Publishes to clients the array of all registered users
	 */
	playerJoined: function(params) {
		var self = this;
		var id = params.id;
		var name = params.name;
		var obj = { players: self.players, spectators: self.spectators };
		console.log(obj);

		sys.log(name + " has joined the game");
		if(self.players.length < 4) {
			sys.log(self.players.length + " slots filled, making " + name + " player");
			self.players.push({id: id, name: name});
		} else {
			sys.log("All slots filled, making " + name + " spectator");
			self.spectators.push({id: id, name: name});
		}
		self.client.publish('/games/'+this.id+'/join', obj);

		if(self.players.length === 4) {
			if(!self.gameStarted) self.startPong();
			self.client.publish('/games/'+this.id+'/ball', self.ballData);
		}
	}
};

module.exports = Game;
