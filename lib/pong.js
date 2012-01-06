var http = require('http');
var sys = require('sys');
var url = require('url');


var nodeStatic = require('node-static');
var faye = require('faye');


var Pong = function(opts) {
  var self = this;

  self.port = opts.port;
  self.init();
};

Pong.prototype.init = function() {
    var self = this;

    self.httpServer = self.createHTTPServer();
    self.bayeux = new faye.NodeAdapter({ mount: '/faye', timeout: 45 });
    self.bayeux.attach(self.httpServer);
    
    self.httpServer.listen(self.port);
    sys.log("starting server on port " + self.port);
};

Pong.prototype.createHTTPServer = function() {
    var self = this;
    return http.createServer(function(request, response) {

       // https://github.com/cloudhead/node-static for doc
       var file = new nodeStatic.Server('./public', {});

       request.addListener('end', function() {
          var location =  url.parse(request.url, true);
          var params = location.query || request.headers;

		  if(location.pathname == '/cord' && request.method == 'GET') {
			  self.bayeux.getClient().publish('/cord', {
					  top: params.top,
					  left: params.left
				  });
			  response.end();
		  } else {
			  file.serve(request, response);
		  }
          
       });
    });
}

module.exports = Pong;