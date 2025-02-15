// Get the canvas and its context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions dynamically based on the window size
function resizeCanvas() {
	canvas.width = window.innerWidth * 0.4;
	canvas.height = window.innerHeight * 0.4;
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
function drawCube(number) {
	const trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);
	const rotatedVertices = cube.vertices.map(vertex => rotatePoint(vertex, trigValues));
	const projectedVertices = rotatedVertices.map(vertex => project3Dto2D(vertex));

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

	// Determine the visible face and draw dots
	const visibleFace = getVisibleFace(cube.rotation.x, cube.rotation.y);
	if (visibleFace !== null) {
		drawDiceDots(number, visibleFace, projectedVertices);
	}
}

// Function to determine the visible face based on rotation angles
function getVisibleFace(rotX, rotY) {
	const radX = (rotX % 360 + 360) % 360;
	const radY = (rotY % 360 + 360) % 360;

	if (radX > 45 && radX < 135) return 'top';
	if (radX > 225 && radX < 315) return 'bottom';
	if (radY > 45 && radY < 135) return 'right';
	if (radY > 225 && radY < 315) return 'left';
	return 'front';
}

// Function to draw dots on the visible face
// Function to draw dots on the visible face
function drawDiceDots(number, face, projectedVertices) {
	const dotSize = 5;

	// Define the vertices for each face in 3D space
	const faceVertices = {
		front: [0, 1, 2, 3], // Front face indices
		back: [4, 5, 6, 7],  // Back face indices
		top: [0, 1, 5, 4],   // Top face indices
		bottom: [2, 3, 7, 6], // Bottom face indices
		left: [0, 3, 7, 4],  // Left face indices
		right: [1, 2, 6, 5]  // Right face indices
	};

	// Get the 3D vertices of the visible face
	const faceIndices = faceVertices[face];
	const facePoints = faceIndices.map(i => cube.vertices[i]);

	// Calculate the center of the face in 3D space
	const centerX3D = (facePoints[0][0] + facePoints[2][0]) / 2;
	const centerY3D = (facePoints[0][1] + facePoints[2][1]) / 2;
	const centerZ3D = (facePoints[0][2] + facePoints[2][2]) / 2;

	// Calculate the width and height of the face in 3D space
	const width3D = Math.abs(facePoints[1][0] - facePoints[0][0]);
	const height3D = Math.abs(facePoints[2][1] - facePoints[0][1]);

	// Define dot positions relative to the face's center in 3D space
	const dotPositions = [];
	switch (number) {
		case 1:
			dotPositions.push([0, 0]);
			break;
		case 2:
			dotPositions.push([-width3D / 3, -height3D / 3]);
			dotPositions.push([width3D / 3, height3D / 3]);
			break;
		case 3:
			dotPositions.push([-width3D / 3, -height3D / 3]);
			dotPositions.push([0, 0]);
			dotPositions.push([width3D / 3, height3D / 3]);
			break;
		case 4:
			dotPositions.push([-width3D / 3, -height3D / 3]);
			dotPositions.push([-width3D / 3, height3D / 3]);
			dotPositions.push([width3D / 3, -height3D / 3]);
			dotPositions.push([width3D / 3, height3D / 3]);
			break;
		case 5:
			dotPositions.push([-width3D / 3, -height3D / 3]);
			dotPositions.push([-width3D / 3, height3D / 3]);
			dotPositions.push([width3D / 3, -height3D / 3]);
			dotPositions.push([width3D / 3, height3D / 3]);
			dotPositions.push([0, 0]);
			break;
		case 6:
			dotPositions.push([-width3D / 3, -height3D / 3]);
			dotPositions.push([-width3D / 3, 0]);
			dotPositions.push([-width3D / 3, height3D / 3]);
			dotPositions.push([width3D / 3, -height3D / 3]);
			dotPositions.push([width3D / 3, 0]);
			dotPositions.push([width3D / 3, height3D / 3]);
			break;
	}

	// Rotate and project the dots
	const trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);
	ctx.fillStyle = 'black';
	for (const [xOffset, yOffset] of dotPositions) {
		// Calculate the 3D position of the dot
		const dotX3D = centerX3D + xOffset;
		const dotY3D = centerY3D + yOffset;
		// Rotate the dot
		const rotatedDot = rotatePoint([dotX3D, dotY3D, centerZ3D], trigValues);

		// Project the dot onto the 2D plane
		const [projectedX, projectedY] = project3Dto2D(rotatedDot);

		// Draw the dot
		ctx.beginPath();
		ctx.arc(projectedX, projectedY, dotSize, 0, Math.PI * 2);
		ctx.fill();
		ctx.closePath();
	}
}

// Function to animate the dice roll
let isRolling = false;
function rollDice() {
	if (isRolling) return;
	isRolling = true;

	let startTime = Date.now();
	const duration = Math.random() * 1500 + 1000;

	function animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const elapsedTime = Date.now() - startTime;
		if (elapsedTime < duration) {
			cube.rotation.x += Math.random() * 20 - 10;
			cube.rotation.y += Math.random() * 20 - 10;
			cube.rotation.z += Math.random() * 20 - 10;
			drawCube(Math.floor(Math.random() * 6) + 1);
			requestAnimationFrame(animate);
		} else {
			const finalNumber = Math.floor(Math.random() * 6) + 1;
			cube.rotation.x = 0;
			cube.rotation.y = 0;
			cube.rotation.z = 0;
			drawCube(finalNumber);
			isRolling = false;
		}
	}
	animate();
}

// Initial draw
drawCube(1);

// Add event listener to the roll button
document.getElementById('rollButton').addEventListener('click', rollDice);