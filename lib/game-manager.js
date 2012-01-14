var Faye = require('faye');
var Express = require('express');

var GameManager = function(opts) { this.init(opts); };
GameManager.prototype = {
	init: function(opts) {
		console.log("Options: ", opts);
		var self = this;
		self.games = [];

		var app = self.app = Express.createServer();
		app.use('/', Express.static(opts.staticDir));
		app.use(Express.bodyParser());

		app.get('/games/', function(req, res) {
			res.send(self.games);
		});

		app.post('/games/', function(req, res) {
			console.log("POST /games/:", req.body);
			self.games.push(req.body.game);
			res.redirect("/");
		});


		var bayeux = self.bayeux = new Faye.NodeAdapter({ mount: '/faye', timeout: 45 });
		bayeux.attach(app);
		app.listen(opts.port);

	}
};

module.exports = GameManager;
