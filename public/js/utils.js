Klass = (function() {
	function Module() {
		if (typeof this.init === "function") {
			this.init.apply(this, arguments);
		}
	}
	Module.include = function(obj) {
		var included, key, value;
		if (!obj) {
			throw 'include(obj) requires obj';
		}
		for (key in obj) {
			value = obj[key];
			if (__indexOf.call(moduleKeywords, key) < 0) {
				this.prototype[key] = value;
			}
		}
		included = obj.included;
		if (included) {
			included.apply(this);
		}
		return this;
	};
	Module.extend = function(obj) {
		var extended, key, value;
		if (!obj) {
			throw 'extend(obj) requires obj';
		}
		for (key in obj) {
			value = obj[key];
			if (__indexOf.call(moduleKeywords, key) < 0) {
				this[key] = value;
			}
		}
		extended = obj.extended;
		if (extended) {
			extended.apply(this);
		}
		return this;
	};
	Module.proxy = function(func) {
		return __bind(function() {
				return func.apply(this, arguments);
			}, this);
	};
	Module.prototype.proxy = function(func) {
		return __bind(function() {
				return func.apply(this, arguments);
			}, this);
	};
	return Module;
})();

