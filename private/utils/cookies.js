function parse_cookies(cookie) {
    var list = {};

	if (cookie) {
		var pairs = cookie.split(';');
		
		for (let i = 0; i < pairs.length; i++) {
			var parts = pairs[i].split('=');
			list[parts.shift().trim()] = decodeURI(parts.join('='));
		}
	}

    return list;
}

module.exports = parse_cookies;