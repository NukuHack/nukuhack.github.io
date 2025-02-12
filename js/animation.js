/*
======================
TABLE OF CONTENTS
======================
1. Constants and basic helping values
2. FPS counter
3. Body Classes and Drawings
4. Custom right click menu
5. Populate canvas
6. Ball animations
7. Animation Loop
8. Collision

10. Ball collision helper
11. Triangle collision helper
12. Rectangle collision helper
13. Other Vector stuff
14. Quick distance check
*/




// ======================
// 1. Constants and basic helping values
// ======================

// Get the default stuff made
const customContextMenu = document.getElementById('customContextMenu');
const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth; // Set canvas size to full screen
canvas.height = window.innerHeight*0.8;
let mouseDownTime = 0;
let mouseUpTime = 0;
let paused = false; // Global variable to track pause state

const ctx = canvas.getContext('2d');
let lastTime = performance.now(); // Track the last frame time
let fps = 0; // Store the current FPS

let mouseX = 0; // Mouse tracking for horizontal movement
let active = true;
let isMouseDown = false; // Track whether the mouse button is pressed

// Physics constants
const gravity = 0.1; // Gravity strength
const bounceFactor = 0.8; // Adjust bounce factor (0.8 = 80% energy retained)
let hasFloor = true; // Whether the floor exists
let currentGravity = gravity;





// ======================
// 2. FPS counter
// ======================

function updateFPS() {
    const now = performance.now(); // Get the current time
    const deltaTime = now - lastTime; // Calculate time elapsed since the last frame

    // Avoid division by zero or invalid FPS on the first frame
    if (deltaTime > 0) {
        fps = Math.round(1000 / deltaTime); // Calculate FPS
    }

    lastTime = now; // Update the last frame time
}

function drawFPS() {
    ctx.fillStyle = "white"; // Set the text color
    ctx.font = "16px Arial"; // Set the font size and family
    ctx.fillText(`FPS: ${fps}`, canvas.width/30, canvas.height/15); // Display the FPS in the top-left corner
}






// ======================
// 3. Body Classes and Drawings
// ======================




class GameObjectManager {
    constructor() {
        this.objects = []; // Array to store all game objects
    }

    // Add an object to the manager
    addObject(object) {
        this.objects.push(object);
    }

    // Remove an object from the manager
    removeObject(identifier) {
        this.objects = this.objects.filter(obj => obj.identifier !== identifier);
    }

    // Render all objects
    draw(ctx) {
        this.objects.forEach(obj => {
            if (obj.draw) obj.draw(ctx); // Call the object's draw method if it exists
        });
    }

    drawConditionally(ctx, hasFloor) {
        this.objects.forEach(obj => {
            if (!hasFloor && obj.identifier === "floor") return;
            if (obj.draw) obj.draw(ctx);
        });
    }

    getAllObjects() {
        return this.objects;
    }

    // Get an object by its identifier
    getObjectByIdentifier(identifier) {
        return this.objects.find(obj => obj.identifier === identifier);
    }

    handleCollisionsForObject(targetObject) {
        this.objects.forEach(object => {
            if (object !== targetObject) {
                handleCollision(targetObject, object);
            }
        });
    }
}

class GameObject {
    constructor(x, y, dx, dy, friction, color, identifier) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.friction = friction;
        this.color = color;
        this.identifier = identifier;
    }

    update() {
        // Common update logic (e.g., apply friction, update position)
        this.dx *= (1 - this.friction);
        this.dy *= (1 - this.friction);

        // Apply gravity
        this.dy += currentGravity;

        // Update item's position
        this.x += this.dx;
        this.y += this.dy;
    }
}

