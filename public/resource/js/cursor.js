var mouse_pos_x = 0;
var mouse_pos_y = 0;

window.addEventListener("mousemove", function (event) {
	var cursor = document.querySelector(".-main-cursor");

	mouse_pos_x = event.pageX;
	mouse_pos_y = event.pageY;
	
	cursor.style.left = event.pageX;
	cursor.style.top = event.pageY;
});