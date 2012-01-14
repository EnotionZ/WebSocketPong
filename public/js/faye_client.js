define(['faye'], function () {
	return new Faye.Client('/faye', { timeout: 120 });	
});
