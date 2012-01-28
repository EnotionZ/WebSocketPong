require.config({ baseUrl: "/" });
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
		var

		bd = gc.ballData,
		bdSize = gc.bdcount,
		balloffset = BALLRADIUS+PADDLEHEIGHT,
		ballImg = p.loadImage("../images/ball.png"),

		// Four moving ellipses
		iR= 1500, bgArcs = [];
		bgArcs.push({x:0, y: 0, r1: iR, r2: iR });
		bgArcs.push({x:BOARDSIZE/2, y: -BOARDSIZE/4, r1: iR+BOARDSIZE/3, r2: iR });
		bgArcs.push({x:BOARDSIZE/2, y: BOARDSIZE*1.3, r1: iR+BOARDSIZE/3, r2: iR });
		bgArcs.push({x:BOARDSIZE*1.25, y: BOARDSIZE, r1: iR, r2: iR+BOARDSIZE/3 });


		var
		drawBackground = function() {
			var c, x, y, r1, r2;
			var mms = p.hour()*p.minute()*p.millis();
			var theta = 2*Math.PI*mms/3600000;
			p.fill(0xff71a3cc, 80);
			for(var i=0; i<4; i++) {
				c = bgArcs[i];
				x = c.x + 20*Math.cos(theta)*(i%2===0 ? -1: 1);
				y = c.y + 20*Math.sin(theta)*(i%2===0 ? -1: 1);
				p.ellipse(x, y, c.r1, c.r2);
			}
		},
		drawBall = function() {
			var currBd, rnd1, rnd2;
			for(var i=0; i<bdSize-1; i++) {
				p.fill(gc.ballColor, i*3);
				currBd = bd[i];
				if(typeof currBd === "object") {
					rnd1 = Math.random()*10-5;
					rnd2 = Math.random()*10-5;
					p.ellipse(currBd.x+balloffset+rnd1, currBd.y+balloffset+rnd2, i/3, i/3);
				}
			}
			currBd = bd[bd.length-1];
			if(typeof currBd === "object") p.image(ballImg, currBd.x+12-3, currBd.y+12-3);

		},
		drawPaddles = function() {
			// Draw paddles
			var plr, pwidth, pheight, pleft, ptop;
			for(i=0; i<4; i++) {
				plr = gc.players[i];
				if(typeof plr === "undefined") continue;

				pleft = plr.coord.left;
				ptop = plr.coord.top;

				if(plr.orientation === "horizontal") {
					pwidth = plr.paddleSize;
					pheight = plr.paddleHeight;
					pleft+=PADDLEHEIGHT - pwidth/2;
				} else {
					pheight = plr.paddleSize;
					pwidth = plr.paddleHeight;
					ptop+=PADDLEHEIGHT - pheight/2;
				}
				p.fill(plr.displayColor);
				p.rect(pleft, ptop, pwidth, pheight, 6, 6, 6, 6);
			}
		};


		p.setup = function() {
			p.size(BOARDSIZE + 2*PADDLEHEIGHT,BOARDSIZE + 2*PADDLEHEIGHT);
			p.frameRate(60);
			p.smooth();
			p.noStroke();
			p.fill(150, 153);
		};
		p.draw = function() {
			// Clear canvas & set transparent bg
			p.background(0xff2c3c48);

			drawBackground();
			drawBall();
			drawPaddles();
		};
	};


	/**
	 * Player Controller
	 */
	var PlayerController = Spine.Controller.sub({
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
				case 3: self.color = 0xffff8000; break;
			}
			self.displayColor = self.color;

			self.render();

			if(self.name) self.setLabel(self.name);
		},

		hitPaddle: function(lives, score) {
			var self = this;
			
			gc.ballColor = self.color;
			self.displayColor = 0xff666666;
			setTimeout(function(){ self.displayColor = self.color; }, 200);

			self.updateScore(score);
		},

		hitWall: function(lives, score) {
			var self = this;
			gc.ballColor = 0xff000000;
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
			if(this.isPublisher && info.pos == this.pos && !selfPublish) {
				return false;
			}

			var self = this, position;
			var coord = self.coord;

			if(self.orientation === "horizontal") {
				coord.left = info.left;
			} else {
				coord.top = info.top;
			}
		},

		fixPosition: function(val) {
			var min = this.paddleSize/2;
			var max = gc.boardWidth - min;

			if(val < min) val = min;
			else if(val > max) val = max;
			return val;
		},

		/**
		 * Makes the current user a player by allowing them to publish mouse movements
		 */
		registerPublisher: function() {
			var self = this;
			var id = this.id;
			var info = {pos: self.pos, id: id };

			self.setLabel("YOU");
			self.isPublisher = true;

			$html.mousemove(function(e) {
				// These positions indicate value of center/middle of paddle
				info.left = self.fixPosition(e.clientX-gc.cLeft);
				info.top = self.fixPosition(e.clientY-gc.cTop);
				info.timestamp = (new Date()).getTime();

				self.updatePaddle({left: info.left, top: info.top}, true);
				client.publish('/games/' + GAME_ID + '/coord', info);
			});
		},
		
		setLabel: function(str) { this.$name.html(str); },
		updateLives: function(val) { this.$lives.html(val); },
		updateScore: function(val) { this.$score.html(val); },

		render: function() {

			this.$name = $("<span/>").addClass("name-label label default");
			this.$lives = $("<span/>").addClass("lives label important");
			this.$score = $("<span/>").addClass("score label success");
			this.setLabel("Player: "+(this.pos+1));
			this.updateLives(0);
			this.updateScore(0);

			var $middle = $("<div/>")
				.addClass("middle")
				.append(this.$name, this.$lives, this.$score);

			this.el.append($middle).addClass("player player-" + this.orientation);
		}
	});




	/**
	 * Game Controller
	 */
	var GameController = Spine.Controller.sub({
		init: function(opts) {
			var self = this;
			var path = '/games/'+GAME_ID;

			self.boardWidth = BOARDSIZE;
			self.ballSize = BALLSIZE;
			self.$board = $("#container");
			self.setOffset();

			self.ballData = [];     // Stack of ball position data (with history)
			self.bdcount = 60;      // Number of history data to keep in stack
			self.ballColor = 0xff000000;

			self.players = [];      // Array of players index is position
			self.specsArr = [];     // Array of spectators

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
			var self = this;
			var _player = self.players[player.pos];

			if(typeof _player === "undefined") return false;
			_player[hit ? "hitPaddle" : "hitWall"](player.lives, player.score);
		},

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
			this.cLeft = offset.left+PADDLEHEIGHT;
			this.cTop = offset.top+PADDLEHEIGHT;
		},

		subscribedMovement: function(info) {
			var self = this;
			self.players[info.pos].updatePaddle({
				left: info.left,
				top: info.top,
				pos: info.pos
			});
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
				if(!playersData[i]) continue;

				id = playersData[i].id;
				name = playersData[i].name;

				idArr.push(id);

				// Registers a player on the board only if they haven't yet
				if(!self.players[i]) {
					var el = $("<div/>").appendTo(this.$board).attr("id", "player"+i);
					self.players[i] = new PlayerController({
						el: "#player"+i,
						id: id,
						pos: i,
						name: name
					});

					// If the current paddle's ID matches the subscriber, make user a publisher
					if(id === self.id) self.players[i].registerPublisher();
				}
			}

			// If you're not a player or spectator(yet), show spectator message
			if(idArr.indexOf(self.id)<0 && self.specsArr.indexOf(self.id)<0) {
				if(obj.gameEnded) self.showLoss(self.players[obj.loser.pos]);
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

			processing.exit();
		}
	});

	var gc = new GameController({el: "body"});
	var processing = new Processing(document.getElementById("canvas"), Sketch);

});
