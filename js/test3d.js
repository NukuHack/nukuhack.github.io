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

// Define the Cube constant to store all cube-related variables
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
    rotation: {
        x: 0,
        y: 0,
        z: 0
    }
};

// Define the plate vertices (3D points on the ground plane)
const plate= {
    vertices : [
        [-2, -2, -0.5], [2, -2, -0.5], [2, 2, -0.5], [-2, 2, -0.5]
    ],
    edges : [
        [0, 1], [1, 2], [2, 3], [3, 0]
    ],
};

// Camera position and orientation
const camera = {
    pos : {
        x : 0,
        y : 0,
        z : 0,
    },
    rotation: {
        x : 0,
        y : 0,
        z : 0,
    }
}


// Precompute trigonometric values for performance
function precomputeTrigValues(x, y, z) {
    return {
        sinX: Math.sin(x * Math.PI / 180),
        cosX: Math.cos(x * Math.PI / 180),
        sinY: Math.sin(y * Math.PI / 180),
        cosY: Math.cos(y * Math.PI / 180),
        sinZ: Math.sin(z * Math.PI / 180),
        cosZ: Math.cos(z * Math.PI / 180)
    };
}

// Function to rotate a point using a rotation matrix
function rotatePoint([x, y, z], { sinX, cosX, sinY, cosY, sinZ, cosZ }) {
    // Rotate around X-axis
    const rotatedY = y * cosX - z * sinX;
    const rotatedZ = y * sinX + z * cosX;
    // Rotate around Y-axis
    const rotatedX = x * cosY - rotatedZ * sinY;
    const rotatedZ2 = x * sinY + rotatedZ * cosY;
    // Rotate around Z-axis
    const rotatedX2 = rotatedX * cosZ - rotatedY * sinZ;
    const rotatedY2 = rotatedX * sinZ + rotatedY * cosZ;
    return [rotatedX2, rotatedY2, rotatedZ2];
}

// Function to transform a point into camera space
function transformToCameraSpace([x, y, z]) {
    // Translate the point by subtracting the camera's position
    x -= camera.pos.x;
    y -= camera.pos.y;
    z -= camera.pos.z;
    // Apply the inverse of the camera's rotation
    const invRadX = -camera.rotation.x * Math.PI / 180;
    const invRadY = -camera.rotation.y * Math.PI / 180;
    const invRadZ = -camera.rotation.z * Math.PI / 180;
    const { sinX, cosX, sinY, cosY, sinZ, cosZ } = precomputeTrigValues(invRadX, invRadY, invRadZ);
    // Inverse rotation around Z-axis
    const rotatedX = x * cosZ + y * sinZ;
    const rotatedY = -x * sinZ + y * cosZ;
    // Inverse rotation around Y-axis
    const rotatedX2 = rotatedX * cosY + z * sinY;
    const rotatedZ = -rotatedX * sinY + z * cosY;
    // Inverse rotation around X-axis
    const rotatedY2 = rotatedY * cosX + rotatedZ * sinX;
    const rotatedZ2 = -rotatedY * sinX + rotatedZ * cosX;
    return [rotatedX2, rotatedY2, rotatedZ2];
}

// Function to project a 3D point onto a 2D plane
function project3Dto2D([x, y, z]) {
    const fov = 10; // Field of view
    const scale = 200; // Scale factor
    const zOffset = 10; // Offset to avoid division by zero
    if (z + zOffset === 0) return [0, 0]; // Avoid division by zero
    const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
    const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;
    return [projectedX, projectedY];
}

// Function to draw the cube
function drawCube() {
    const trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);
    const rotatedVertices = cube.vertices.map(vertex => rotatePoint(vertex, trigValues));
    const cameraSpaceVertices = rotatedVertices.map(vertex => transformToCameraSpace(vertex));
    const projectedVertices = cameraSpaceVertices.map(vertex => project3Dto2D(vertex));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [start, end] of cube.edges) {
        const [x1, y1] = projectedVertices[start];
        const [x2, y2] = projectedVertices[end];
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();
}

// Function to draw the plate
function drawPlate() {
    const cameraSpaceVertices = plate.vertices.map(vertex => transformToCameraSpace(vertex));
    const projectedVertices = cameraSpaceVertices.map(vertex => project3Dto2D(vertex));
    ctx.strokeStyle = '#888'; // Use a lighter color for the plate
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [start, end] of plate.edges) {
        const [x1, y1] = projectedVertices[start];
        const [x2, y2] = projectedVertices[end];
        ctx.moveTo(x1, y1); // Correctly start each line
        ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fillStyle = "green";
    ctx.fill();
    ctx.stroke();
}

