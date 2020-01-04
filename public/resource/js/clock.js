function pad_0(str) {
	return str.toString().length < 2 ? "0" + str : str;
}

window.onload = function () {
	var hour = document.querySelector("#hour");
	var minute = document.querySelector("#minute");
	var second = document.querySelector("#second");
	var date = new Date();

	hour.innerHTML = pad_0(date.getHours());
	minute.innerHTML = pad_0(date.getMinutes());
	second.innerHTML = pad_0(date.getSeconds());
}

setInterval(function() {
	var hour = document.querySelector("#hour");
	var minute = document.querySelector("#minute");
	var second = document.querySelector("#second");
	var date = new Date();
	
	hour.innerHTML = pad_0(date.getHours());
	minute.innerHTML = pad_0(date.getMinutes());
	second.innerHTML = pad_0(date.getSeconds());
}, 500);