class Ball extends GameObject {
    constructor(x, y, radius, dx, dy, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.radius = radius;
        this.type = "ball";
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update() {
        super.update();

        // Bounce off the left and right walls
        if (this.x - this.radius <= 0 || this.x + this.radius >= canvas.width)
            this.dx *= -(1-this.friction); // Reduce horizontal velocity on wall collision
        // Bounce off the ceiling
        else if (this.y - this.radius <= 0)
            this.dy *= -(1-this.friction); // Reduce vertical velocity on ceiling collision
    }
}

class Triangle extends GameObject {
    constructor(x, y, size, dx, dy, rotation, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.size = size;
        this.rotation = rotation;
        this.type = "triangle";

        // Precompute the height of the equilateral triangle
        this.height = (Math.sqrt(3) * 0.5) * this.size;

        // Precompute the vertices in local space (relative to the center)
        this.localVertices = [
            { x: 0, y: -this.height }, // Top vertex
            { x: -this.size, y: this.height}, // Bottom-left vertex
            { x: this.size, y: this.height} // Bottom-right vertex
        ];

        // Initialize the transformed vertices
        this.transformedVertices = this.localVertices.map(v => ({ ...v }));
    }

    // Update the transformed vertices based on rotation and position
    updateVertices() {
        const cosTheta = Math.cos(this.rotation);
        const sinTheta = Math.sin(this.rotation);

        for (let i = 0; i < this.localVertices.length; i++) {
            const local = this.localVertices[i];
            const transformed = this.transformedVertices[i];

            // Apply rotation
            transformed.x = local.x * cosTheta - local.y * sinTheta;
            transformed.y = local.x * sinTheta + local.y * cosTheta;

            // Apply translation
            transformed.x += this.x;
            transformed.y += this.y;
        }
    }

