(function($){

	var client = new Faye.Client('/faye', { timeout: 120 });
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

			self.id = opts.id;
			self.pos = opts.pos;
			self.name = opts.name;
			self.orientation = self.pos%2===1 ? "horizontal" : "vertical";

			self.el = $("#bar"+self.pos);
			self.$name = $("#player"+self.pos);

			self.render();

			if(self.name) self.setLabel(self.name);
		},

		/**
		 * Processing a subscribed mouse event triggered by one of the players
		 */
		movePaddle: function(info) {
			var self = this, position;
			var maxPos = gc.boardWidth-self.paddleSize;
			if(self.orientation === "horizontal") {
				position = info.left - self.paddleSize/2;
				if(position < 0) position = 0;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("left", position);
			} else {
				position = info.top - self.paddleSize/2;
				if(position < 0) position = 0;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("top", position);
			}
		},

		/**
		 * Makes the current user a player by allowing them to publish mouse movements
		 */
		registerPublisher: function() {
			var pos = this.pos-1;
			var id = this.id;

			this.setLabel("YOU");

			$html.mousemove(function(e) {
				var left = e.clientX-gc.cLeft;
				var top = e.clientY-gc.cTop;
				var info = {pos: pos, id: id, left: left, top: top};

				client.publish('/coord', info);
				gc.subscribedMovement(info, true);
			});
		},
		
		setLabel: function(str) { this.$name.html(str); },

		render: function() {
			this.$paddle = $("<div/>").addClass("paddle");
			this.$name = $("<span/>").addClass("name-label");
			this.setLabel("Player: "+this.pos);

			this.el = $("<div/>")
			.appendTo(gc.$board)
			.append(this.$paddle, this.$name)
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

			self.boardWidth = 600;
			self.ballSize = 20;
			self.$board = $("#container");
			self.$ball = $("#ball");
			self.setOffset();
			self.ballData = {};

			self.players = {};
			self.specsArr = [];
			self.id = "p"+parseInt(Math.random()*999999,10);

			client.subscribe('/join', function(info) { self.userJoined(info); });
			client.subscribe('/ball', function(info) { self.updateBall(info); });
			client.subscribe('/coord', function(info) { self.subscribedMovement(info); });

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
			var bd = self.ballData;

			bd.x = bd.x+bd.incX;
			bd.y = bd.y+bd.incY;

			if(bd.x < 0) bd.incX = Math.abs(bd.incX);
			if(bd.x > self.boardWidth-self.ballSize) bd.incX = -Math.abs(bd.incX);

			if(bd.y < 0) bd.incY = Math.abs(bd.incY);
			if(bd.y > self.boardWidth-self.ballSize) bd.incY = -Math.abs(bd.incY);
			self.$ball.css({left: bd.x, top: bd.y});
		},

		showNameInput: function() {
			var self = this;

			var $notice = $("<div/>")
				.addClass("notice")
				.append("<span>Enter your name <input type=\"text\" class=\"input\"></span>")
				.appendTo($body);

			var $input = $notice.find("input").focus();
			$input.keypress(function(e){
				if(e.keyCode === 13) {
					$notice.remove();
					self.subName = $input.val();
					$.ajax("/join?id="+self.id+"&name="+self.subName);
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
			// allows current player's view to update without coming from subscription
			if(!forced && info.id === self.id) return; 

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
		}
	};
	var gc = new GameController();


})(jQuery);