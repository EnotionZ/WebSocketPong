var http = require('http');
var sys = require('sys');
var url = require('url');


var nodeStatic = require('node-static');
var faye = require('faye');


var Pong = function(opts) {
  var self = this;

  self.port = opts.port;
  self.init();
};
Pong.prototype = {
	init: function() {
	    var self = this;

		self.boardWidth = 600;
		self.ballSize = 20;

		self.players = [];
		self.spectators = [];

		self.httpServer = self.createHTTPServer();
		self.bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		self.bayeux.attach(self.httpServer);
		self.bayeux.getClient().subscribe('/coord', function(info) { self.coordReceived(info); });
		
		self.httpServer.listen(self.port);
		sys.log("starting server on port " + self.port);
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
		self.incX = 4;
		self.incY = 1.7;

		var info = {
			x: self.x, y: self.y,
			incX: self.incX, incY: self.incY
		};

		setInterval(function() {

			self.x = self.x+self.incX;
			self.y = self.y+self.incY;

			if(self.x < 0) self.incX = Math.abs(self.incX);
			if(self.x > self.boardWidth-self.ballSize) self.incX = -Math.abs(self.incX);

			if(self.y < 0) self.incY = Math.abs(self.incY);
			if(self.y > self.boardWidth-self.ballSize) self.incY = -Math.abs(self.incY);

			self.bayeux.getClient().publish('/ball', { left: self.x, top: self.y });
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

		if(self.players.length < 4) {
			sys.log("Currently we have " + self.players.length + " players, adding one more");
			self.players.push({id: id, name: name});
		} else {
			sys.log("Subscriber joined, we've already filled up 4 spots");
			self.spectators.push({id: id, name: name});
		}
		self.bayeux.getClient().publish('/join', obj);

		if(self.players.length === 4) {
			if(!self.gameStarted) {
				self.startPong();
			} else {
				var
				rndX = Math.random()*3,
				rndY = Math.random()*3,
				signedX = self.incX/Math.abs(self.incX),
				signedY = self.incY/Math.abs(self.incY);

				self.incX = (rndX + 1.5)*signedX;
				self.incY = (rndY + 1.5)*signedY;
			}
		}
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

module.exports = Pong;