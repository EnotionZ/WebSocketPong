(function($){
	var client = new Faye.Client('/faye', { timeout: 120 });

	var $body = $("body"), $container = $("#container");
	var $ball = $("#ball");

	var LEFT = 37, RIGHT = 39, UP = 38, DOWN = 40;
	var vel = 5;
	var ballRadius = 10;



	/**
	 * Player Controller
	 */
	var PlayerController = function(opts) {
		this.id = opts.id;
		this.pos = opts.pos;

		this.el = $("#bar"+this.pos);
		this.$name = $("#player"+this.pos);

		this.$name.html("Player: "+this.id);

		console.log("Registering player " + this.id);
	};
	PlayerController.prototype = {

	};




	/**
	 * Game Controller
	 */
	var GameController = function() {
		var self = this;

		self.players = {};
		self.id = "p"+parseInt(Math.random()*999999,10);

		client.subscribe('/join', function(param) { self.playerJoined(param); });
		setTimeout(function(){
			$.ajax("/join?id="+self.id);
		},100);
	};
	GameController.prototype = {
		playerJoined: function(obj) {
			var self = this;
			var players = obj.players;
			var len = players.length, id;

			for(var i=0; i<len; i++) {
				id = players[i];
				if(!self.players[id]) {
					self.players[id] = new PlayerController({id: id, pos: i+1});
					console.log(id, self.id);
					if(id === self.id) self.players[id].$name.html("YOU");
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




	client.subscribe('/cord', function(cord) {
		var top = parseInt($ball.css("top"), 10);
		var left = parseInt($ball.css("left"), 10);

		$ball.css({
			"top": cord.top - ballRadius,
			"left": cord.left - ballRadius
		});

	});


	var
	offset = $container.offset(),
	cLeft = offset.left,
	cTop = offset.top;

	$body.mousemove(function(e) {
		var left = e.clientX-cLeft;
		var top = e.clientY-cTop;

		client.publish('/cord', {left: left, top: top});
	});
})(jQuery);