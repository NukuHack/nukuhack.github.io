// Get the canvas and its context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions dynamically based on the window size
function resizeCanvas() {
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.8;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Define constants and objects
const cube = {
    vertices: [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ],
    edges: [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ],
    rotation: { x: 0, y: 0, z: 0 }
};

const plate = {
    vertices: [
        [-2, -2, -0.5], [2, -2, -0.5], [2, 2, -0.5], [-2, 2, -0.5]
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0]]
};

const camera = {
    pos: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    trigValues: precomputeTrigValues(0, 0, 0)
};

// Precompute trigonometric values for performance
function precomputeTrigValues(x, y, z) {
    const radX = x * Math.PI / 180, radY = y * Math.PI / 180, radZ = z * Math.PI / 180;
    return {
        sinX: Math.sin(radX), cosX: Math.cos(radX),
        sinY: Math.sin(radY), cosY: Math.cos(radY),
        sinZ: Math.sin(radZ), cosZ: Math.cos(radZ)
    };
}

// Rotate a point using a rotation matrix
function rotatePoint([x, y, z], { sinX, cosX, sinY, cosY, sinZ, cosZ }) {
    const rotatedY = y * cosX - z * sinX;
    const rotatedZ = y * sinX + z * cosX;
    const rotatedX = x * cosY - rotatedZ * sinY;
    const rotatedZ2 = x * sinY + rotatedZ * cosY;
    const rotatedX2 = rotatedX * cosZ - rotatedY * sinZ;
    const rotatedY2 = rotatedX * sinZ + rotatedY * cosZ;
    return [rotatedX2, rotatedY2, rotatedZ2];
}

// Transform a point into camera space
function transformToCameraSpace([x, y, z]) {
    const { pos, trigValues } = camera;
    x -= pos.x; y -= pos.y; z -= pos.z;
    const { sinX, cosX, sinY, cosY, sinZ, cosZ } = trigValues;
    const rotatedX = x * cosZ + y * sinZ;
    const rotatedY = -x * sinZ + y * cosZ;
    const rotatedX2 = rotatedX * cosY + z * sinY;
    const rotatedZ = -rotatedX * sinY + z * cosY;
    const rotatedY2 = rotatedY * cosX + rotatedZ * sinX;
    const rotatedZ2 = -rotatedY * sinX + rotatedZ * cosX;
    return [rotatedX2, rotatedY2, rotatedZ2];
}

// Project a 3D point onto a 2D plane
function project3Dto2D([x, y, z]) {
    const fov = 10, scale = 200, zOffset = 10;
    if (z + zOffset === 0) return [0, 0];
    const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
    const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;
    return [projectedX, projectedY];
}

// Rotate the cube
function rotateCube() {
    cube.rotation.x += 0.3;
    cube.rotation.y += 0.5;
    cube.rotation.z -= 0.4;
}

// Draw an object (cube or plate)
function drawObject(object, style = { strokeStyle: '#fff', lineWidth: 2 }, applyRotation = true) {
    const { vertices, edges } = object;
    let rotatedVertices;

    if (applyRotation) {
        // Apply rotation for objects that should rotate (e.g., cube)
        const trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);
        rotatedVertices = vertices.map(vertex => rotatePoint(vertex, trigValues));
    } else {
        // Skip rotation for objects that should not rotate (e.g., plate)
        rotatedVertices = vertices;
    }

    // Transform vertices into camera space
    const cameraSpaceVertices = rotatedVertices.map(transformToCameraSpace);

    // Project vertices onto the 2D plane
    const projectedVertices = cameraSpaceVertices.map(project3Dto2D);

    // Draw the object
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = style.lineWidth;
    ctx.beginPath();
    for (const [start, end] of edges) {
        const [x1, y1] = projectedVertices[start];
        const [x2, y2] = projectedVertices[end];
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Fill the plate if needed
    if (object === plate) {
        ctx.closePath();
        ctx.fillStyle = "green";
        ctx.fill();
    }
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rotateCube();

    // Draw the plate without applying rotation
    drawObject(plate, { strokeStyle: '#888', lineWidth: 1 }, false);

    // Draw the cube with rotation applied
    drawObject(cube);
    requestAnimationFrame(animate);
}
animate();

