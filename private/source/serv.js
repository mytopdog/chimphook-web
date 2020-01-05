var http = require("http");
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

function load_page(request, response, page, session) {
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
		
		if (session) {
			var logged_in = document.querySelector("#login-check");
		
			if (logged_in)
				logged_in.set_content(session);
		}
			
		response.writeHead(200);
		response.end(document.toString());
	});
}

function handle_page(request, response, session) {
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
					load_page(request, response, session ? "index_login.html" : "index.html", session);
					break;
				case "/login":
					load_page(request, response, "login.html", session);
					break;
				case "/signup":
					load_page(request, response, "signup.html", session);
					break;
				case "/account":
					if (parse_url.query) {
						console.log(get_query(parse_url.query, "user"));
							
						if (get_query(parse_url.query, "user")) {
							user_handles.user_exists(get_query(parse_url.query, "user")).then(function (exists) {
								load_page(request, response, "account.html", session);
							}).catch(function () {
								if (session) {
									response.end("<html><body><script>location.href=\"/account?user=" + session + "\";</script></body></html>");
								} else {
									response.end(RESPONSE_REDIRECT);
								}
							});
						} else {
							if (session) {
								response.end("<html><body><script>location.href=\"/account?user=" + session + "\";</script></body></html>");
							} else {
								response.end(RESPONSE_REDIRECT);
							}
						}
					} else {
						if (session) {
							response.end("<html><body><script>location.href=\"/account?user=" + session + "\";</script></body></html>");
						} else {
							response.end(RESPONSE_REDIRECT);
						}
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
					if (session) {
						response.end(JSON.stringify({
							loggedin: true,
							username: session
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
					break;
				case "/logout":
					session_handles.handle_logout(request, response).then(res.send).catch(console.log);
					break;
			}
			break;
	}
}

var MAIN_SERVER = http.createServer(function (request, response) {
	var session = parse_cookies(request.headers.cookie)["s_id"];
	
	if (session) {
		fs.readFile(path.resolve(INFO_BASE, "session.json"), "utf-8", function (err, data) {
			if (err) {
				console.log(err);
				return handle_page(request, response, null);
			}
			
			var json = JSON.parse(data);
			handle_page(request, response, json[session] || null);
		});
	} else {
		handle_page(request, response, null);
	}
});

MAIN_SERVER.listen(PORT, function () {
	console.log("[" + (new Date()) + "] SERVER LISTENING ON PORT *:" + PORT);
});