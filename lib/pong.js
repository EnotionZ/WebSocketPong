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

		self.players = [];
		self.spectators = [];

		self.httpServer = self.createHTTPServer();
		self.bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		self.bayeux.attach(self.httpServer);
		
		self.httpServer.listen(self.port);
		sys.log("starting server on port " + self.port);
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
	},


	/**
	 * Publishes player movement information to all subscribers
	 */
	publishCoord: function(params) {
		self.bayeux.getClient().publish('/coord', {
			id: params.id,
			top: params.top,
			left: params.left
		});
	},

	createHTTPServer: function() {
		var self = this;
		return http.createServer(function(request, response) {

			// https://github.com/cloudhead/node-static for doc
			var file = new nodeStatic.Server('./public', {});

			request.addListener('end', function() {
				var location =  url.parse(request.url, true);
				var params = location.query || request.headers;

				if(location.pathname == '/join' && request.method == 'GET') {
					sys.log("hitting joined");
					self.playerJoined(params);
					response.end();
				}

				if(location.pathname == '/coord' && request.method == 'GET') {
					self.publishCoord(params);
					response.end();
				} else {
					file.serve(request, response);
				}

			});
		});
	}
};

module.exports = Pong;