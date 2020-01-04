var http = require("http");
var WebSocket = require("websocket");
var url = require("url");
var path = require("path");
var fs = require("fs");

var PUBLIC_BASE = path.resolve(__dirname, "../../public/");
var PUBLIC_PAGE = path.resolve(PUBLIC_BASE, "page/");
var PUBLIC_RESOURCE = path.resolve(PUBLIC_BASE, "resource/");

var RESPONSE_404 = "404: PAGE NOT FOUND.";
var RESPONSE_500 = "500: AN ERROR OCCURRED INTERNALLY.";


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

var PORT = process.env.PORT || 8080;
var MAIN_SERVER = http.createServer(function (request, response) {
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

	switch (pathname) {
		case "/":
			fs.readFile(path.resolve(PUBLIC_PAGE, "index.html"), "utf-8", function (err, data) {
				if (err) {
					response.writeHead(500);
					response.end(RESPONSE_500);
					
					return;
				}
				
				response.writeHead(200);
				response.end(data.toString());
			});
			break;
		case "/login":
			fs.readFile(path.resolve(PUBLIC_PAGE, "login.html"), "utf-8", function (err, data) {
				if (err) {
					response.writeHead(500);
					response.end(RESPONSE_500);
					
					return;
				}
				
				response.writeHead(200);
				response.end(data.toString());
			});
			break;
		case "/signup":
			fs.readFile(path.resolve(PUBLIC_PAGE, "signup.html"), "utf-8", function (err, data) {
				if (err) {
					response.writeHead(500);
					response.end(RESPONSE_500);
					
					return;
				}
				
				response.writeHead(200);
				response.end(data.toString());
			});
			break;
		default:
			response.writeHead(404);
			response.end(RESPONSE_404);
			break;
	}
});

MAIN_SERVER.listen(PORT, function () {
	console.log("[" + (new Date()) + "] SERVER LISTENING ON PORT *:" + PORT);
});