(function($){

	var client = new Faye.Client('/faye', { timeout: 120 });

	var $body = $("body");
	var $container = $("#container");
	var $ball = $("#ball");

	var LEFT = 37, RIGHT = 39, UP = 38, DOWN = 40;

	var vel = 5;

	var offset = $container.offset();
	var cLeft = offset.left;
	var cTop = offset.top;


	/**
	 * Player Controller
	 */
	var PlayerController = function(opts) { this.init(opts); };
	PlayerController.prototype = {
		init: function(opts) {
			var self = this;

			self.id = opts.id;
			self.pos = opts.pos;
			self.orientation = self.pos%2===1 ? "horizontal" : "vertical";

			self.el = $("#bar"+self.pos);
			self.$name = $("#player"+self.pos);

			self.render();
		},
		movePaddle: function(info) {
			var self = this;
			if(self.orientation === "horizontal") {
				self.$paddle.css("left", info.left);
			} else {
				self.$paddle.css("top", info.top);
			}
		},
		registerPublisher: function() {
			var id = this.id;

			this.setLabel("YOU");

			$body.mousemove(function(e) {
				var left = e.clientX-cLeft;
				var top = e.clientY-cTop;

				client.publish('/coord', {id: id, left: left, top: top});
			});
		},
		setLabel: function(str) {
			this.$name.html(str);
		},
		render: function() {
			this.$paddle = $("<div/>").addClass("paddle");
			this.$name = $("<span/>").addClass("name-label");
			this.setLabel("Player: "+this.pos);

			this.el = $("<div/>")
			.appendTo($container)
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

			self.players = {};
			self.id = "p"+parseInt(Math.random()*999999,10);

			client.subscribe('/join', function(param) { self.playerJoined(param); });
			setTimeout(function(){
				$.ajax("/join?id="+self.id);
			},100);

			client.subscribe('/coord', function(info) { self.subscribedMovement(info); });
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