// Get the canvas and its context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions dynamically based on the window size
function resizeCanvas() {
	const scaleFactor = 0.4; // Scale factor for canvas dimensions
	canvas.width = window.innerWidth * scaleFactor;
	canvas.height = window.innerHeight * scaleFactor;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Define the Cube constant to store all cube-related variables
const cube = {
	vertices: [
		[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
		[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
	],
	faces: [
		{ indices: [0, 1, 2, 3], color: '#FF5733', number: 1 }, // Front face (1 dot) - Color: Red
		{ indices: [4, 5, 6, 7], color: '#33FFF3', number: 6 }, // Back face (6 dots) - Color: Cyan
		{ indices: [0, 1, 5, 4], color: '#33FF57', number: 5 }, // Top face (5 dots) - Color: Green
		{ indices: [2, 3, 7, 6], color: '#F3FF33', number: 2 }, // Bottom face (2 dots) - Color: Yellow
		{ indices: [0, 3, 7, 4], color: '#FF33F3', number: 4 }, // Left face (4 dots) - Color: Magenta
		{ indices: [1, 2, 6, 5], color: '#3357FF', number: 3 }  // Right face (3 dots) - Color: Blue
	],
	rotation: { x: 0, y: 0, z: 0 },
	lastRoll: { rotation: { x: 0, y: 0, z: 0 }, number: 1 }
};

// Precompute trigonometric values for performance
let trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);

function precomputeTrigValues(x, y, z) {
	return {
		sinX: Math.sin((x % 360) * Math.PI / 180),
		cosX: Math.cos((x % 360) * Math.PI / 180),
		sinY: Math.sin((y % 360) * Math.PI / 180),
		cosY: Math.cos((y % 360) * Math.PI / 180),
		sinZ: Math.sin((z % 360) * Math.PI / 180),
		cosZ: Math.cos((z % 360) * Math.PI / 180)
	};
}

// Function to rotate a point using a rotation matrix
function rotatePoint([x, y, z], { sinX, cosX, sinY, cosY, sinZ, cosZ }) {
	const rotatedY = y * cosX - z * sinX;
	const rotatedZ = y * sinX + z * cosX;

	const rotatedX = x * cosY - rotatedZ * sinY;
	const rotatedZ2 = x * sinY + rotatedZ * cosY;

	const rotatedX2 = rotatedX * cosZ - rotatedY * sinZ;
	const rotatedY2 = rotatedX * sinZ + rotatedY * cosZ;

	return [rotatedX2, rotatedY2, rotatedZ2];
}

// Function to project a 3D point onto a 2D plane
function project3Dto2D([x, y, z]) {
	const fov = 10; // Field of view
	const scale = 200; // Scale factor
	const zOffset = 10; // Offset to avoid division by zero

	if (Math.abs(z + zOffset) < 0.001) return [canvas.width / 2, canvas.height / 2]; // Avoid division by zero
	const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
	const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;

	return [projectedX, projectedY];
}

// Function to determine if a face is visible (not perpendicular to the camera)
function isFaceVisible(faceNormal, trigValues) {
	const normal = rotatePoint(faceNormal, trigValues);
	return Math.abs(normal[2]) > 0.1; // Face is visible if not perfectly perpendicular
}

// Function to compute the normal vector for a face
function getFaceNormal(faceIndex) {
	const v1 = cube.vertices[cube.faces[faceIndex].indices[0]];
	const v2 = cube.vertices[cube.faces[faceIndex].indices[1]];
	const v3 = cube.vertices[cube.faces[faceIndex].indices[2]];

	const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
	const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

	return [
		edge1[1] * edge2[2] - edge1[2] * edge2[1],
		edge1[2] * edge2[0] - edge1[0] * edge2[2],
		edge1[0] * edge2[1] - edge1[1] * edge2[0]
	];
}

// Function to draw the cube with filled faces and dots on visible sides
function drawCube() {
	trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);

	const rotatedVertices = cube.vertices.map(vertex => rotatePoint(vertex, trigValues));
	const projectedVertices = rotatedVertices.map(vertex => project3Dto2D(vertex));

	const faceData = cube.faces.map((face, index) => {
		const faceNormal = getFaceNormal(index); // Compute the normal vector for the face
		const isVisible = isFaceVisible(faceNormal, trigValues);

		const zValues = face.indices.map(i => rotatedVertices[i][2]);
		const avgZ = zValues.reduce((sum, z) => sum + z, 0) / zValues.length;

		return { face, avgZ, isVisible };
	});

	// Sort faces by average Z-coordinate (farthest to nearest)
	faceData.sort((a, b) => b.avgZ - a.avgZ);

	ctx.lineWidth = 2;

	// Draw filled faces
	for (const { face, avgZ, isVisible } of faceData) {
		if (!isVisible) continue; // Skip invisible faces

		const facePoints = face.indices.map(i => projectedVertices[i]);

		ctx.fillStyle = face.color;
		ctx.beginPath();
		ctx.moveTo(facePoints[0][0], facePoints[0][1]);
		facePoints.forEach(([x, y]) => ctx.lineTo(x, y));
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		// Draw dots for this face
		drawDiceDots(face.number, face.indices, rotatedVertices, projectedVertices);
	}
}

// Function to draw dots on a specific face of a dice
function drawDiceDots(number, faceIndices, rotatedVertices, projectedVertices, dotSize = 5) {
	// Helper function to calculate the center of a face in 3D space
	function calculateFaceCenter(facePoints) {
		const centerX = facePoints.reduce((sum, [x]) => sum + x, 0) / facePoints.length;
		const centerY = facePoints.reduce((sum, [, y]) => sum + y, 0) / facePoints.length;
		const centerZ = facePoints.reduce((sum, [, , z]) => sum + z, 0) / facePoints.length;
		return [centerX, centerY, centerZ];
	}

	// Helper function to calculate the width and height of a face in 3D space
	function calculateFaceDimensions(facePoints) {
		const width = Math.max(...facePoints.map(p => p[0])) - Math.min(...facePoints.map(p => p[0]));
		const height = Math.max(...facePoints.map(p => p[1])) - Math.min(...facePoints.map(p => p[1]));
		return { width, height };
	}

	// Get the rotated points of the face
	const facePoints = faceIndices.map(i => rotatedVertices[i]);

	// Calculate the center and dimensions of the face
	const [centerX3D, centerY3D, centerZ3D] = calculateFaceCenter(facePoints);
	const { width: width3D, height: height3D } = calculateFaceDimensions(facePoints);

	// Normalize the width and height to avoid distortion
	const normalizedWidth = width3D / 2;
	const normalizedHeight = height3D / 2;

	// Get the dot positions relative to the face center
	const dotPositions3D = getDotPositions(number, normalizedWidth, normalizedHeight);

	// Draw each dot
	ctx.fillStyle = 'black';
	for (const [xOffset, yOffset, zOffset] of dotPositions3D) {
		// Calculate the 3D position of the dot
		const dotX3D = centerX3D + xOffset;
		const dotY3D = centerY3D + yOffset;
		const dotZ3D = centerZ3D + zOffset;

		// Project the dot position onto the 2D canvas
		const [dotX2D, dotY2D] = project3Dto2D([dotX3D, dotY3D, dotZ3D]);

		// Draw the dot
		ctx.beginPath();
		ctx.arc(dotX2D, dotY2D, dotSize, 0, Math.PI * 2);
		ctx.fill();
		ctx.closePath();
	}
}

// Function to generate dot positions based on the number
function getDotPositions(number, normalizedWidth, normalizedHeight) {
	const dotMap = {
		1: [[0, 0, 0]], // Center
		2: [
			[-normalizedWidth / 2, -normalizedHeight / 2, 0], // Top-left
			[normalizedWidth / 2, normalizedHeight / 2, 0]    // Bottom-right
		],
		3: [
			[-normalizedWidth / 2, -normalizedHeight / 2, 0], // Top-left
			[0, 0, 0],                                        // Center
			[normalizedWidth / 2, normalizedHeight / 2, 0]    // Bottom-right
		],
		4: [
			[-normalizedWidth / 2, -normalizedHeight / 2, 0], // Top-left
			[-normalizedWidth / 2, normalizedHeight / 2, 0],  // Bottom-left
			[normalizedWidth / 2, -normalizedHeight / 2, 0],  // Top-right
			[normalizedWidth / 2, normalizedHeight / 2, 0]    // Bottom-right
		],
		5: [
			[-normalizedWidth / 2, -normalizedHeight / 2, 0], // Top-left
			[-normalizedWidth / 2, normalizedHeight / 2, 0],  // Bottom-left
			[normalizedWidth / 2, -normalizedHeight / 2, 0],  // Top-right
			[normalizedWidth / 2, normalizedHeight / 2, 0],   // Bottom-right
			[0, 0, 0]                                         // Center
		],
		6: [
			[-normalizedWidth / 2, -normalizedHeight / 3, 0], // Middle-left-top
			[-normalizedWidth / 2, 0, 0],                    // Middle-left-center
			[-normalizedWidth / 2, normalizedHeight / 3, 0], // Middle-left-bottom
			[normalizedWidth / 2, -normalizedHeight / 3, 0], // Middle-right-top
			[normalizedWidth / 2, 0, 0],                     // Middle-right-center
			[normalizedWidth / 2, normalizedHeight / 3, 0]   // Middle-right-bottom
		]
	};

	return dotMap[number] || [];
}

let isRolling = false;

function rollDice() {
	if (isRolling) return;
	isRolling = true;

	const startTime = Date.now();
	const duration = Math.random() * 1500 + 1000; // Random duration between 1000ms and 2500ms

	// Generate random target rotations
	const targetRotationX = genRandom();
	const targetRotationY = genRandom();
	const targetRotationZ = genRandom();

	function genRandom(){
		return Math.random() * 360 * 2 - 360;
	}

	let currentRotationX = cube.rotation.x;
	let currentRotationY = cube.rotation.y;
	let currentRotationZ = cube.rotation.z;

	function animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const elapsedTime = Date.now() - startTime;
		const progress = Math.min(elapsedTime / duration, 1); // Clamp progress between 0 and 1

		// Apply quadratic easing for smooth deceleration
		const easedProgress = progress * (2 - progress);

		// Update the current rotation based on the target and progress
		cube.rotation.x = currentRotationX + (targetRotationX - currentRotationX) * easedProgress;
		cube.rotation.y = currentRotationY + (targetRotationY - currentRotationY) * easedProgress;
		cube.rotation.z = currentRotationZ + (targetRotationZ - currentRotationZ) * easedProgress;

		// Redraw the cube with the updated rotation
		drawCube();

		// Stop the animation when complete
		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			// Snap to the nearest 90-degree increment
			cube.rotation.x = Math.round(cube.rotation.x / 90) * 90;
			cube.rotation.y = Math.round(cube.rotation.y / 90) * 90;
			cube.rotation.z = Math.round(cube.rotation.z / 90) * 90;

			drawCube();
			isRolling = false;
		}
	}

	animate();
}

// Initial draw
drawCube();

// Add event listener to the roll button
document.getElementById('rollButton').addEventListener('click', rollDice);