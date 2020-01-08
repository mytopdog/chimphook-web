var http = require("http");
var https = require("https");
var WebSocket = require("websocket");
var url = require("url");
var path = require("path");
var fs = require("fs");
var uuid = require("uuid/v4");
var html_parser = require("node-html-parser");

var user_handles = require("../utils/user.js");
var session_handles = require("../utils/session.js");
var parse_cookies = require("../utils/cookies.js");

var INFO_BASE = path.resolve(__dirname, "../info/");
var USERS_BASE = path.resolve(INFO_BASE, "users/");

var PUBLIC_BASE = path.resolve(__dirname, "../../public/");
var PUBLIC_PAGE = path.resolve(PUBLIC_BASE, "page/");
var PUBLIC_RESOURCE = path.resolve(PUBLIC_BASE, "resource/");

var CERT_BASE = path.resolve("/etc/letsencrypt/live/thechimp.store-0002");

var RESPONSE_404 = "404: PAGE NOT FOUND.";
var RESPONSE_500 = "500: AN ERROR OCCURRED INTERNALLY.";
var RESPONSE_REDIRECT = "<html><body><script>location.href=\"/\";</script></body></html>";

var MIME_TYPES = {
    html: 'text/html',
    txt: 'text/plain',
    css: 'text/css',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    js: 'application/javascript'
};

function get_query(str, variable) {
    var query = str;
    var vars = query.split('&');
	
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
				
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
	
	return null;
}

var PORT = process.env.PORT || 80;

function load_page(request, response, page) {
	fs.readFile(path.resolve(PUBLIC_PAGE, page), "utf-8", function (err, data) {
		if (err) {
			response.writeHead(500);
			response.end(RESPONSE_500);
			
			return;
		}
	
		var document = html_parser.parse(data, {
			script: true,
			style: true,
			pre: true
		});
		
		if (request.user) {
			var logged_in = document.querySelector("#login-check");
		
			if (logged_in)
				logged_in.set_content("<a href=\"/user?u=" + request.user.username + "\">" + request.user.username + (request.user.admin ? " [ADMIN]" : "") + "</a>");
		}
			
		response.writeHead(200);
		response.end(document.toString());
	});
}

