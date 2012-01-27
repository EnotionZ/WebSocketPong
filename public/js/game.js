require.config({
	baseUrl: "/"
});
require(["js/faye_client", "js/spine"], function(client){

	var $html = $("html");
	var $body = $("body");

	var
	PADDLEHEIGHT = 12,
	BOARDSIZE = 600,
	BALLSIZE = 20,
	BALLRADIUS = BALLSIZE/2;


	/**
	 * Processing
	 */
	var Sketch = function(p) {
		var bd = gc.ballData;
		var bdSize = gc.bdcount;
		var balloffset = BALLRADIUS+PADDLEHEIGHT;

		p.setup = function() {
			p.size(BOARDSIZE + 2*PADDLEHEIGHT,BOARDSIZE + 2*PADDLEHEIGHT);
			p.frameRate(60);
			p.smooth();
			p.noStroke();
			p.fill(150, 153);
		};
		p.draw = function() {
			var currBd;

			// Clear canvas & set transparent bg
			p.background(0,0);

			// Draw ball
			p.fill(150, 153);
			for(var i=0; i<bdSize; i++) {
				currBd = bd[i];
				if(typeof currBd === "object") {
					p.ellipse(currBd.x+balloffset, currBd.y+balloffset, i/3, i/3);
				}
			}

			// Draw paddles
			var plr, pwidth, pheight, pleft, ptop;
			for(var id in gc.players) {
				if(gc.players.hasOwnProperty(id)) {
					plr = gc.players[id];
					pleft = plr.coord.left;
					ptop = plr.coord.top;

					if(plr.orientation === "horizontal") {
						pwidth = plr.paddleSize;
						pheight = plr.paddleHeight;
						pleft+=PADDLEHEIGHT;
					} else {
						pheight = plr.paddleSize;
						pwidth = plr.paddleHeight;
						ptop+=PADDLEHEIGHT;
					}
					p.fill(plr.displayColor);
					p.rect(pleft, ptop, pwidth, pheight);
				}
			}
		};
	};


	/**
	 * Player Controller
	 */
	var PlayerController = function(opts) { this.init(opts); };
	PlayerController.prototype = {
		init: function(opts) {
			var self = this;

			self.paddleSize = 100;
			self.paddleHeight = PADDLEHEIGHT;

			self.id = opts.id;
			self.pos = opts.pos;
			self.name = opts.name;
			self.isPublisher = false;

			// set orientation and initial position
			self.coord = {left: BOARDSIZE/2, top: BOARDSIZE/2};
			if(self.pos%2===0) {
				self.orientation = "horizontal";
				self.coord.top = self.pos === 0 ? 0 : BOARDSIZE+self.paddleHeight;
			} else {
				self.orientation = "vertical";
				self.coord.left = self.pos === 3 ? 0 : BOARDSIZE+self.paddleHeight;
			}

			switch(self.pos) {
				case 0: self.color = 0xfffff000; break;
				case 1: self.color = 0xffff0000; break;
				case 2: self.color = 0xff00ff00; break;
				case 3: self.color = 0xff0000ff; break;
			}
			self.displayColor = self.color;

			self.render();

			if(self.name) self.setLabel(self.name);
		},

		hitPaddle: function(lives, score) {
			var self = this;
			
			self.displayColor = 0xff666666;
			setTimeout(function(){ self.displayColor = self.color; }, 200);

			self.updateScore(score);
		},

		hitWall: function(lives, score) {
			var self = this;
			self.updateLives(lives);
			if(lives <= 0) gc.showLoss(self);
		},


		/**
		 * Processing a subscribed mouse event triggered by one of the players
		 */
		updatePaddle: function(info, selfPublish) {
			// If you're a publisher and publishing to yourself without a selfPublish flag
			// you're updating paddle from a subscribe... you can't update yourself...
			// ..to ensure that a player sees the response of their paddle movement right away
			if(this.isPublisher && info.id == this.id && !selfPublish) {
				return false;
			}

			var self = this, position;
			var maxPos = gc.boardWidth-self.paddleSize/2;

			var coord = self.coord;

			if(self.orientation === "horizontal") {
				position = info.left - self.paddleSize/2;
				position = self.fixPosition(position, maxPos);
				coord.left = position;
			} else {
				position = info.top - self.paddleSize/2;
				position = self.fixPosition(position, maxPos);
				coord.top = position;
			}
		},

		fixPosition: function(val, max) {
			if(val < 0) val = 0;
			else if(val > max) val = max;
			return val;
		},

		/**
		 * Makes the current user a player by allowing them to publish mouse movements
		 */
		registerPublisher: function() {
			var self = this;
			var id = this.id;
			var maxPos = gc.boardWidth-self.paddleSize/2;
			var info = {pos: self.pos, id: id };

			self.setLabel("YOU");
			self.isPublisher = true;
			self.publisherID = self.id;

			$html.mousemove(function(e) {
				info.left = self.fixPosition(e.clientX-gc.cLeft, maxPos);
				info.top = self.fixPosition(e.clientY-gc.cTop, maxPos);

				self.updatePaddle({left: info.left, top: info.top}, true);
				client.publish('/games/' + GAME_ID + '/coord', info);
			});
		},
		
		setLabel: function(str) { this.$name.html(str); },
		updateLives: function(val) { this.$lives.html(val); },
		updateScore: function(val) { this.$score.html(val); },

		render: function() {
			var $middle = $("<div/>").addClass("middle");

			this.$name = $("<span/>").addClass("name-label label default");
			this.$lives = $("<span/>").addClass("lives label important");
			this.$score = $("<span/>").addClass("score label success");
			this.setLabel("Player: "+this.pos);
			this.updateLives(0);
			this.updateScore(0);

			$middle.append(this.$name, this.$lives, this.$score);

			this.el = $("<div/>")
			.appendTo(gc.$board)
			.append($middle)
			.addClass("player player-" + this.orientation)
			.attr("id", "player"+this.pos);
		}
	};




	/**
	 * Game Controller
	 */
	var GameController = function(opts) { this.init(opts); };
	GameController.prototype = {
		init: function(opts) {
			var self = this;
			var path = '/games/'+GAME_ID;

			self.boardWidth = BOARDSIZE;
			self.ballSize = BALLSIZE;
			self.$board = $("#container");
			self.setOffset();

			self.ballData = [];
			self.bdcount = 60;

			self.players = {};
			self.playersArr = [];
			self.specsArr = [];
			self.id = "p"+parseInt(Math.random()*999999,10);


			client.subscribe(path + '/join', function(info) { self.userJoined(info); });
			client.subscribe(path + '/ball', function(info) { self.updateBall(info); });
			client.subscribe(path + '/coord', function(info) { self.subscribedMovement(info); });

			client.subscribe(path + '/contact', function(info) { self.checkContact(info.player, info.hit); });

			self.showNameInput();

			self.$spectators = $("#spectators");
			$("#spectator_anchor").click(function(){ self.$spectators.toggle(); return false; });
			$(window).resize(function(){ self.setOffset(); });
		},


		updateBall: function(info) {
			var self = this;
			var num = self.bdcount;

			for(var i=1; i<num; i++) self.ballData[i-1] = self.ballData[i];
			self.ballData[num-1] = info;
		},


		checkContact: function(player, hit) {
			var _player = this.players[player.id];
			if(typeof _player === "undefined") return false;

			_player[hit ? "hitPaddle" : "hitWall"](player.lives, player.score);
		},

		getPlayer: function(pos) { return this.players[this.playersArr[pos]]; },

		showNameInput: function() {
			var self = this;

			var $notice = $("<div/>")
				.addClass("notice")
				.append("<span><h3>Enter your name</h3> <input type=\"text\" class=\"x-large span4\"></span>")
				.appendTo($body);

			var $input = $notice.find("input").focus();
			$input.keypress(function(e){
				if(e.keyCode === 13) {
					$notice.remove();
					self.subName = $input.val();
					var joinEvent = {
						id: self.id,
						name: self.subName
					}
					$.post("/games/" + GAME_ID + "/players/", joinEvent);
				}
			});
		},

		/**
		 * Fixes the offset for position setting in case the window was resized
		 */
		setOffset: function() {
			var offset = this.$board.offset();
			this.cLeft = offset.left;
			this.cTop = offset.top;
		},

		subscribedMovement: function(info) {
			this.players[info.id].updatePaddle({ left: info.left, top: info.top, id: info.id });
		},

		userJoined: function(obj) {
			var
			self = this,
			playersData = obj.players,
			specsData = obj.spectators,
			playerCount = playersData.length,
			spectatorCount = specsData.length,
			id, name, idArr = [];


			// Creates player controllers
			for(var i=0; i<playerCount; i++) {
				id = playersData[i].id;
				name = playersData[i].name;

				idArr.push(id);

				// Registers a player on the board only if they haven't yet
				if(!self.players[id]) {
					self.playersArr.push(id);
					self.players[id] = new PlayerController({id: id, pos: i, name: name});

					// If the current paddle's ID matches the subscriber, make user a publisher
					if(id === self.id) self.players[id].registerPublisher();
				}
			}

			// If you're not a player or spectator(yet), show spectator message
			if(idArr.indexOf(self.id)<0 && self.specsArr.indexOf(self.id)<0) {
				if(obj.gameEnded) self.showLoss(self.players[obj.loser.id]);
				else self.showSpectatorNotice();
			}

			// Generates spectator list
			for(i=0; i<spectatorCount; i++) {
				id = specsData[i].id;
				name = specsData[i].name;
				if(self.specsArr.indexOf(id)<0) {
					self.specsArr.push(id);
					self.$spectators.append("<li>"+name+"</li>");
				}
			}

		},

		showSpectatorNotice: function() {
			var $notice = $("<div/>")
				.addClass("notice")
				.html("<span>Game is full, you will be a spectator</span>")
				.appendTo($body)
				.focus()
				.click(function(){ $(this).remove(); });

			$body.keypress(function(e) { if(e.keyCode === 13) $notice.remove(); });
		},

		showLoss: function(loser) {
			var $msg = $("<div/>")
			.appendTo($body)
			.addClass("notice")
			.html("<span>"+loser.name + " died! Game Over!!</span>")
			.click(function() { $msg.remove(); });
		}
	};

	var gc = new GameController();
	var processing = new Processing(document.getElementById("canvas"), Sketch);

});
