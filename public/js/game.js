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
			self.coord = {left: 300, top: 300};
			self.orientation = self.pos%2===1 ? "horizontal" : "vertical";

			self.render();

			if(self.name) self.setLabel(self.name);
		},

		hitPaddle: function(lives, score) {
			var self = this;
			self.$paddle.css("background-color","#000");
			setTimeout(function() { self.$paddle.css("background-color", self.color); }, 100);
			
			console.log("Hit: " + self.name);
			self.updateScore(score);
		},

		hitWall: function(lives, score) {
			var self = this;
			self.el.css("background-color","#000");
			setTimeout(function() { self.el.css("background-color", self.wallColor); }, 100);
			
			console.log("Miss: " + self.name);
			self.updateLives(lives);
			if(lives <= 0) gc.showLoss(self);
		},


		/**
		 * Processing a subscribed mouse event triggered by one of the players
		 */
		movePaddle: function(info) {
			var self = this, position;
			var maxPos = gc.boardWidth-self.paddleSize/2;

			var coord = self.coord;
			self.coord.left = info.left;
			self.coord.top = info.top;

			if(self.orientation === "horizontal") {
				position = info.left - self.paddleSize/2;
				position = self.fixPosition(position, maxPos);
				self.$paddle.css("left", position);
				coord.left = position;
			} else {
				position = info.top - self.paddleSize/2;
				position = self.fixPosition(position, maxPos);
				self.$paddle.css("top", position);
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
			var pos = this.pos-1;
			var id = this.id;
			var maxPos = gc.boardWidth-self.paddleSize/2;
			var info = {pos: pos, id: id, left: 300, top: 300};

			this.setLabel("YOU");

			client.publish('/games/' + GAME_ID + '/coord', info);
			$html.mousemove(function(e) {
				info.left = self.fixPosition(e.clientX-gc.cLeft, maxPos);
				info.top = self.fixPosition(e.clientY-gc.cTop, maxPos);

				client.publish('/games/' + GAME_ID + '/coord', info);
			});
		},
		
		setLabel: function(str) { this.$name.html(str); },
		updateLives: function(val) { this.$lives.html(val); },
		updateScore: function(val) { this.$score.html(val); },

		render: function() {
			var $middle = $("<div/>").addClass("middle");

			this.$paddle = $("<div/>").addClass("paddle");
			this.$name = $("<span/>").addClass("name-label label default");
			this.$lives = $("<span/>").addClass("lives label important");
			this.$score = $("<span/>").addClass("score label success");
			this.setLabel("Player: "+this.pos);
			this.updateLives(0);
			this.updateScore(0);

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
			var path = '/games/'+GAME_ID;

			self.boardWidth = 600;
			self.ballSize = 20;
			self.$board = $("#container");
			self.$ball = $("#ball");
			self.setOffset();
			self.ballData = {};

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

			self.ballData = info;
			self.$ball.css({left: info.x, top: info.y});
		},


		checkContact: function(player, hit) {
			var _player = this.players[player.id];
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
			var $msg = $("<div/>")
				.appendTo($body)
				.addClass("notice")
				.html("<span>"+loser.name + " died! Game Over!!</span>");
		}
	};
	var gc = new GameController();


});
