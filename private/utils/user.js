var ip_locate = require("ip-locator");
var bcrypt = require("bcryptjs");
var path = require("path");
var fs = require("fs");
var mkdir = require("mkdirp");
var check_email = require("email-check");

var SALT_ROUNDS = 10;

var INFO_BASE = path.resolve(__dirname, "../info/");
var USERS_BASE = path.resolve(INFO_BASE, "users/");

function use_invite_code(invite_code) {
	return new Promise(function (resolve, reject) {
		fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
			if (err) {
				return reject(err);
			}
			
			if (data) {
				var json = JSON.parse(data);
				
				if (json[invite_code]) {
					json[invite_code].uses--;
					
					fs.writeFile(path.resolve(INFO_BASE, "invite_codes.json"), JSON.stringify(json), function (err) {
						if (err) {
							return reject(err);
						}
						
						resolve(invite_code);
					});
				}
			}
		});
	});
}

function check_invite_code(invite_code) {
	return new Promise(function (resolve, reject) {
		fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
			if (err) {
				return reject(err);
			}
			
			if (data) {
				var json = JSON.parse(data);
				
				resolve(json[invite_code]);
			}
		});
	});
}

function check_username(username) {
	return new Promise(function (resolve, reject) {
		fs.exists(path.resolve(USERS_BASE, username + "/"), function (exists) {
			resolve(!exists);
		});
	});
}

function user_exists(username) {
	return new Promise(function (resolve, reject) {
		fs.exists(path.resolve(USERS_BASE, username + "/"), function (exists) {
			resolve(exists);
		});
	});
}

function valid_username(username) {
	var check_regex = /[a-zA-Z_\-0-9]+/;
	
	return check_regex.test(username) && username.length > 3 && username.length < 20;
}

function valid_email(email) {
	// https://emailregex.com/
	var check_regex = /(?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
	
	return check_regex.test(email);
}

function valid_pass(password) {
	return password.length > 7;
}

function create_user(request, response, data) {
	var ip = request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'] || request.connection.remoteAddres;
	
	return new Promise(function (resolve, reject) {
		mkdir(path.resolve(USERS_BASE, data.username), function (err) {
			if (err) {
				return reject(err);
			}
			
			var USER_BASE = path.resolve(USERS_BASE, data.username);
			
			ip_locate.getDomainOrIPDetails(ip, "json", function (err, details) {
				fs.writeFile(path.resolve(USER_BASE, "account.json"), JSON.stringify({
				username: data.username,
				email: data.email,
				password: data.hash,
				ip,
				location: details,
				used_invite_code: data.invite_code,
				invited_by: data.invite_code.invited_by,
				admin: false,
				date_joined: new Date().getTime()
			}), function (err) {
				if (err) {
					return reject(err);
				}
				
				fs.writeFile(path.resolve(USER_BASE, "records.json"), JSON.stringify({}), function (err) {
					if (err) {
						return reject(err);
					}
					
					resolve();
				});
			});
			});
		});
	});
}

function handle_signup(request, response) {
	var invite_code = request.headers["invite-code"];
	var email = request.headers["email"];
	var username = request.headers["username"];
	var password = request.headers["password"];
	
	return new Promise(function (resolve, reject) {
		if (valid_username(username)) {
			check_username(username).then(function (available) {
				if (available) {
					if (valid_pass(password)) {
						if (valid_email(email)) {
							check_email(email).then(function (exists) {
								if (exists) {
									check_invite_code(invite_code).then(function (code) {
										if (code && code.uses) {
											bcrypt.genSalt(SALT_ROUNDS, function (err, salt) {
												if (err) {
													console.log("SALT ERROR", err);
													return reject("ERROR: Internal server error.");
												}
												
												bcrypt.hash(password, salt, function (err, hash) {
													if (err) {
														console.log("HASH ERROR", err);
														return reject("ERROR: Internal server error.");
													}
													
													create_user(request, response, {
														username,
														email,
														hash,
														invite_code: code
													}).then(function () {
														use_invite_code(code.code);
														
														resolve({
															username
														});
													}).catch(function (err) {
														if (err) {
															console.log(err);
															reject("ERROR: Failed to create user.");
														}
													});
												});
											});
										} else {
											reject("ERROR: Invalid invite code.");
										}
									}).catch(function (err) {
										if (err) {
											console.log("INVITE CHECK ERROR", err);
											reject("ERROR: Internal server error.");
										}
									});
								} else {
									reject("ERROR: Invalid email.");
								}
							}).catch(function (err) {
								if (err) {
									reject("ERROR: Invalid email.");
								}
							});
						} else {
							reject("ERROR: Invalid email.");
						}
					} else {
						reject("ERROR: Invalid password.");
					}
				} else {
					reject("ERROR: Username taken.");
				}
			}).catch(function (err) {
				if (err) {
					console.log("CHECK USERNAME ERROR", err);
					reject("ERROR: Internal server error.");
				}
			});
		} else {
			reject("ERROR: Invalid username.");
		}
	});
}

module.exports = {
	handle_signup,
	user_exists
};