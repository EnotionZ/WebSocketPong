var http = require('http');
var sys = require('sys');
var url = require('url');

var nodeStatic = require('node-static');
var faye = require('faye');


var PlayerController = function(opts){ this.init(opts); };
PlayerController.prototype = {
	init: function(opts) {
		var self = this;

		// copies all properties from opts into instance
		for(var key in opts) if(opts.hasOwnProperty(key)) self[key] = opts[key];

		sys.log("Making " + self.name + " player");

		self.score = 0;
		self.lives = 10;
		self.paddleSize = 100;
		self.axis = self.pos%2 === 0 ? "left" : "top";

		self.coords = [{left: 300, top: 300}];
		self.coordSize = 10;
	},

	changeScore: function(val) { this.score += val; },
	changeLives: function(val) { this.lives += val; },

	storeCoord: function(info) {
		var self = this;
		if(self.coords.length === self.coordSize) self.coords.splice(0,1);
		self.coords.push(info);
	},

	getLastCoord: function() { return this.coords[this.coords.length-1]; },

	getPosition: function() {
		return this.getLastCoord()[ this.pos%2===0 ? "left" : "top"];
	},

	getVelocity: function() {
		var self = this;
		var
		vel = 0,
		c1, c2,     // coordinate info
		len = self.coords.length;

		if(len > 2) {
			c1 = self.coords[len-1];
			c2 = self.coords[len-3];
			vel = (c1[self.axis]-c2[self.axis])/(c1["timestamp"] - c2["timestamp"]);
		}
		return vel*3;
	}
};

var SpectatorController = function(opts){ this.init(opts); };
SpectatorController.prototype = {
	init: function(opts) {
		var self = this;
		for(var key in opts) if(opts.hasOwnProperty(key)) self[key] = opts[key];
		sys.log("Making " + self.name + " spectator");
	}
};



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

		self.events = {};


		self.boardWidth = 600;
		self.ballSize = 20;
		self.ballData = {};

		self.paused = false;

		self.players = [];
		self.spectators = [];

		self.app = opts.app;
		self.id = opts.id;
		self.name = opts.name;
		self.numPlayers = opts.players;

		self.client = opts.client;
		self.client.subscribe('/games/'+this.id+'/coord', function(info) { self.coordReceived(info); });

		new GameController({
			"game": self,
			"app": self.app
		});
	},

	bind: function(event, callback) {
		if(typeof event === "string") {
			if(typeof this.events[event] !== "object") this.events[event] = [];
			if(typeof callback === "function") this.events[event].push(callback);
		}
	},

	trigger: trigger = function(event, param) {
		if(typeof event === "string" && typeof this.events[event] === "object" && this.events[event] instanceof Array)
			for(var i=0, len=this.events[event].length; i<len; i++)
				if(typeof this.events[event][i] === "function") this.events[event][i](param);
	},


	/**
	 * Coordinates received, store player position
	 */
	coordReceived: function(info) {
		if(typeof this.players !== "undefined") this.players[info.pos].storeCoord(info);
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
		}, 20);
	},

	checkContact: function(player, ballPos) {
		var hit = false;
		var paddlePos = player.getPosition();
		var velocity = 0;

		if(this._checkContact(player, paddlePos, ballPos)) {
			hit = true;
			player.changeScore(10);
			velocity = player.getVelocity();
			if(player.axis === "left") {
				this.ballData.incX += velocity;
				this.ballData.incY -= velocity;
			} else {
				this.ballData.incY += velocity;
				this.ballData.incX -= velocity;
			}

		} else {
			player.changeLives(-1);
			if(player.lives <= 0) this.gameOver(player);
		}

		this.client.publish('/games/'+this.id+'/contact', {player: player, hit: hit } );
	},

	_checkContact: function(player, paddlePos, ballPos) {
		var halfPaddle = player.paddleSize/2;
		ballPos += this.ballSize/2;

		// By now, ballPos and paddlePos represents the midpoint of the respective elements
		return ballPos > paddlePos-halfPaddle && ballPos < paddlePos + halfPaddle;
	},

	// Gets called when the game is over
	gameOver: function(deadPlayer) {
		clearInterval(this.ballTimer);
		this.paused = true;
		this.gameEnded = true;
		this.loser = deadPlayer;

		this.trigger("endGame", this);
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
		var obj = {
			players: self.players,
			spectators: self.spectators,
			gameEnded: self.gameEnded || false
		};

		if(obj.gameEnded) obj.loser = self.loser;

		if(self.numPlayers === 4) {
			self[self.players.length < 4 ? "_addPlayer" : "_addSpectator"](id, name);
		} else if(self.numPlayers === 2) {
			if(self.players.length === 0) {
				self._addPlayer(id, name, 0);
				self._addPlayer(id, name, 2);
			} else if(self.players.length < 4) {
				self._addPlayer(id, name, 1);
				self._addPlayer(id, name, 3);
			} else {
				self._addSpectator(id, name);
			}
		} else if(self.numPlayers === 1) {
			if(self.players.length < 4) {
				self._addPlayer(id, name);
				self._addPlayer(id, name);
				self._addPlayer(id, name);
				self._addPlayer(id, name);
			} else {
				self._addSpectator(id, name);
			}
		}

		self.client.publish('/games/'+self.id+'/join', obj);
		if(self.players.length === 4 && !self.gameStarted) self.startPong();
	},
	_addPlayer: function(id, name, pos) {
		if(!pos) pos = this.players.length;
		this.players[pos] = new PlayerController({
			id: id,
			pos: pos,
			name: name
		});
	},
	_addSpectator: function(id, name) {
		this.spectators.push(new SpectatorController({id: id, name: name}));
	}
};

module.exports = Game;
