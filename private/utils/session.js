var bcrypt = require("bcryptjs");
var path = require("path");
var fs = require("fs");
var mkdir = require("mkdirp");
var crypto = require("crypto");

var parse_cookies = require("./cookies.js");

var INFO_BASE = path.resolve(__dirname, "../info/");
var USERS_BASE = path.resolve(INFO_BASE, "users/");

function generate_string() {
	return crypto.randomBytes(20).toString("base64");
}

function create_session(request, response, user) {
	return new Promise(function (resolve, reject) {
		fs.readFile(path.resolve(INFO_BASE, "session.json"), "utf-8", function (err, data) {
			if (err) {
				reject(err);
				return;
			}
			
			var json = JSON.parse(data);
			
			var session = generate_string();
			while (json[session])
				session = generate_string();
			
			json[session] = user;
			
			fs.writeFile(path.resolve(INFO_BASE, "session.json"), JSON.stringify(json), function (err) {
				if (err) {
					reject(err);
					return;
				}
				
				response.setHeader("Set-Cookie", "s_id=" + session + ";");
				
				resolve(session);
			});
		});
	});
}

function destroy_session(request, response) {
	var session = parse_cookies(request.headers.cookie)["s_id"];
	
	return new Promise(function (resolve, reject) {
		if (session) {
			fs.readFile(path.resolve(INFO_BASE, "session.json"), "utf-8", function (err, data) {
				if (err) {
					reject(err);
					return;
				}
				
				var json = JSON.parse(data);
				
				delete json[session];
				
				fs.writeFile(path.resolve(INFO_BASE, "session.json"), JSON.stringify(json), function (err) {
					if (err) {
						reject(err);
						return;
					}
					
					response.setHeader("Set-Cookie", "s_id=;");
					resolve(session);
				});
			});
		} else {
			reject("No session");
		}
	});
}

function check_username(username) {
	return new Promise(function (resolve, reject) {
		fs.exists(path.resolve(USERS_BASE, username.toLowerCase() + "/"), function (exists) {
			resolve(!exists);
		});
	});
}

function get_user_hash(username) {
	return new Promise(function (resolve, reject) {
		check_username(username).then(function (available) {
			if (!available) {
				fs.readFile(path.resolve(USERS_BASE, username.toLowerCase() + "/account.json"), "utf-8", function (err, data) {
					if (err) {
						return reject(err);
					}
					
					var json = JSON.parse(data);
					var hash = json["password"];
					
					resolve(hash);
				});
			} else {
				reject("User not found");
			}
		}).catch(resolve);
	});
}

function valid_username(username) {
	var check_regex = /^[a-zA-Z_\-0-9]+$/;
	
	return check_regex.test(username) && username.length > 3 && username.length < 20;
}

function valid_pass(password) {
	return password.length > 7;
}

function handle_login(request, response) {
	var username = request.headers["username"];
	var password = request.headers["password"];
	
	return new Promise(function (resolve, reject) {
		if (valid_username(username)) {
			check_username(username).then(function (available) {
				if (!available) {
					if (valid_pass(password)) {
						get_user_hash(username).then(function (hash) {
							bcrypt.compare(password, hash, function (err, result) {
								if (err) {
									console.log(err);
									return reject("ERROR: Internal server error.");
								}
								
								if (result) {
									create_session(request, response, username).then(function (session) {
										resolve({
											username: username,
											session: session
										});
									}).catch(function (err) {
										if (err) {
											reject("ERROR: Internal server error.");
										}
									});
								} else {
									reject("ERROR: Invalid credentials.");
								}
							});
						}).catch(function (err) {
							if (err) {
								if (err == "User not found") {
									reject("ERROR: User not found.");
								} else {
									reject("ERROR: Internal server error.");
								}
							}
						});
					} else {
						reject("ERROR: Invalid credentials.");
					}
				} else {
					reject("ERROR: User not found.");
				}
			}).catch(function (err) {
				reject("ERROR: Internal server error.");
			});
		} else {
			reject("ERROR: User not found.");
		}
	}); 
}

function handle_logout(request, response) {
	return new Promise(function (resolve, reject) {
		destroy_session(request, response).then(function (session) {
			resolve();
		}).catch(function (err) {
			reject("ERROR: Internal server error.");
		});
	});
}

module.exports = {
	handle_login,
	handle_logout
}