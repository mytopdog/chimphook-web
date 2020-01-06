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
				logged_in.set_content(request.user.username + (request.user.admin ? " [ADMIN]" : ""));
		}
			
		response.writeHead(200);
		response.end(document.toString());
	});
}

function handle_page(request, response) {
	var parse_url = url.parse(request.url);
	var pathname = parse_url.pathname;
	
	if (pathname.startsWith("/resource/")) {
		fs.readFile(path.resolve(PUBLIC_RESOURCE, pathname.substr("/resource/".length)), function (err, data) {
			if (err) {
				if (err.code == "ENOENT") {
					response.setHeader("Content-Type", "text/plain");
					response.writeHead(404);
					response.end(RESPONSE_404);
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
				case "/account":
					function redirect() {
						if (request.user.username) {
							response.end("<html><body><script>location.href=\"/account?user=" + request.user.username + "\";</script></body></html>");
						} else {
							response.end(RESPONSE_REDIRECT);
						}
					}
					
					if (parse_url.query) {
						var user = get_query(parse_url.query, "user");
						if (user) {
							user_handles.user_exists(user).then(function (exists) {
								if (exists) {
									fs.readFile(path.resolve(PUBLIC_PAGE, "account.html"), "utf-8", function (err, data) {
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
												logged_in.set_content(request.user.username + (request.user.admin ? " [ADMIN]" : ""));
										}
										
										var user_e = document.querySelector("#user-info");
										
										fs.readFile(path.resolve(INFO_BASE, "users/" + user + "/account.json"), "utf-8", function (err, data) {
											if (err) {
												response.writeHead(500);
												response.end(RESPONSE_500);
												
												return;
											}
											
											var json = JSON.parse(data);
											
											user_e.set_content(user_e.innerHTML.replace(/\$user/g, json.username));
											user_e.set_content(user_e.innerHTML.replace(/\$invited_by/g, json.invited_by));
											user_e.set_content(user_e.innerHTML.replace(/\$country(?!code)/g, json.location.country || "n/a"));
											user_e.set_content(user_e.innerHTML.replace(/\$countrycode/g, json.location.countryCode || ""));
											user_e.set_content(user_e.innerHTML.replace(/\$isadmin/g, json.admin));
											user_e.set_content(user_e.innerHTML.replace(/\$date_joined/g, new Date(json.date_joined).toDateString()));
											
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
				case "/admin/invites":
					if (request.user && request.user.admin) {
						fs.readFile(path.resolve(PUBLIC_PAGE, "invites.html"), "utf-8", function (err, data) {
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
										"<th>" + code.uses + "</th>";
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
							err
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
						}).catch(function (error) {
							response.writeHead(200);
							response.end(JSON.stringify({
								OK: false,
								error
							}));
						});
					}
					break;
				case "/logout":
					session_handles.handle_logout(request, response).then(res.send).catch(console.log);
					break;
			}
			break;
	}
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
				fs.readFile(path.resolve(INFO_BASE, "users/" + json[session] + "/account.json"), "utf-8", function (err, data) {
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
	
	console.log("Cert exists?: " + fs.existsSync(path.resolve(__dirname, "../cert/")));

	if (fs.existsSync(path.resolve(__dirname, "../cert/"))) {
		PORT = 433;
		MAIN_SERVER = https.createServer({
			key: fs.readFileSync(path.resolve(__dirname, "../cert/privkey.pem")),
			cert: fs.readFileSync(path.resolve(__dirname, "../cert/cert.pem")),
			ca: fs.readFileSync(path.resolve(__dirname, "../cert/chain.pem"))
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