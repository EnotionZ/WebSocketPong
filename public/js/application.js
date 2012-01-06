var client = new Faye.Client('/faye', { timeout: 120 });

var $ball = $("#ball");
var LEFT = 37, RIGHT = 39, UP = 38, DOWN = 40;
var vel = 5;


var Player = function(opts) {

};
Player.prototype = {

};



var Game = function() {
};



client.subscribe('/cord', function(cord) {
	var top = parseInt($ball.css("top"), 10);
	var left = parseInt($ball.css("left"), 10);

	$ball.css({
		"top": cord.top,
		"left": cord.left
	});

});


var $body = $("body"),
$container = $("#container"),
offset = $container.offset(),
cLeft = offset.left,
cTop = offset.top;

$body.mousemove(function(e) {
	var left = e.clientX-cLeft;
	var top = e.clientY-cTop;

	client.publish('/cord', {left: left, top: top});
})
.keydown(function(e) {
	var k = e.keyCode;
	if(k === LEFT || k === RIGHT || k === UP || k === DOWN) {
		var cord = {};
		if(e.keyCode === DOWN) {
			cord.top = vel;
		} else if(e.keyCode === UP) {
			cord.top = -vel;
		} else if(e.keyCode === LEFT) {
			cord.left = -vel;
		} else {
			cord.left = vel;
		}

		client.publish('/cord', cord);
	}
});