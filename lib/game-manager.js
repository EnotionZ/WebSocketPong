var Faye = require('faye');

var GameManager = function(opts) { this.init(opts); };
GameManager.prototype = {
	init: function(opts) {
		var self = this;
		var app = self.app = opts.app;
		self.games = [{"name": "Test Game"}];

		app.get('/games/', function(req, res) {
			res.send(self.games);
		});

		var bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		bayeux.attach(app);

	}
}

module.exports = GameManager
