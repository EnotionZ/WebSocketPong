var http = require('http');
var sys = require('sys');
var url = require('url');


var nodeStatic = require('node-static');
var faye = require('faye');


var GameManager = function(opts) { this.port = opts.port; this.init(); };
GameManager.prototype = {
	init: function(){
		var self = this;

		self.games = [];

		self.httpServer = self.createHTTPServer();
		self.bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		self.bayeux.attach(self.httpServer);
		
		self.httpServer.listen(self.port);
		sys.log("starting server on port " + self.port);
	},

	createHTTPServer: function() {
		var self = this;
		return http.createServer(function(request, response) {

			var file = new nodeStatic.Server('./public', {});

			request.addListener('end', function() {
				var location =  url.parse(request.url, true);
				var params = location.query || request.headers;

				if(location.pathname == '/join' && request.method == 'GET') {
					self.playerJoined(params);
					response.end();
				} else {
					file.serve(request, response);
				}

			});
		});
	}
};

var Game = function(id){ this.id = id; this.init(); };
Game.prototype = {
	init: function() {
	    var self = this;

		self.boardWidth = 600;
		self.ballSize = 20;
		self.ballData = {};

		self.players = [];
		self.spectators = [];

		self.client = self.bayeux.getClient();
		self.client.subscribe('/games/'+this.id+'/coord', function(info) { self.coordReceived(info); });
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
			self.client.publish('/ball', self.ballData);
		}
	}
};

module.exports = {
	Game: Game,
	GameManager: GameManager
};
