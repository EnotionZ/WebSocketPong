(function($){
	var Lobby = Spine.Controller.sub({
		init: function(opts) {
			var self = this;
			this.$gameList = $("ul#game_list");

			this.$newGame = $("#new_game");
			this.$gameName = $("#game_name");

			this.$newGame.click(function() {
				self.newGame();
			});
		},

		newGame: function() {
			var self = this;
			$.ajax({
				type: "POST",
				url: "/games/",
				data: {
					game: {
						name: self.$gameName.val()
					}
				},
				success: function() {
					self.refreshGameList();
				}
			});
		},

		refreshGameList: function() {
			var self = this;

			self.clearGameList();
			$.ajax({
				"url": '/games/',
				"success": function(data) {
					$.each(data, function(i, o) {
						self.addGame(o);
					});
				}
			});
		},

		clearGameList: function() {
			this.$gameList.empty();
		},

		addGame: function(gameInfo) {
			this.$gameList.append("<li>" + gameInfo.name + "</li>");
		}
	});
	var lobby = new Lobby("#lobby");
	lobby.refreshGameList();
})(jQuery);
