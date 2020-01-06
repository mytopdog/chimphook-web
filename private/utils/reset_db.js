var fs = require("fs");
var path = require("path");
var readline = require("readline");

var INFO_BASE = path.resolve(__dirname, "../info/");
var USERS_BASE = path.resolve(INFO_BASE, "users/");

var SETTINGS = {
	AWAIT_CONFIRM: 5000,
	DO_BANS: true
}

function handle_error(err) {
	if (err) {
		console.log("[FATAL] Error occurred. Stopping whole process.");
		console.log("[FATAL] Error info: ", err);
		console.log("[END] Ended process");
		process.exit(1);
	}
}

function clear_users() {
	return new Promise(function (resolve, reject) {
		console.log("- - [INFO] Reading user directory..");
		fs.readdir(USERS_BASE, function (err, files) {
			if (err) {
				return reject(err);
			}
			
			if (!files.length) {
				console.log("- - [INFO] No users found. Skipping..");
				resolve(true);
				return;
			}
			
			console.log("- - [INFO] Read user directory.");
			console.log("- - [INFO] Deleting users..");
			(function del_user(i) {
				console.log("- - - [INFO] Deleting user " + files[i] + ".");
				console.log("- - - - [INFO] Deleting user " + files[i] + "'s account.json.");
				fs.unlink(path.resolve(USERS_BASE, files[i] + "/account.json"), function (err) {
					if (err && err.code != "ENOENT") {
						return reject(err);
					}
					
					console.log("- - - - [INFO] Deleted user " + files[i] + "'s account.json.");
					console.log("- - - - [INFO] Deleting user " + files[i] + "'s records.json.");
					fs.unlink(path.resolve(USERS_BASE, files[i] + "/records.json"), function (err) {
						if (err && err.code != "ENOENT") {
							return reject(err);
						}
						
						console.log("- - - - [INFO] Deleted user " + files[i] + "'s records.json.");
						
						console.log("- - - - [INFO] Deleting user " + files[i] + "'s folder.");
						fs.rmdir(path.resolve(USERS_BASE, files[i]), function (err) {
							if (err) {
								return reject(err);
							}
							
							console.log("- - - - [INFO] Deleted user " + files[i] + "'s folder.");
							console.log("- - -  [INFO] Deleted user " + files[i] + ".");
							
							if (++i < files.length) {
								del_user(i);
							} else {
								console.log("- - [INFO] Successfully deleted all users.");
								resolve(true);
							}
						});
					});
				});
			})(0);
		});
	});
}

function clear_files() {
	return new Promise(function (resolve, reject) {
		console.log("- - [INFO] Clearing invite code database..");
		fs.writeFile(path.resolve(INFO_BASE, "invite_codes.json"), "{}", function (err) {
			if (err) {
				return reject(err);
			}
			
			console.log("- - [INFO] Cleared invite code database.");
			console.log("- - [INFO] Clearing session database..");
			fs.writeFile(path.resolve(INFO_BASE, "session.json"), "{}", function (err) {
				if (err) {
					return reject(err);
				}
				
				console.log("- - [INFO] Cleared session database.");
				
				if (SETTINGS.DO_BANS) {
					console.log("- - [INFO] Clearing ban database..");
					
					fs.writeFile(path.resolve(INFO_BASE, "bans.json"), "{\"ip\": {}, \"users\": {}}", function (err) {
						if (err) {
							return reject(err);
						}
						
						console.log("- - [INFO] Cleared ban database.");
						
						resolve(true);
					});
				} else {
					console.log("- - [INFO] Skipping ban database..");
				
					resolve(true);
				}
			});
		});
	});
}

function clear_db() {
	console.log("[BEGIN] Beginning process..");
		
	return new Promise(function (resolve, reject) {
		console.log("- [INFO] Clearing database files..");
		clear_files().then(function() {
			console.log("- [INFO] Cleared database files.");
			console.log("- [INFO] Clearing user files..");
			
			clear_users().then(function () {
				console.log("- [INFO] Cleared user files.");
				resolve();
			}).catch(function (err) {
				reject(err);
				return handle_error(err);
			});
		}).catch(function (err) {
			reject(err);
			return handle_error(err);
		});
	});
}

function begin_clear() {
	console.log("[BEGIN] Beginning process in " + (SETTINGS.AWAIT_CONFIRM / 1000) + " seconds..");
	
	setTimeout(function () {
		clear_db().then(function () {
			console.log("[END] Process complete.");
		}).catch(()=>{});
	}, SETTINGS.AWAIT_CONFIRM);
}

(function main(args) {
	if (args.indexOf("-no-print") != -1) {
		console.log = _=>0;
	}
	
	if (args.indexOf("-no-wait") != -1) {
		SETTINGS.AWAIT_CONFIRM = 0;
	}
	
	if (args.indexOf("-no-bans") != -1) {
		SETTINGS.DO_BANS = false;
	}
	
	console.log("[BEGIN] Database clearing.");
	
	if (args.indexOf("-confirm") != -1) {
		return begin_clear();
	}
	
	const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

	rl.question("[CONFIRM] ARE YOU SURE YOU WISH TO COMPLETELY ERASE THE DATABASE? THIS ACTION IS IRREVERSIBLE AND COULD LEAD TO UNINTENDED CONSEQUENCES. (Y/N)", function (ans) {
		rl.close();
		
		if (ans == "Y") {
			console.log("[INFO] User confirmed database clearing.");
			return begin_clear();
		} else {
			console.log("[INFO] User cancelled database clearing.");
		}
	});
})(process.argv.splice(2));