function rotateCube() {
    // Update rotation angles
    cube.rotation.x += 0.3;
    cube.rotation.y += 0.5;
    cube.rotation.z -= 0.4;
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rotateCube();
    drawPlate();
    drawCube();
    requestAnimationFrame(animate);
}

animate();

// Variables for mouse state and position
let isMouseDown = false; // Flag to check if the mouse button is pressed
let lastMouseX = 0; // Last recorded X position of the mouse
let lastMouseY = 0; // Last recorded Y position of the mouse

// Sensitivity settings
const mouseSensitivity = 4; // Adjust this value for faster/slower mouse rotation
const moveSpeed = 2; // Adjust this value for faster/slower movement

// Event listener for mousedown (start dragging)
canvas.addEventListener('mousedown', (event) => {
    isMouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

// Event listener for mousemove (while dragging)
canvas.addEventListener('mousemove', (event) => {
    if (!isMouseDown) return; // Ignore if the mouse button is not pressed
    const deltaX = event.clientX - lastMouseX; // Horizontal movement
    const deltaY = event.clientY - lastMouseY; // Vertical movement
    // Update camera rotations based on mouse movement
    camera.rotation.y -= deltaX * mouseSensitivity; // Rotate around Y-axis (horizontal movement)
    camera.rotation.x += deltaY * mouseSensitivity; // Rotate around X-axis (vertical movement)
    // Clamp camera.rotation.X to avoid flipping over
    camera.rotation.z = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camera.rotation.z));
    // Update last mouse position
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

// Event listener for mouseup (stop dragging)
canvas.addEventListener('mouseup', () => {
    isMouseDown = false; // Reset the flag when the mouse button is released
});

// Function to calculate the forward vector based on camera rotation
function getForwardVector() {
    const radY = camera.rotation.y * Math.PI / 180; // Convert to radians
    const radX = camera.rotation.x * Math.PI / 180; // Convert to radians
    // Calculate the forward vector
    const forwardX = Math.sin(radY) * Math.cos(radX);
    const forwardY = Math.sin(radX);
    const forwardZ = -Math.cos(radY) * Math.cos(radX);
    return normalizeVector([forwardX, forwardY, forwardZ]);
}

// Function to calculate the right vector based on camera rotation
function getRightVector() {
    const radY = camera.rotation.y * Math.PI / 180; // Convert to radians
    // Calculate the right vector (perpendicular to the forward vector)
    const rightX = Math.sin(radY + Math.PI / 2);
    const rightZ = -Math.cos(radY + Math.PI / 2);
    return normalizeVector([rightX, 0, rightZ]);
}

// Normalize a 3D vector
function normalizeVector(vector) {
    const length = Math.sqrt(vector[0] ** 2 + vector[1] ** 2 + vector[2] ** 2);
    if (length === 0) return [0, 0, 0];
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

// Event listener for keydown (key press)
window.addEventListener('keydown', (event) => {
    const moveSpeedFactor = moveSpeed * 0.5; // Speed multiplier
    if (event.key === 'w' || event.key === 'W') {
        // Move forward
        const forwardVector = getForwardVector();
        camera.pos.x += forwardVector[0] * moveSpeedFactor;
        camera.pos.y += forwardVector[1] * moveSpeedFactor;
        camera.pos.z += forwardVector[2] * moveSpeedFactor;
    }
    if (event.key === 's' || event.key === 'S') {
        // Move backward
        const forwardVector = getForwardVector();
        camera.pos.x -= forwardVector[0] * moveSpeedFactor;
        camera.pos.y -= forwardVector[1] * moveSpeedFactor;
        camera.pos.z -= forwardVector[2] * moveSpeedFactor;
    }
    if (event.key === 'a' || event.key === 'A') {
        // Move left
        const rightVector = getRightVector();
        camera.pos.x -= rightVector[0] * moveSpeedFactor;
        camera.pos.z -= rightVector[2] * moveSpeedFactor;
    }
    if (event.key === 'd' || event.key === 'D') {
        // Move right
        const rightVector = getRightVector();
        camera.pos.x += rightVector[0] * moveSpeedFactor;
        camera.pos.z += rightVector[2] * moveSpeedFactor;
    }
    if (event.key === 'q' || event.key === 'Q') {
        // Move up
        camera.pos.y += moveSpeedFactor;
    }
    if (event.key === 'e' || event.key === 'E') {
        // Move down
        camera.pos.y -= moveSpeedFactor;
    }
});