function handle_page(request, response) {
	var parse_url = url.parse(request.url);
	var pathname = parse_url.pathname;
	
	var ip = request.headers['cf-connecting-ip'] || request.headers['x-forwarded-for'] || request.connection.remoteAddres;
	
	fs.readFile(path.resolve(INFO_BASE, "bans.json"), "utf-8", function (err, data) {
		if (err) {
			return;
		}
		
		var json = JSON.parse(data);
		if (json.ip[ip]) {
			respone.writeHead(401);
			return response.end("banned");
		} else {
			if (pathname.startsWith("/resource/")) {
				fs.readFile(path.resolve(PUBLIC_RESOURCE, pathname.substr("/resource/".length)), function (err, data) {
					if (err) {
						if (err.code == "ENOENT") {
							response.setHeader("Content-Type", "text/plain");
							response.writeHead(404);
							response.end(RESPONSE_404);
							return;
						}
						
						response.setHeader("Content-Type", "text/plain");
						response.writeHead(500);
						response.end(RESPONSE_500);
						
						return;
					}
					
					response.setHeader("Content-Type", MIME_TYPES[pathname.split(".")[1]]);
					response.writeHead(200);
					response.end(data);
				});
				
				return;
			}

			switch(request.method) {
				case "GET":
					switch (pathname) {
						case "/":
							load_page(request, response, request.user ? "index_login.html" : "index.html");
							break;
						case "/login":
							load_page(request, response, "login.html");
							break;
						case "/signup":
							load_page(request, response, "signup.html");
							break;
						case "/user":
							function redirect() {
								if (request.user && request.user.username) {
									response.end("<html><body><script>location.href=\"/user?u=" + request.user.username + "\";</script></body></html>");
								} else {
									response.end(RESPONSE_REDIRECT);
								}
							}
							
							if (parse_url.query) {
								var user = get_query(parse_url.query, "u");
								if (user) {
									user_handles.user_exists(user).then(function (exists) {
										if (exists) {
											fs.readFile(path.resolve(PUBLIC_PAGE, "user.html"), "utf-8", function (err, data) {
												if (err) {
													response.writeHead(500);
													response.end(RESPONSE_500);
													
													return;
												}
											
												var document = html_parser.parse(data, {
													script: true,
													style: true,
													pre: true
												});
												
												if (request.user) {
													var logged_in = document.querySelector("#login-check");
												
													if (logged_in)
														logged_in.set_content("<a href=\"/user?u=" + request.user.username + "\">" + request.user.username + (request.user.admin ? " [ADMIN]" : "") + "</a>");
												}
												
												fs.readFile(path.resolve(INFO_BASE, "users/" + user.toLowerCase() + "/account.json"), "utf-8", function (err, data) {
													if (err) {
														response.writeHead(500);
														response.end(RESPONSE_500);
														
														return;
													}
													
													var json = JSON.parse(data);
													var user_e = document.querySelector("#user-info");
													
													user_e.set_content(user_e.innerHTML.replace(/\$user/g, json.username));
													user_e.set_content(user_e.innerHTML.replace(/\$invited_by/g, json.invited_by));
													user_e.set_content(user_e.innerHTML.replace(/\$country(?!code)/g, json.country || "n/a"));
													user_e.set_content(user_e.innerHTML.replace(/\$countrycode/g, json.location.countryCode || ""));
													user_e.set_content(user_e.innerHTML.replace(/\$isadmin/g, json.admin));
													user_e.set_content(user_e.innerHTML.replace(/\$date_joined/g, new Date(json.date_joined).toDateString()));
													
													if (request.user && json.username == request.user.username) {
														user_e.set_content(user_e.innerHTML + "<br><br><span><a href=\"/edit-profile\">[edit profile]</a></span>");
													}
													
													response.writeHead(200);
													response.end(document.toString());
												});
											});
										} else {
											redirect();
										}
									}).catch(redirect);
								} else {
									redirect();
								}
							} else {
								redirect();
							}
							break;
						case "/admin/dash":
							if (request.user && request.user.admin) {
								load_page(request, response, "admin/dash.html");
							} else {
								response.end(RESPONSE_REDIRECT);
							}
						case "/admin/invites":
							if (request.user && request.user.admin) {
								fs.readFile(path.resolve(PUBLIC_PAGE, "admin/invites.html"), "utf-8", function (err, data) {
									if (err) {
										response.writeHead(500);
										response.end(RESPONSE_500);
										
										return;
									}
								
									var document = html_parser.parse(data, {
										script: true,
										style: true,
										pre: true
									});
									
									fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
										if (err) {
											response.writeHead(500);
											response.end(RESPONSE_500);
											
											return;
										}
									
										var json = JSON.parse(data);
										var codes = Object.values(json);
										
										var logged_in = document.querySelector("#login-check");
									
										if (logged_in)
											logged_in.set_content(request.user.username + (request.user.admin ? " [ADMIN]" : ""));
										
										var invites = document.querySelector("#invites");
										
										invites.set_content("<tr><th>#</th><th>[code]</th><th>[uses]</th></tr>" + codes.sort(function (a, b) {
											return b.uses - a.uses;
										}).map(function (code, i) {
											return "<th>" + (i+1) + ". </th>" +
												"<th class=\"code\">" + code.code + "</th>" +
												"<th><input style=\"width: 35px\" value=\"" + code.uses + "\" onchange=\"set_uses('" + code.code + "', this.value)\"/></th>" +
												"<th><a style=\"text-decoration: underline\" href=\"#\" onclick=\"destroy_invite('" + code.code + "')\">x</a></th>"
										}).join("<tr>"));
											
										response.writeHead(200);
										response.end(document.toString());
									});
								});
							} else {
								response.end(RESPONSE_REDIRECT);
							}
							break;
						case "/admin/bans":
							if (request.user && request.user.admin) {
								fs.readFile(path.resolve(PUBLIC_PAGE, "admin/bans.html"), "utf-8", function (err, data) {
									if (err) {
										response.writeHead(500);
										response.end(RESPONSE_500);
										
										return;
									}
								
									var document = html_parser.parse(data, {
										script: true,
										style: true,
										pre: true
									});
									
									fs.readFile(path.resolve(INFO_BASE, "bans.json"), "utf-8", function (err, data) {
										if (err) {
											response.writeHead(500);
											response.end(RESPONSE_500);
											
											return;
										}
									
										var json = JSON.parse(data);
										var users = Object.values(json.users);
										
										var logged_in = document.querySelector("#login-check");
									
										if (logged_in)
											logged_in.set_content(request.user.username + (request.user.admin ? " [ADMIN]" : ""));
										
										var user_bans = document.querySelector("#user-bans");
										
										user_bans.set_content("<tr><th>#</th><th>[user]</th><th>[date]</th><th>[duration]</th></tr>" + users.sort(function (a, b){
											if(a.user < b.user) return -1;
											if(a.user > b.user) return 1;
											return 0;
										}).map(function (ban, i) {
											return "<th>" + (i+1) + ". </th>" +
												"<th class=\"user\">" + ban.user + "</th>" +
												"<th class=\"date\">" + new Date(ban.date).toDateString() + "</th>" +
												"<th class=\"duration\">" + ban.duration_read + "</th>" +
												"<th><a style=\"text-decoration: underline\" href=\"#\" onclick=\"remove_user_ban('" + ban.user + "')\">x</a></th>"
										}).join("<tr>"));
											
										response.writeHead(200);
										response.end(document.toString());
									});
								});
							} else {
								response.end(RESPONSE_REDIRECT);
							}
							break;
						case "/logout":
							session_handles.handle_logout(request, response).then(function () {
								response.writeHead(200);
								response.end(RESPONSE_REDIRECT);
							}).catch(function () {
								response.writeHead(403);
								response.end(RESPONSE_REDIRECT);
							});
							break;
						case "/loggedin":
							if (request.user) {
								response.end(JSON.stringify({
									loggedin: true,
									username: request.user.username
								}));
							} else {
								response.end(JSON.stringify({
									loggedin: false,
									username: ""
								}));
							}
							break;
						default:
							response.writeHead(404);
							response.end(RESPONSE_404);
					}
					break;
				case "POST":
					switch (pathname) {
						case "/signup":
							user_handles.handle_signup(request, response).then(function (success) {
								response.end(JSON.stringify({
									OK: true,
									error: null,
									username: success.username
								}));
							}).catch(function (err) {
								response.writeHead(200);
								response.end(JSON.stringify({
									OK: false,
									error: err
								}));
							});
							break;
						case "/login":
							if (request.user) {
								response.writeHead(200);
								response.end(JSON.stringify({
									OK: false,
									error: "ERROR: You are already logged in"
								}));
							} else {
								session_handles.handle_login(request, response).then(function (success) {
									response.end(JSON.stringify({
										OK: true,
										error: null,
										username: success.username,
										session: success.session
									}));
								}).catch(function (err) {
									response.writeHead(200);
									response.end(JSON.stringify({
										OK: false,
										error: err
									}));
								});
							}
							break;
						case "/logout":
							session_handles.handle_logout(request, response).then(res.send).catch(console.log);
							break;
						case "/admin/modify-invite":
							var action = request.headers["action"];
							var invite_code = request.headers["invite_code"];
							
							if (request.user) {
								if (request.user.admin) {
									fs.readFile(path.resolve(INFO_BASE, "invite_codes.json"), "utf-8", function (err, data) {
										if (err) {
											return response.end(JSON.stringify({
												OK: false,
												error: "ERROR: Internal server error."
											}));
										}
										
										if (data) {
											var json = JSON.parse(data);
											
											if (json[invite_code]) {
												if (action == "delete") {
													delete json[invite_code];
												} else if (action == "set-uses") {
													if ((parseInt(request.headers["uses"]) && parseInt(request.headers["uses"]) > 0) || request.headers["uses"] == 0) {
														json[invite_code].uses = parseInt(request.headers["uses"]);
													}
												}
											}
											
											fs.writeFile(path.resolve(INFO_BASE, "invite_codes.json"), JSON.stringify(json), function (err) {
												if (err) {
													return response.end(JSON.stringify({
														OK: false,
														error: "ERROR: Internal server error."
													}));
												}
												
												var codes = Object.values(json);
												
												response.writeHead(200);
												response.end(JSON.stringify({
													OK: true,
													error: null,
													new_content: "<tr><th>#</th><th>[code]</th><th>[uses]</th></tr>" + codes.sort(function (a, b) {
														return b.uses - a.uses;
													}).map(function (code, i) {
														return "<th>" + (i+1) + ". </th>" +
															"<th class=\"code\">" + code.code + "</th>" +
															"<th><input style=\"width: 35px\" value=\"" + code.uses + "\" onchange=\"set_uses('" + code.code + "', this.value)\"/></th>" +
															"<th><a style=\"text-decoration: underline\" href=\"#\" onclick=\"destroy_invite('" + code.code + "')\">x</a></th>"
													}).join("<tr>")
												}));
											});
										}
									});
								} else {
									response.end(JSON.stringify({
										OK: false,
										error: "ERROR: Not enough permissions."
									}));
								}
							} else {
								response.end(JSON.stringify({
									OK: false,
									error: "ERROR: You are not logged in"
								}));
							}
							break;
						case "/admin/modify-ban":
							var bantype = request.headers["ban-type"];
							var action = request.headers["action"];
							var ban = request.headers["ban"];
							
							if (request.user) {
								if (request.user.admin) {
									fs.readFile(path.resolve(INFO_BASE, "bans.json"), "utf-8", function (err, data) {
										if (err) {
											return response.end(JSON.stringify({
												OK: false,
												error: "ERROR: Internal server error."
											}));
										}
										
										if (data) {
											var json = JSON.parse(data);
											
											if (json[bantype === "user" ? "users" : "ip"][ban]) {
												if (action == "delete") {
													delete json[bantype === "user" ? "users" : "ip"][ban];
												}
											}
											
											fs.writeFile(path.resolve(INFO_BASE, "bans.json"), JSON.stringify(json), function (err) {
												if (err) {
													return response.end(JSON.stringify({
														OK: false,
														error: "ERROR: Internal server error."
													}));
												}
												
												var users = Object.values(json.users);
												
												response.writeHead(200);
												response.end(JSON.stringify({
													OK: true,
													error: null,
													new_content: "<tr><th>#</th><th>[user]</th><th>[date]</th><th>[duration]</th></tr>" + users.sort(function (a, b){
														if(a.user < b.user) return -1;
														if(a.user > b.user) return 1;
														return 0;
													}).map(function (ban, i) {
														return "<th>" + (i+1) + ". </th>" +
															"<th class=\"user\">" + ban.user + "</th>" +
															"<th class=\"date\">" + new Date(ban.date).toDateString() + "</th>" +
															"<th class=\"duration\">" + ban.duration_read + "</th>" +
															"<th><a style=\"text-decoration: underline\" href=\"#\" onclick=\"remove_user_ban('" + ban.user + "')\">x</a></th>"
													}).join("<tr>")
												}));
											});
										}
									});
								} else {
									response.end(JSON.stringify({
										OK: false,
										error: "ERROR: Not enough permissions."
									}));
								}
							} else {
								response.end(JSON.stringify({
									OK: false,
									error: "ERROR: You are not logged in"
								}));
							}
							break;
					}
					break;
			}
		}
	});
}

