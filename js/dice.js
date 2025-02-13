
// Get the canvas and its context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = window.innerWidth * 0.5;
canvas.height = window.innerHeight * 0.5;

// Define the cube vertices (3D points)
const cubeVertices = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
];

// Define the cube edges (connections between vertices)
const cubeEdges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
];

// Rotation angles
let angleX = 0;
let angleY = 0;
let angleZ = 0;

function rotatePoint([x, y, z], angleX, angleY, angleZ) {
    // Rotate around X-axis
    const rotatedY = y * Math.cos(angleX) - z * Math.sin(angleX);
    const rotatedZ = y * Math.sin(angleX) + z * Math.cos(angleX);
    y = rotatedY;
    z = rotatedZ;

    // Rotate around Y-axis
    const rotatedX = x * Math.cos(angleY) - z * Math.sin(angleY);
    z = x * Math.sin(angleY) + z * Math.cos(angleY);
    x = rotatedX;

    // Rotate around Z-axis
    const rotatedX2 = x * Math.cos(angleZ) - y * Math.sin(angleZ);
    y = x * Math.sin(angleZ) + y * Math.cos(angleZ);
    x = rotatedX2;

    return [x, y, z];
}

function project3Dto2D([x, y, z]) {
    // Perspective projection
    const fov = 5; // Field of view
    const scale = 200; // Scale factor
    const zOffset = 5; // Offset to avoid division by zero
    const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
    const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;
    return [projectedX, projectedY];
}

function drawCube() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rotatedVertices = cubeVertices.map(vertex => rotatePoint(vertex, angleX, angleY, angleZ));
    const projectedVertices = rotatedVertices.map(vertex => project3Dto2D(vertex));

    // Draw edges
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [start, end] of cubeEdges) {
        const [x1, y1] = projectedVertices[start];
        const [x2, y2] = projectedVertices[end];
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Update rotation angles
    angleX += 0.01;
    angleY += 0.02;
    angleZ += 0.01;
}

function animate2() {
    drawCube();
    requestAnimationFrame(animate2);
}

animate2();