(function($){

	var client = new Faye.Client('/faye', { timeout: 120 });
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
			self.orientation = self.pos%2===1 ? "horizontal" : "vertical";

			self.el = $("#bar"+self.pos);
			self.$name = $("#player"+self.pos);

			self.render();
		},

		/**
		 * Processing a subscribed mouse event triggered by one of the players
		 */
		movePaddle: function(info) {
			var self = this, position;
			var maxPos = gc.boardWidth-self.paddleSize - self.paddleHeight;
			if(self.orientation === "horizontal") {
				position = info.left - self.paddleSize/2;
				if(position < self.paddleHeight) position = self.paddleHeight;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("left", position);
			} else {
				position = info.top - self.paddleSize/2;
				if(position < self.paddleHeight) position = self.paddleHeight;
				else if(position > maxPos) position = maxPos;
				self.$paddle.css("top", position);
			}
		},

		/**
		 * Makes the current user a player by allowing them to publish mouse movements
		 */
		registerPublisher: function() {
			var id = this.id;

			this.setLabel("YOU");

			$body.mousemove(function(e) {
				var left = e.clientX-gc.cLeft;
				var top = e.clientY-gc.cTop;

				client.publish('/coord', {id: id, left: left, top: top});
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
			self.$board = $("#container");
			self.$ball = $("#ball");
			self.setOffset();

			self.players = {};
			self.id = "p"+parseInt(Math.random()*999999,10);

			client.subscribe('/join', function(param) { self.playerJoined(param); });
			setTimeout(function(){
				$.ajax("/join?id="+self.id);
			},100);

			client.subscribe('/coord', function(info) { self.subscribedMovement(info); });

			$(window).resize(function(){ self.setOffset(); });
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
			this.players[info.id].movePaddle({ left: info.left, top: info.top });
		},

		playerJoined: function(obj) {
			var self = this;
			var players = obj.players;
			var len = players.length, id;

			for(var i=0; i<len; i++) {
				id = players[i];
				// Registers a player on the board only if they haven't yet
				if(!self.players[id]) {
					self.players[id] = new PlayerController({id: id, pos: i+1});

					// If the current paddle's ID matches the subscriber, make user a publisher
					if(id === self.id) self.players[id].registerPublisher();
				}
			}

			if(players.indexOf(self.id)<0) {
				self.showSpectatorNotice();
			}
		},

		showSpectatorNotice: function() {
			$("<div/>")
				.addClass("spectator-notice")
				.html("<span>Game is full, you will be a spectator</span>")
				.appendTo($body)
				.click(function(){
					$(this).remove();
				});
		}
	};
	var gc = new GameController();


})(jQuery);