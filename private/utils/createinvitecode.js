var fs = require("fs");
var path = require("path");
var invcode = require("../utils/invite-codes.js");

(function main(args) {
	if (!args.length) {
		console.log("[FATAL] Please specify the amount of invites");
		return;
	}
	
	var invites = Number(args[0]);
	var uses = Number(args[2]);
	
	if (!invites) {
		console.log("[FATAL] Expected integer for argument 1");
		return;
	}
	
	console.log("[INFO] Creating " + args[0] + " invites..");
	
	invcode.create_invite_codes(invites, uses || 1, "ADMIN").then(function (invites) {
		if (args[1]) {
			fs.writeFile(path.resolve(__dirname, args[1]), invites.join("\n"), function (err, data) {
				if (err) {
					console.log("[FATAL] A fatal error occured. Details: ");
					console.log(err);
					return;
				}
				
			console.log("[INFO] Created " + args[0] + " invites at " + __dirname + "\\" + args[1] + ".");
			});
		} else {
			console.log(invites.join("\n"));
		}
	}).catch(function (e) {
		if (e) {
			console.log("[FATAL] A fatal error occured. Details: ");
			console.log(e);
		}
	});
})(process.argv.splice(2));