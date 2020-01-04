var fs = require("fs");
var path = require("path");
var uuid = require("uuid/v4");

var INFO_BASE = path.resolve(__dirname, "../info/");

function generate_code() {
	return uuid();
}

function create_invite_code() {
	return new Promise(function (resolve, reject) {
		fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
			if (err) {
				reject(err);
				return;
			}
			
			if (data) {
				var text = data.toString();
				var json = JSON.parse(text);
				
				var code = generate_code();
				
				while (!json[code]) {
					code = generate_code();
				}
				
				json[code] = true;
				
				fs.writeFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
					if (err) {
						reject(err);
						return;
					}
					
					resolve(code);
				});
			}
		});
	});
}

function create_invite_codes(amount) {
	return new Promise(function (resolve, reject) {
		var invites = [];
		
		fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
			if (err) {
				reject(err);
				return;
			}
			
			if (data) {
				var text = data.toString();
				var json = JSON.parse(text);
				
				for (var i = 0; i < amount; i++) {
					var code = generate_code();
				
					while (json[code]) {
						code = generate_code();
					}
					
					json[code] = true;
					invites.push(code);
				}
					
				fs.writeFile(path.resolve(INFO_BASE, "invite_codes.json"), JSON.stringify(json), function (err, data) {
					if (err) {
						reject(err);
						return;
					}
					
					resolve(invites);
				});
			}
		});
	});
}

module.exports = {
	create_invite_codes
}