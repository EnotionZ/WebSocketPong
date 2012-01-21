require(["js/faye_client", "js/spine"], function(client){
	var Lobby = Spine.Controller.sub({
		elements: {
			"#game_list": "$gameList",
			"#game_name": "$gameName"
		},
		events: {
			"click #new_game": "createNewGame",
			"keypress #game_name": "gameInputKeypress",
			"click #game_list li": "joinGame"
		},

		init: function(opts) {
			var self = this;
			client.subscribe('/games', function(info) { self.onGameCreated(info); });
		},

		onGameCreated: function(gameMeta) {
			this.addGame(gameMeta);
		},

		joinGame: function(e) {
			var $t = $(e.target);
			$.ajax({
				type: "POST",
				url: "/join/",
				data: {
					game: {
						name: $t.html()
					}
				},
				success: function(data) {
					console.log("Joined Game", data.name);
				}
			});
		},

		gameInputKeypress: function(e) {
			if(e.keyCode === 13) {
				this.createNewGame();
			}
		},

		createNewGame: function() {
			var self = this;
			$.ajax({
				type: "POST",
				url: "/games/",
				data: {
					game: {
						name: self.$gameName.val()
					}
				},
				success: function(data) {
					self.$gameName.val("");
				}
			});
		},

		renderGamelist: function(data) {
			var self = this;
			self.clearGameList();
			$.each(data, function(i, o) {
				self.addGame(o);
			});
		},

		refreshGameList: function() {
			var self = this;

			$.ajax({
				"url": '/games/',
				"success": function(data) {
					self.renderGamelist(data);
				}
			});
		},

		clearGameList: function() {
			this.$gameList.empty();
		},

		addGame: function(gameMeta) {
			$gameItem = $("<li><a href='/games/" + gameMeta.id + "'>" + gameMeta.name + "</a></li>");
			$gameItem.hide();
			this.$gameList.prepend($gameItem);
			$gameItem.slideDown('fast');
			//this.$gameList.append("<li>" + gameInfo.name + "</li>");
		}
	});
	var lobby = new Lobby({el: "#lobby"});
	lobby.refreshGameList();
});
