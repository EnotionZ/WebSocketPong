require.config({
	baseUrl: "/"
});
require(["js/faye_client", "js/spine"], function(client){

	var $html = $("html");
	var $body = $("body");


	/**
	 * Player Controller
	 */
	var PlayerController = function(opts) { this.init(opts); };
	PlayerController.prototype = {
		init: function(opts) {
			var self = this;

			self.paddleSize = 100;
			self.paddleHeight = 12;

			self.wallColor = "#ccc";

			self.id = opts.id;
			self.pos = opts.pos;
			self.name = opts.name;
			self.coord = {left: 250, top: 250};
			self.orientation = self.pos%2===1 ? "horizontal" : "vertical";

			self.score = 0;
			self.lives = 3;

			self.render();

			if(self.name) self.setLabel(self.name);
		},

		hitPaddle: function() {
			var self = this;
			self.$paddle.css("background-color","#000");
			setTimeout(function() { self.$paddle.css("background-color", self.color); }, 100);
			
			console.log("Hit: " + self.name);
			self.score += 10;
			self.updateScore();
		},

		hitWall: function() {
			var self = this;
			self.el.css("background-color","#000");
			setTimeout(function() { self.el.css("background-color", self.wallColor); }, 100);
			
			console.log("Miss: " + self.name);
			self.lives -= 1;
			self.updateLives();
			if(self.lives <= 0){
				gc.showLoss(self.name);
			}
		},


		/**
		 * Processing a subscribed mouse event triggered by one of the players
		 */
		movePaddle: function(info) {
			var self = this, position;
			var maxPos = gc.boardWidth-self.paddleSize;

			var coord = self.coord;
			self.coord.left = info.left;
			self.coord.top = info.top;

			if(self.orientation === "horizontal") {
				position = info.left - self.paddleSize/2;
				if(position < 0) position = 0;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("left", position);
				coord.left = position;
			} else {
				position = info.top - self.paddleSize/2;
				if(position < 0) position = 0;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("top", position);
				coord.top = position;
			}
		},

		/**
		 * Makes the current user a player by allowing them to publish mouse movements
		 */
		registerPublisher: function() {
			var self = this;
			var pos = this.pos-1;
			var id = this.id;

			this.setLabel("YOU");

			$html.mousemove(function(e) {
				var left = e.clientX-gc.cLeft;
				var top = e.clientY-gc.cTop;
				var info = {pos: pos, id: id, left: left, top: top};

				client.publish('/games/' + GAME_ID + '/coord', info);
			});
		},
		
		setLabel: function(str) { this.$name.html(str); },
		updateLives: function(str) { this.$lives.html(this.lives); },
		updateScore: function(str) { this.$score.html(this.score); },

		render: function() {
			var $middle = $("<div/>").addClass("middle");

			this.$paddle = $("<div/>").addClass("paddle");
			this.$name = $("<span/>").addClass("name-label label default");
			this.$lives = $("<span/>").addClass("lives label important");
			this.$score = $("<span/>").addClass("score label success");
			this.setLabel("Player: "+this.pos);
			this.updateLives();
			this.updateScore();

			$middle.append(this.$name, this.$lives, this.$score);

			this.el = $("<div/>")
			.appendTo(gc.$board)
			.append(this.$paddle, $middle)
			.addClass("player player-" + this.orientation)
			.attr("id", "player"+this.pos);

			this.color = this.$paddle.css("background-color");
		}
	};




	/**
	 * Game Controller
	 */
	var GameController = function(opts) { this.init(opts); };
	GameController.prototype = {
		init: function(opts) {
			var self = this;

			self.boardWidth = 600;
			self.ballSize = 20;
			self.$board = $("#container");
			self.$ball = $("#ball");
			self.setOffset();
			self.ballData = {};

			self.paused = false;

			self.players = {};
			self.playersArr = [];
			self.specsArr = [];
			self.id = "p"+parseInt(Math.random()*999999,10);

			client.subscribe('/games/' + GAME_ID + '/join', function(info) { self.userJoined(info); });
			client.subscribe('/games/' + GAME_ID + '/ball', function(info) { self.updateBall(info); });
			client.subscribe('/games/' + GAME_ID + '/coord', function(info) { self.subscribedMovement(info); });

			self.showNameInput();

			self.$spectators = $("#spectators");
			$("#spectator_anchor").click(function(){ self.$spectators.toggle(); return false; });
			$(window).resize(function(){ self.setOffset(); });
		},

		updateBall: function(info) {
			var self = this;

			self.ballData = info;
			clearTimeout(self.ballmoveTimer);
			self.ballmoveTimer = setInterval(function(){ self.moveBall(); }, 20);
		},

		moveBall: function() {
			var self = this;
			if(!self.paused){
				var bd = self.ballData;

				bd.x = bd.x+bd.incX;
				bd.y = bd.y+bd.incY;

				if(bd.x < 0) {
					bd.incX = Math.abs(bd.incX);
					self.checkContact(self.getPlayer(3), bd.y);
				} else if(bd.x > self.boardWidth-self.ballSize) {
					bd.incX = -Math.abs(bd.incX);
					self.checkContact(self.getPlayer(1), bd.y);
				}
				if(bd.y < 0) {
					bd.incY = Math.abs(bd.incY);
					self.checkContact(self.getPlayer(0), bd.x);
				} if(bd.y > self.boardWidth-self.ballSize) {
					bd.incY = -Math.abs(bd.incY);
					self.checkContact(self.getPlayer(2), bd.x);
				}
				self.$ball.css({left: bd.x, top: bd.y});
			}
		},

		checkContact: function(player, ballPos) {
			var paddlePos;
			if(player.pos === 1 || player.pos === 3) {
				paddlePos = player.coord.left;
			} else {
				paddlePos = player.coord.top;
			}

			if(this._checkContact(player, paddlePos, ballPos)) {
				player.hitPaddle();
			} else {
				player.hitWall();
			}
		},
		_checkContact: function(player, paddlePos, ballPos) {
			return ballPos > paddlePos && ballPos+this.ballSize < paddlePos + player.paddleSize;
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
					//client.publish('/games/' + GAME_ID + '/join', joinEvent);
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

		subscribedMovement: function(info, forced) {
			this.players[info.id].movePaddle({ left: info.left, top: info.top });
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
					self.players[id] = new PlayerController({id: id, pos: i+1, name: name});

					// If the current paddle's ID matches the subscriber, make user a publisher
					if(id === self.id) self.players[id].registerPublisher();
				}
			}

			// If you're not a player or spectator(yet), show spectator message
			if(idArr.indexOf(self.id)<0 && self.specsArr.indexOf(self.id)<0) {
				self.showSpectatorNotice();
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
			
			this.paused = true;
			var $msg = $("<div/>")
				.appendTo(gc.$board).
				addClass("notice")
				.text(loser + "died! Will restart in 15 seconds!");
			setTimeout(function() { $msg.hide(); this.paused = false; }, 15000);
		}
	};
	var gc = new GameController();


});