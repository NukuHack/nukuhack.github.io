// this is just a dummy

const Polygons = [
    'square',
    "triangle",
    "circle",
    'square',
    "octagon",
    `pentagon`
];

const SelectList = document.getElementById('select_animation');


function Animate(item) {
    //console.log("Is called with : "+item)
    if (!item) {
        item = document.getElementById('select_animation').value;
        //console.log("Item later defined : "+item)
    }
    ;
    if (item.toString().toLowerCase() == "cube") {
        let animCube = document.getElementById('animCube');
        if (animCube.value != "Stop the Cube")
            animCube.value = "Stop the Cube";
        else
            animCube.value = "Animate the Cube";
    }
    ;
    if (item != "Default") {
        //console.log("sould run with: "+item)
        item = document.getElementById(item);
        item.classList.toggle('animate');
    }
    ;
};

Polygons.forEach((polygon) => {
    SelectList.innerHTML += `
    <option value="${polygon}">
        ${polygon.slice(0, 1).toUpperCase() + polygon.slice(1)}
    </option>
    `;
});