    // Draw the triangle
    draw(ctx) {
        // Update the vertices if the triangle has moved or rotated
        this.updateVertices();

        // Draw the triangle
        ctx.beginPath();
        ctx.moveTo(this.transformedVertices[0].x, this.transformedVertices[0].y);
        ctx.lineTo(this.transformedVertices[1].x, this.transformedVertices[1].y);
        ctx.lineTo(this.transformedVertices[2].x, this.transformedVertices[2].y);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Rectangle extends GameObject {
    constructor(x, y, width, height, dx, dy, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.width = width;
        this.height = height;
        this.type = "rectangle";
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}
//TODO: Put this in an external Json file :)

// Ball objects
const mainBall = new Ball(
    canvas.width * 0.5, // x
    canvas.height * 0.5, // y
    20, // radius
    0, // dx
    0, // dy
    0.01, // friction
    'orange', // color
    'main_ball' // identifier
);

const otherBall = new Ball(
    canvas.width * 0.5 - canvas.width / 4, // x
    canvas.height * 0.5, // y
    60, // radius
    0, // dx
    0, // dy
    0.1, // friction
    'red', // color
    'test_ball' // identifier
);

// Triangle object
const triangleMain = new Triangle(
    canvas.width * 0.5 + canvas.width * 0.25, // x
    canvas.height * 0.5, // y
    60, // size
    0, // dx
    0, // dy
    0, // rotation
    0.1, // friction
    'blue', // color
    'blue_triangle' // identifier
);

// Rectangle object
const floorRect = new Rectangle(
    0, // x
    canvas.height * 0.8, // y
    canvas.width, // width
    100, // height
    0, // dx
    0, // dy
    0.1, // friction
    'green', // color
    'floor' // identifier
);

// Create an instance of GameObjectManager
const gameObjectManager = new GameObjectManager();

// Add your objects to the manager
gameObjectManager.addObject(floorRect);
gameObjectManager.addObject(triangleMain);
gameObjectManager.addObject(mainBall);
gameObjectManager.addObject(otherBall);






// ======================
// 4. Custom right click menu
// ======================


// Function to show the custom context menu
function showCustomContextMenu(event) {
    event.preventDefault(); // Prevent the default context menu
    customContextMenu.style.display = 'block';
    customContextMenu.style.left = `${Math.min(event.pageX, window.innerWidth - customContextMenu.offsetWidth)}px`;
    customContextMenu.style.top = `${Math.min(event.pageY, window.innerHeight - customContextMenu.offsetHeight)}px`;
}

// Function to hide the custom context menu
function hideCustomContextMenu() {
    customContextMenu.style.display = 'none';
}

// Add event listeners for showing/hiding the context menu
document.addEventListener('contextmenu', showCustomContextMenu);
document.addEventListener('click', hideCustomContextMenu);

// Add functionality to menu options using delegation
customContextMenu.addEventListener('click', (event) => {
    if (!event.target.matches('li')) return; // Ensure the click is on a menu item
    event.stopPropagation(); // Stop propagation to avoid triggering other events
    const action = event.target.dataset.action;
    switch (action) {
        case 'reset':
            mainBall.x = canvas.width * 0.5;
            mainBall.y = canvas.height * 0.5;
            mainBall.dx = 0;
            mainBall.dy = 0;
            break;
        case 'toggleFloor':
            hasFloor = !hasFloor;
            event.target.textContent = hasFloor ? "Delete Floor" : "Generate Floor";
            break;
        case 'toggleGravity':
            currentGravity = currentGravity === gravity ? gravity * 0.5 : gravity;
            event.target.textContent = currentGravity === gravity ? "Small Gravity" : "Normal Gravity";
            break;
    }
    hideCustomContextMenu(); // Hide the menu after performing the action
});






// ======================
// 5. Populate canvas
// ======================



// Function to draw the triangle's vertices (for debugging)
function drawTriangleVertices(triangle) {
    const vertices = triangle.transformedVertices;
    ctx.fillStyle = "red";
    vertices.forEach(vertex => {
        ctx.beginPath();
        ctx.arc(vertex.x, vertex.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    });
}

// Resize handler
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight*0.8;
    floorRect.y = canvas.height*0.8;
    floorRect.width = canvas.width;
});
// Function to clear the canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}







// ======================
// 6. Ball animations
// ======================



// Jump and move in the X axes animations
canvas.addEventListener('mousedown', () => {
    if (event.button !== 0) return;
    isMouseDown = true; // Set mouse button state to pressed
    mouseDownTime = Date.now(); // Record the time when the mouse is pressed
});
canvas.addEventListener('mouseup', () => {
    if (event.button !== 0) return;
    isMouseDown = false; // Set mouse button state to released
    mouseUpTime = Date.now(); // Record the time when the mouse is released
    // Calculate the duration of the click
    const clickDuration = mouseUpTime - mouseDownTime;
    // Only trigger the jump if the click duration is less than 0.5 seconds (500 milliseconds)
    if (clickDuration < 100) {
        mainBall.dy = -5; // Apply upward force
    }
});
canvas.addEventListener('mousemove', (event) => {
    if (isMouseDown) { // Only update mouseX if the mouse is pressed
        const rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left; // Calculate mouse X relative to the canvas
    }
});
canvas.addEventListener('mouseleave', () => {
    active = false;
    isMouseDown = false; // Reset mouse button state when leaving the canvas
});
canvas.addEventListener('mouseenter', () => {
    active = true;
});

// Update ball's horizontal position based on mouse movement
function trackMouse() {
    if (active && isMouseDown) { // Only update if the mouse is pressed and active
        mainBall.x = mouseX===0?canvas.getBoundingClientRect().left:mouseX; // Directly set the ball's X position to match the mouse
        mainBall.dx = 0; // Reset horizontal velocity to prevent inertia
    }
}





// ======================
// 7. Animation Loop
// ======================




// Animation loop
function animate() {
    if (!paused) { // Only run the animation if not paused
        updateFPS(); // Update the FPS counter
        clearCanvas();
        mainBall.update(); // Update the main ball's position and velocity
        gameObjectManager.handleCollisionsForObject(mainBall); // Handle collisions

        // Draw objects conditionally
        gameObjectManager.drawConditionally(ctx, hasFloor);

        drawFPS(); // Draw the FPS counter
        trackMouse(); // Track mouse movement
    }
    requestAnimationFrame(animate); // Always request the next frame
}

// Start the animation loop
animate();

// Add event listener for spacebar to toggle pause/resume
document.addEventListener("keydown", (event) => {
    if (event.code === "Space") { // Check if the spacebar is pressed
        paused = !paused; // Toggle the pause state
        console.log(paused ? "Animation paused" : "Animation resumed");
    }
});





// ======================
// 8. Collision
// ======================



// Generalized function to handle collisions
// Generalized function to handle collisions
function handleCollision(ball, object) {
    if (ball === object) return;

    const ballRadius = ball.radius;
    const padding = 50; // Add some padding to avoid unnecessary checks for nearby objects

    // Quick distance check to skip faraway objects
    if (!isWithinDistance(ball, object, ballRadius + padding)) return;

    if (object.type === "rectangle") {
        if (object.identifier === "floor" && !hasFloor) return;

        // Rectangle collision logic
        const closestPoint = getClosestPointOnRectangle(ball, object);

        // Calculate the distance between the ball's center and the closest point
        const distanceX = ball.x - closestPoint.x;
        const distanceY = ball.y - closestPoint.y;
        const distanceSquared = distanceX ** 2 + distanceY ** 2;

        // Check if the distance is less than the ball's radius
        if (distanceSquared < ballRadius ** 2) {
            const normal = getRectangleNormal(ball, object, closestPoint);
            resolveCollision(ball, object, closestPoint, ball.friction, normal);
        }
    } else if (object.type === "triangle") {
        // Use the precomputed transformed vertices from the triangle
        const triangleVertices = object.transformedVertices;

        // Check for collision using the distance-based method
        if (checkBallTriangleCollision(ball, triangleVertices)) {
            // Resolve the collision using the new function
            resolveBallTriangleCollision(ball, triangleVertices);
        }
    } else if (object.type === "ball") {
        // Ball-to-ball collision logic
        if (checkBallBallCollision(ball, object)) {
            resolveBallBallCollision(ball, object);
        }
    }
}

// Function to resolve the collision
function resolveCollision(ball, object, closest, frictionFactor, normal) {
    const ballRadius = ball.radius;

    // Calculate the overlap between the ball and the closest point
    const overlapX = ball.x - closest.x;
    const overlapY = ball.y - closest.y;
    const overlapLength = Math.hypot(overlapX, overlapY);
    const correctionDistance = ballRadius - overlapLength;

    // Correct the ball's position along the normal vector
    ball.x += normal.x * correctionDistance;
    ball.y += normal.y * correctionDistance;

    // Calculate the dot product of the velocity and the collision normal
    const dotProduct = ball.dx * normal.x + ball.dy * normal.y;

    // Reflect the velocity vector based on the collision normal
    ball.dx -= 2 * dotProduct * normal.x * bounceFactor;
    ball.dy -= 2 * dotProduct * normal.y * bounceFactor;

    // Apply friction
    ball.dx *= 1 - frictionFactor;
    ball.dy *= 1 - frictionFactor;
}









// ======================
// 10. Ball collision helper
// ======================



// Function to resolve collision between two balls
function resolveBallBallCollision(ball1, ball2) {
    const normal = getBallBallNormal(ball1, ball2);

    // Calculate relative velocity
    const relativeVelocityX = ball1.dx - ball2.dx;
    const relativeVelocityY = ball1.dy - ball2.dy;

    // Calculate the dot product of the relative velocity and the normal vector
    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

    // If the balls are moving away from each other, no collision response is needed
    if (dotProduct > 0) return;

    // Calculate the impulse (considering masses as 1/radius for simplicity)
    const massFactor1 = 1 / ball1.radius;
    const massFactor2 = 1 / ball2.radius;
    const impulse = (-2 * dotProduct) / (massFactor1 + massFactor2) * 1.5; // Increased impulse strength

    // Apply the impulse to the balls' velocities
    const impulseX = impulse * normal.x;
    const impulseY = impulse * normal.y;

    // Update velocities for both balls
    ball1.dx += impulseX * massFactor1;
    ball1.dy += impulseY * massFactor1;

    // Correct positions to prevent overlap
    const overlap = (ball1.radius + ball2.radius) - Math.hypot(ball1.x - ball2.x, ball1.y - ball2.y);
    if (overlap > 0) {
        const correctionX = normal.x * overlap * 0.5;
        const correctionY = normal.y * overlap * 0.5;

        ball1.x += correctionX;
        ball1.y += correctionY;
    }
}

// Function to check for collision between two balls
function checkBallBallCollision(ball1, ball2) {
    const ax = ball1.x - ball2.x;
    const ay = ball1.y - ball2.y;
    const radiusSum = ball1.radius + ball2.radius;
    const distanceSquared = ax * ax + ay * ay;

    return distanceSquared <= radiusSum * radiusSum; // Use <= to include overlapping cases
}

// Function to calculate the normal vector between two balls
function getBallBallNormal(ball1, ball2) {
    const ax = ball1.x - ball2.x;
    const ay = ball1.y - ball2.y;
    const distanceSquared = ax * ax + ay * ay;

    // Avoid division by zero in case the balls are exactly overlapping
    if (distanceSquared === 0)
        return { x: 1, y: 0 }; // Default normal (arbitrary direction)

    const invDistance = 1 / Math.sqrt(distanceSquared);
    const normal = {
        x: ax * invDistance,
        y: ay * invDistance
    };
    return normal;
}











// ======================
// 11. Triangle collision helper
// ======================





// Function to resolve collision between a ball and a triangle
function resolveBallTriangleCollision(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);

    // Calculate the normal vector (from the closest point to the ball's center)
    const normalX = ball.x - closestPoint.x;
    const normalY = ball.y - closestPoint.y;
    const distance = Math.hypot(normalX, normalY);

    // Normalize the normal vector
    const normal = {
        x: normalX / distance,
        y: normalY / distance
    };

    // Calculate the overlap between the ball and the closest point
    const overlap = ball.radius - distance;

    // If there's an overlap, resolve the collision
    if (overlap > 0) {
        // Correct the ball's position to prevent overlap
        ball.x += normal.x * overlap;
        ball.y += normal.y * overlap;

        // Calculate the relative velocity (for a static triangle, ball's velocity is the relative velocity)
        const relativeVelocityX = ball.dx;
        const relativeVelocityY = ball.dy;

        // Calculate the dot product of the relative velocity and the normal vector
        const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

        // If the ball is moving away, no collision response is needed
        if (dotProduct > 0) return;

        // Calculate the impulse (assuming the triangle is static)
        const impulse = -2 * dotProduct;

        // Apply the impulse to the ball's velocity
        ball.dx += impulse * normal.x;
        ball.dy += impulse * normal.y;
    }
}

// Function to check for collision between the ball and the triangle
function checkBallTriangleCollision(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);

