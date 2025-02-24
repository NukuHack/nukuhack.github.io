// this is just a dummy

const Polygons = [
	'square',
	"triangle",
	"circle",
	"octagon",
	`pentagon`
];

const SelectList = document.getElementById('select_animation');

Polygons.forEach((polygon) => {
	SelectList.innerHTML += `
    <option value="${polygon}">
        ${polygon.slice(0, 1).toUpperCase() + polygon.slice(1)}
    </option>
    `;
});



function AnimatePolygon() {
	//console.log("Is called with : "+item)
	let item = document.getElementById('select_animation').value;
	//console.log("Item later defined : "+item)
	if (item !== "default") {
		//console.log("should run with: "+item)
		item = document.getElementById(item);
		item.classList.toggle('animate');
	} else {
		Polygons.forEach(polygon => {
			item = document.getElementById(polygon);
			item.classList.remove('animate');
		})
	}
}

function AnimateCube() {
	let animCube = document.getElementById('animCube');
	let cube = document.getElementById('cube');
	if (animCube.value !== "Stop the Cube") {
		animCube.value = "Stop the Cube";
		cube.classList.add('animate');
	} else {
		animCube.value = "Animate the Cube";
		cube.classList.remove('animate');
	}
}



