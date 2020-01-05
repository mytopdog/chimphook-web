function check_login() {
	
}

function update_page() {
	var login_check = document.querySelector("#login-check");
	
	let xhr = new XMLHttpRequest();
	xhr.open("GET", "/loggedin");
	xhr.setRequestHeader("-from", "-web-client");
	xhr.send();

	xhr.onload = function() {
		if (xhr.status == 200) {
			var json = JSON.parse(xhr.response);
			
			if (json.loggedin) {
				login_check.innerHTML = json.username;
			}
		}
	}
}