    // Calculate the squared distance between the ball's center and the closest point
    const dx = ball.x - closestPoint.x;
    const dy = ball.y - closestPoint.y;
    const distanceSquared = dx * dx + dy * dy;

    // Check if the distance is less than the ball's squared radius
    return distanceSquared < ball.radius * ball.radius;
}

// Function to find the closest point on the triangle to a given point (ball's center)
function getClosestPointOnTriangle(ball, triangleVertices) {
    let closestPoint = null;
    let minDistanceSquared = Infinity;

    // Check each edge of the triangle
    for (let i = 0; i < 3; i++) {
        const start = triangleVertices[i];
        const end = triangleVertices[(i + 1) % 3];

        // Find the closest point on this edge
        const point = getClosestPointOnLine(ball, start, end);

        // Calculate the squared distance to the ball's center
        const dx = ball.x - point.x;
        const dy = ball.y - point.y;
        const distanceSquared = dx * dx + dy * dy;

        // Update the closest point if this edge is closer
        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = point;
        }
    }

    // Check the triangle's vertices
    for (const vertex of triangleVertices) {
        const dx = ball.x - vertex.x;
        const dy = ball.y - vertex.y;
        const distanceSquared = dx * dx + dy * dy;

        // Update the closest point if this vertex is closer
        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = vertex;
        }
    }

    return closestPoint;
}

