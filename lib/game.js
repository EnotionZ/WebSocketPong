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

		self.paused = false;

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
		if(typeof this.players !== "undefined"){
			var player = this.players[info.pos];
			player.coord.left = info.left;
			player.coord.top = info.top;
		}
	},


	startPong: function() {
		var self = this;

		self.gameStarted = true;

		self.x = parseInt(Math.random()*(self.boardWidth - self.ballSize), 10);
		self.y = parseInt(Math.random()*(self.boardWidth - self.ballSize), 10);
		self.incX = 3+parseInt(Math.random()*4, 10);
		self.incY = 3+parseInt(Math.random()*4, 10);


		self.ballData = {
			x: self.x, y: self.y,
			incX: self.incX, incY: self.incY
		};

		self.moveBall();
	},

	moveBall: function() {
		var self = this;
		var bd = self.ballData;
		self.ballTimer = setInterval(function() {
			if(!self.paused){
				bd.x = bd.x+bd.incX;
				bd.y = bd.y+bd.incY;

				if(bd.x < 0) {
					bd.incX = Math.abs(bd.incX);
					self.checkContact(self.players[3], bd.y);
				} else if(bd.x > self.boardWidth-self.ballSize) {
					bd.incX = -Math.abs(bd.incX);
					self.checkContact(self.players[1], bd.y);
				}

				if(bd.y < 0) {
					bd.incY = Math.abs(bd.incY);
					self.checkContact(self.players[0], bd.x);
				} if(bd.y > self.boardWidth-self.ballSize) {
					bd.incY = -Math.abs(bd.incY);
					self.checkContact(self.players[2], bd.x);
				}
			}
			self.client.publish('/games/'+self.id+'/ball', self.ballData);
		}, 30);
	},

	checkContact: function(player, ballPos) {
		var hit = false;
		var paddlePos;
		if(player.pos === 1 || player.pos === 3) {
			paddlePos = player.coord.left;
		} else {
			paddlePos = player.coord.top;
		}

		if(this._checkContact(player, paddlePos, ballPos)) {
			hit = true;
			player.score += 10;
			console.log("**Hit** " + player.name);
		} else {
			player.lives--;
			console.log("**Miss** " + player.name);
			if(player.lives <= 0) this.gameOver(player);
		}

		this.client.publish('/games/'+this.id+'/contact', {player: player, hit: hit } );
	},

	_checkContact: function(player, paddlePos, ballPos) {
		ballPos = ballPos + this.ballSize/2;
		paddlePos = paddlePos - player.paddleSize/2;
		if(paddlePos < 0) paddlePos = 0;

		return ballPos > paddlePos && ballPos < paddlePos + player.paddleSize;
	},

	// Gets called when the game is over
	gameOver: function(deadPlayer) {
		clearInterval(this.ballTimer);
		this.paused = true;
		this.gameEnded = true;
		this.loser = deadPlayer;
		console.log("Death: " + deadPlayer.name);
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

		obj.gameEnded = self.gameEnded || false;
		if(obj.gameEnded) obj.loser = self.loser;

		if(self.players.length < 4) {
			sys.log(self.players.length + " slots filled, making " + name + " player");
			self.players.push({
				id: id,
				name: name,
				score: 0,
				lives: 10,
				paddleSize: 100,
				coord: {top: 0, left: 0}
			});
		} else {
			sys.log("All slots filled, making " + name + " spectator");
			self.spectators.push({id: id, name: name});
		}
		self.client.publish('/games/'+this.id+'/join', obj);

		if(self.players.length === 4) {
			if(!self.gameStarted) self.startPong();
		}
	}
};

module.exports = Game;