// Mouse interaction
let isMouseDown = false, lastMouseX = 0, lastMouseY = 0;
canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});
canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const deltaX = e.clientX - lastMouseX, deltaY = e.clientY - lastMouseY;
    camera.rotation.y -= deltaX * 4;
    camera.rotation.x += deltaY * 4;
    camera.trigValues = precomputeTrigValues(-camera.rotation.x, -camera.rotation.y, -camera.rotation.z);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});
canvas.addEventListener('mouseup', () => isMouseDown = false);
// Touch interaction
let isTouching = false, lastTouchX = 0, lastTouchY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    isTouching = true;
    const touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    if (!isTouching) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastTouchX, deltaY = touch.clientY - lastTouchY;
    camera.rotation.y -= deltaX * 4; // Rotate around Y-axis
    camera.rotation.x += deltaY * 4; // Rotate around X-axis
    camera.trigValues = precomputeTrigValues(-camera.rotation.x, -camera.rotation.y, -camera.rotation.z);
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
});

canvas.addEventListener('touchend', () => {
    isTouching = false;
});


// Define movement speed
const moveSpeed = 0.5;

// Function to move the camera forward
function moveForward() {
    const forward = getForwardVector();
    moveCamera(forward, moveSpeed);
}

// Function to move the camera backward
function moveBackward() {
    const forward = getForwardVector();
    moveCamera(forward, -moveSpeed);
}

// Function to move the camera left
function moveLeft() {
    const right = getRightVector();
    moveCamera(right, -moveSpeed);
}

// Function to move the camera right
function moveRight() {
    const right = getRightVector();
    moveCamera(right, moveSpeed);
}

// Function to move the camera up
function moveUpp() {
    camera.pos.y -= moveSpeed;
}

// Function to move the camera down
function moveDown() {
    camera.pos.y += moveSpeed;
}

// Attach event listeners to the buttons
document.getElementById('w-button').addEventListener('click', moveBackward);
document.getElementById('s-button').addEventListener('click', moveForward);
document.getElementById('a-button').addEventListener('click', moveLeft);
document.getElementById('d-button').addEventListener('click', moveRight);
document.getElementById('upp-button').addEventListener('click', moveUpp);
document.getElementById('down-button').addEventListener('click', moveDown);

// Stop movement when the button is released
['w-button', 's-button', 'a-button', 'd-button'].forEach(id => {
    document.getElementById(id).addEventListener('touchend', () => {
        // No action needed here since movement is only triggered on touchstart
    });
});

// Move the camera
function moveCamera(vector, factor) {
    camera.pos.x += vector[0] * factor;
    camera.pos.y += vector[1] * factor;
    camera.pos.z += vector[2] * factor;
}

// Get forward and right vectors
function getForwardVector() {
    const radY = camera.rotation.y * Math.PI / 180, radX = camera.rotation.x * Math.PI / 180;
    return normalizeVector([
        Math.sin(radY) * Math.cos(radX),
        Math.sin(radX),
        -Math.cos(radY) * Math.cos(radX)
    ]);
}

function getRightVector() {
    const radY = camera.rotation.y * Math.PI / 180;
    return normalizeVector([Math.sin(radY + Math.PI / 2), 0, -Math.cos(radY + Math.PI / 2)]);
}

function normalizeVector([x, y, z]) {
    const length = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    return length ? [x / length, y / length, z / length] : [0, 0, 0];
}

// Keyboard interaction (unchanged)
window.addEventListener('keydown', (e) => {
    const forward = getForwardVector(), right = getRightVector();
    if (['w', 'W'].includes(e.key)) moveCamera(forward, -moveSpeed);
    if (['s', 'S'].includes(e.key)) moveCamera(forward, moveSpeed);
    if (['a', 'A'].includes(e.key)) moveCamera(right, -moveSpeed);
    if (['d', 'D'].includes(e.key)) moveCamera(right, moveSpeed);
    if (['q', 'Q'].includes(e.key)) moveDown();
    if (['e', 'E'].includes(e.key)) moveUpp();
});