// Function to find the closest point on a line segment to a given point
function getClosestPointOnLine(ball, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    // Handle the case where the line segment is degenerate (start and end are the same)
    if (lengthSquared === 0) return start;

    // Project the ball's center onto the line segment
    const t = ((ball.x - start.x) * dx + (ball.y - start.y) * dy) / lengthSquared;
    const tClamped = Math.max(0, Math.min(1, t)); // Clamp t to the line segment

    return {
        x: start.x + tClamped * dx,
        y: start.y + tClamped * dy
    };
}









// ======================
// 12. Rectangle collision helper
// ======================





// Function to calculate the normal vector for a rectangle collision
function getRectangleNormal(ball, rect, closestPoint) {
    const { x: rectX, y: rectY, width, height } = rect;
    const rectRight = rectX + width;
    const rectBottom = rectY + height;

    if (closestPoint.x === rectX) return { x: -1, y: 0 }; // Left edge
    if (closestPoint.x === rectRight) return { x: 1, y: 0 }; // Right edge
    if (closestPoint.y === rectY) return { x: 0, y: -1 }; // Top edge
    if (closestPoint.y === rectBottom) return { x: 0, y: 1 }; // Bottom edge

    return { x: 0, y: 1 }; // Default to bottom edge normal
}
// Only use if the rectangle is rotated by an angle (like 30°)
/*function getRectangleNormal(ball, rect, closestPoint) {
    const epsilon = 0.1; // Small threshold to account for floating-point inaccuracies

    // Destructure rectangle properties for readability
    const { x: rectX, y: rectY, width, height } = rect;
    const rectRight = rectX + width;
    const rectBottom = rectY + height;

    // Check which edge the closest point lies on
    if (Math.abs(closestPoint.x - rectX) < epsilon) {
        return { x: -1, y: 0 }; // Left edge
    } else if (Math.abs(closestPoint.x - rectRight) < epsilon) {
        return { x: 1, y: 0 }; // Right edge
    } else if (Math.abs(closestPoint.y - rectY) < epsilon) {
        return { x: 0, y: -1 }; // Top edge
    } else if (Math.abs(closestPoint.y - rectBottom) < epsilon) {
        return { x: 0, y: 1 }; // Bottom edge
    }

    // Default to bottom edge normal (fallback)
    return { x: 0, y: 1 };
}*/
// Function to find the closest point on a rectangle to a given point (ball's center)
function getClosestPointOnRectangle(ball, rect) {
    const { x: ballX, y: ballY } = ball;
    const { x: rectX, y: rectY, width, height } = rect;
    // Calculate the closest point on the rectangle
    const closestX = Math.max(rectX, Math.min(ballX, rectX + width));
    const closestY = Math.max(rectY, Math.min(ballY, rectY + height));

    return { x: closestX, y: closestY };
}