function handle_request(request, response) {
	var session = parse_cookies(request.headers.cookie)["s_id"];
	request.user = null;
	
	if (session) {
		fs.readFile(path.resolve(INFO_BASE, "session.json"), "utf-8", function (err, data) {
			if (err) {
				console.log(err);
				return handle_page(request, response, null);
			}
			
			var json = JSON.parse(data);
			
			if (json[session]) {
				fs.readFile(path.resolve(INFO_BASE, "users/" + json[session].toLowerCase() + "/account.json"), "utf-8", function (err, data) {
					if (err) {
						console.log(err);
						return handle_page(request, response);
					}
					
					request.user = JSON.parse(data);
					return handle_page(request, response);
				});
			} else {
				return handle_page(request, response);
			}
		});
	} else {
		handle_page(request, response, null);
	}
}

(function main(args) {
	var MAIN_SERVER;

	if (false) {//fs.existsSync(CERT_BASE)) {
		PORT = 433;
		MAIN_SERVER = https.createServer({
			key: fs.readFileSync(path.resolve(CERT_BASE, "privkey.pem")),
			cert: fs.readFileSync(path.resolve(CERT_BASE, "cert.pem")),
			ca: fs.readFileSync(path.resolve(CERT_BASE, "chain.pem"))
		}, function (request, response) {
			handle_request(request, response);
		});
	} else {
		PORT = 80;
		MAIN_SERVER = http.createServer(function (request, response) {
			handle_request(request, response);
		});
	}

	MAIN_SERVER.listen(PORT, function () {
		console.log("[" + (new Date()) + "] SERVER LISTENING ON PORT *:" + PORT);
	});
})(process.argv.splice(2));