// ======================
// 13. Other Vector stuff
// ======================










// ======================
// 14. Quick distance check
// ======================



// Helper function to check if the ball is within a certain distance of the object
function isWithinDistance(ball, object, maxDistance) {
    if (object.type === "rectangle" || object.type === "triangle") {
        // Use bounding box for rectangles and triangles
        const objectBounds = getBoundingBox(object);
        const closestX = Math.max(objectBounds.left, Math.min(ball.x, objectBounds.right));
        const closestY = Math.max(objectBounds.top, Math.min(ball.y, objectBounds.bottom));
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        return (distanceX ** 2 + distanceY ** 2) <= maxDistance ** 2;
    } else if (object.type === "ball") {
        // Use center-to-center distance for balls
        const distanceX = ball.x - object.x;
        const distanceY = ball.y - object.y;
        return (distanceX ** 2 + distanceY ** 2) <= maxDistance ** 2;
    }
    return false;
}

// Helper function to get the bounding box of an object
function getBoundingBox(object) {
    if (object.type === "rectangle") {
        return {
            left: object.x,
            right: object.x + object.width,
            top: object.y,
            bottom: object.y + object.height,
        };
    } else if (object.type === "triangle") {
        const vertices = object.transformedVertices;
        const xs = vertices.map(v => v.x);
        const ys = vertices.map(v => v.y);
        return {
            left: Math.min(...xs),
            right: Math.max(...xs),
            top: Math.min(...ys),
            bottom: Math.max(...ys),
        };
    }
    return null;
}


function isBallFarFromTriangle(ball, triangleVertices) {
    const minX = Math.min(...triangleVertices.map(v => v.x));
    const maxX = Math.max(...triangleVertices.map(v => v.x));
    const minY = Math.min(...triangleVertices.map(v => v.y));
    const maxY = Math.max(...triangleVertices.map(v => v.y));

    return (
        ball.x + ball.radius < minX ||
        ball.x - ball.radius > maxX ||
        ball.y + ball.radius < minY ||
        ball.y - ball.radius > maxY
    );
}
function isBallFarFromRectangle(ball, rect) {
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;

    return (
        ball.x + ball.radius < rect.x ||
        ball.x - ball.radius > rectRight ||
        ball.y + ball.radius < rect.y ||
        ball.y - ball.radius > rectBottom
    );
}
