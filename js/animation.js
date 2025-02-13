/*
======================
TABLE OF CONTENTS
======================
1. Constants and basic helping values
2. FPS counter
3. Body Classes and Drawings
4. Custom right click menu
5. Populate canvas
6. Ball movement
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
let isDragging= false;

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

    // Apply friction to velocity
    applyFriction() {
        this.dx *= 1 - this.friction;
        this.dy *= 1 - this.friction;
    }

    // Apply gravity to vertical velocity
    applyGravity() {
        this.dy += currentGravity;
    }

    // Update position based on velocity
    updatePosition() {
        this.updatePosX();
        this.updatePosY();
    }
    updatePosX() {
        this.x += this.dx;
    }
    updatePosY() {
        this.y += this.dy;
    }

    // Default update method that calls all sub-methods
    update() {
        this.applyFriction();
        this.applyGravity();
        this.updatePosition();
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
        // Update ball position if not being dragged
        // Suppress or conditionally execute parts of the update logic
        if (!isDragging&&this.identifier==="main_ball")
            this.updatePosX();

        this.updatePosY();
        this.applyFriction();
        this.applyGravity();

        this.handleEdgeCollision()

    }
    // Handle collisions with walls, ceiling, and bottom
    handleEdgeCollision() {
        const radius = this.radius;

        this.wallCollision(radius)
        //this.floorCollision(radius)
        this.ceilingCollision(radius)
    }
    wallCollision(radius){
        // Bounce off the left and right walls
        if (this.x - radius <= 0) {
            this.dx = -(Math.abs(this.dx) * (1 - this.friction) * bounceFactor); // Reverse direction and reduce speed

            // Optionally, stop the ball from sinking over the walls
            this.x = 0 + radius;
        } else if (this.x + radius >= canvas.width) {
            this.dx = -(Math.abs(this.dx) * (1 - this.friction) * bounceFactor); // Reverse direction and reduce speed

            // Optionally, stop the ball from sinking over the walls
            this.x = canvas.width - radius;
        }
    }
    floorCollision(radius){
        // Bounce off the bottom of the canvas
        if (this.y + radius >= canvas.height) {
            this.dy = -(Math.abs(this.dy) * (1 - this.friction) * bounceFactor); // Reduce speed and reverse direction

            // Optionally, stop the ball from sinking below the bottom edge
            this.y = canvas.height - radius;
        }
    }
    ceilingCollision(radius){
        // Bounce off the ceiling
        if (this.y - radius <= 0) {
            this.dy = Math.abs(this.dy) * (1 - this.friction) * bounceFactor; // Reduce speed and reverse direction

            // Optionally, stop the ball from sinking below the bottom edge
            this.y = 0 + radius;
        }
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

const testBall = new Ball(
    canvas.width * 0.3, // x
    canvas.height * 0.5, // y
    50, // radius
    0, // dx
    0, // dy
    0.1, // friction
    'red', // color
    'test_ball' // identifier
);

// Triangle object
const testTriangle = new Triangle(
    canvas.width * 0.9, // x
    canvas.height * 0.55, // y
    60, // size
    0, // dx
    0, // dy
    0, // rotation
    0.1, // friction
    'blue', // color
    'blue_triangle' // identifier
);
const rotatedTriangle = new Triangle(
    canvas.width * 0.68, // x
    canvas.height * 0.5, // y
    60, // size
    0, // dx
    0, // dy
    1.05, // rotation
    0.1, // friction
    'black', // color
    'black_triangle' // identifier
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

const testRect = new Rectangle(
    canvas.width*0.45, // x
    canvas.height * 0.6, // y
    canvas.width/10, // width
    50, // height
    0, // dx
    0, // dy
    0.1, // friction
    'grey', // color
    'test_rectangle' // identifier
);

// Create an instance of GameObjectManager
const gameObjectManager = new GameObjectManager();

// Add your objects to the manager
gameObjectManager.addObject(floorRect);
gameObjectManager.addObject(testTriangle);
gameObjectManager.addObject(rotatedTriangle);
gameObjectManager.addObject(mainBall);
gameObjectManager.addObject(testBall);
gameObjectManager.addObject(testRect);






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

function drawPausedText(ctx, canvas) {
    // Set text properties
    ctx.fillStyle = "white"; // Text color
    ctx.strokeStyle = "black"; // Optional: Add an outline for better visibility
    ctx.lineWidth = 2; // Thickness of the outline
    ctx.font = `${Math.min(canvas.width / 10, 48)}px Arial`; // Responsive font size
    ctx.textAlign = "center"; // Center-align the text horizontally
    ctx.textBaseline = "middle"; // Center-align the text vertically
    // Draw the text with an outline (optional)
    const text = "Paused";
    const x = canvas.width * 0.5; // Center horizontally
    const y = canvas.height * 0.5; // Center vertically

    // Stroke the text (outline)
    ctx.strokeText(text, x, y);
    // Fill the text (color)
    ctx.fillText(text, x, y);
}






// ======================
// 6. Ball movement
// ======================




// Function to handle both mouse and touch events
function handleScreenEvent(event, type, ball) {
    const { clientX, clientY } = getEventCoordinates(event);
    const rect = canvas.getBoundingClientRect();

    // logic
    if (type === 'touchstart' || type === 'mousedown' && event.button === 0) {
        isDragging = true;
        mouseDownTime = Date.now(); // Record the time when the mouse is pressed
    } else if (isDragging&&(type === 'touchmove' || type === 'mousemove')) {
        ball.x = clientX - rect.left; // Update ball position
        ball.dx = 0; // Reset velocity while dragging
    } else if (type === 'touchend' || type === 'mouseup' && event.button === 0) {
        isDragging = false;
        // Check for jump condition on mouse/touch release
        const clickDuration = Date.now() - mouseDownTime;
        //console.log(clickDuration);
        if (clickDuration < 100)
            mainBall.dy = -5; // Apply upward force for jumping
    }
}

// Helper function to extract coordinates from mouse or touch events
function getEventCoordinates(event) {
    return event.touches && event.touches.length > 0
        ? { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY }
        : { clientX: event.clientX, clientY: event.clientY };
}

// Add event listeners for mouse and touch
['mousedown', 'mousemove', 'mouseup'].forEach((eventType) => {
    canvas.addEventListener(eventType, (event) => {
        handleScreenEvent(event, eventType.toLowerCase(), mainBall);
    });
});
['touchstart', 'touchmove', 'touchend'].forEach((eventType) => {
    canvas.addEventListener(eventType, (event) => {
        handleScreenEvent(event, eventType.toLowerCase(), mainBall);
    });
});


/*
// TODO: make this actually work


// Gravity constants
const GRAVITY_X_MULTIPLIER = 0.5; // Strength of gravity in the X-axis
const GRAVITY_Y_MULTIPLIER = 0.5; // Strength of gravity in the Y-axis

// Function to handle device orientation changes
function handleOrientation(event,ball) {
    const beta = event.beta || 0; // Front-to-back tilt (-180 to 180)
    const gamma = event.gamma || 0; // Left-to-right tilt (-90 to 90)

    // Normalize tilt angles to [-1, 1] range
    const normalizedBeta = Math.min(Math.max(beta / 180, -1), 1);
    const normalizedGamma = Math.min(Math.max(gamma / 90, -1), 1);

    // Apply gravity forces based on the tilt angles
    if (!isDragging) {
        ball.dx += -normalizedGamma * GRAVITY_X_MULTIPLIER; // Negative because gamma increases to the right
        ball.dy += normalizedBeta * GRAVITY_Y_MULTIPLIER; // Positive because beta increases forward
    }
}

// Check if the DeviceOrientation API is supported
if (window.DeviceOrientationEvent) {
    // Start listening for orientation changes
    window.addEventListener('deviceorientation', (event) => {
        handleOrientation(event,mainBall);
    }, true);
} else {
    console.warn("DeviceOrientation API is not supported on this device.");
}
*/










// ======================
// 7. Animation Loop
// ======================




// Animation loop
function animate() {
    if (!paused) { // Only run the animation if not paused
        updateFPS(); // Update the FPS counter
        clearCanvas();
        mainBall.update(); // Update the main ball's position and velocity

        //for (let i = 0; i< 200000; i++) // With this many calculations I could still run it at 30fps
        // this is basically for stress-test also small change checking ->
        // like changing a single function to be quicker might not be noticeable
        // but running it (200K * all items) is actually kinda slow ... not too much tho
            gameObjectManager.handleCollisionsForObject(mainBall); // Handle collisions

        // Draw objects conditionally
        gameObjectManager.drawConditionally(ctx, hasFloor);

        drawFPS(); // Draw the FPS counter
    } else {
        /*
        // Draw "Paused" text on the canvas
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.fillText("Paused", canvas.width/20*9.5, canvas.height/15);

         */
        drawPausedText(ctx,canvas);
    }
    requestAnimationFrame(animate); // Always request the next frame
}

// Start the animation loop
animate();

// Add event listener for spacebar to toggle pause/resume
document.addEventListener("keydown", (event) => {
    if (event.code === "Space") // Check if the spacebar is pressed
        paused = !paused; // Toggle the pause state
        //console.log(paused ? "Animation paused" : "Animation resumed");
});





// ======================
// 8. Collision
// ======================



// Generalized function to handle collisions
function handleCollision(ball, object) {
    if (ball === object) return;
    const ballRadius = ball.radius;

    if (object.type === "rectangle") {
        if (object.identifier === "floor" && !hasFloor) return;

        // Quick check: Is the ball far from the rectangle?
        if (isBallFarFromRectangle(ball, object)) return;

        // Resolve the collision
        resolveRectangleCollision(ball, object);
    } else if (object.type === "triangle") {
        // Use the precomputed transformed vertices from the triangle
        const triangleVertices = object.transformedVertices;

        // Perform the quick check and get the closest point and distance
        const { isFar, closestPoint, distanceSquared } = isBallFarFromTriangle(ball, triangleVertices);

        if (isFar) return; // Quick exit if the ball is far from the triangle

        // Check for collision using the precomputed distance
        if (distanceSquared < ballRadius * ballRadius) {
            resolveBallTriangleCollision(ball, triangleVertices, closestPoint, distanceSquared);
        }
    } else if (object.type === "ball") {
        // Quick check: Are the balls far apart?
        if (isBallFarFromBall(ball, object)) return; // Exit early if they are far apart
        // Check for collision and resolve it
        if (checkBallBallCollision(ball, object)) {
            resolveBallBallCollision(ball, object);
        }
    }
}







// ======================
// 10. Ball collision helper
// ======================




// Function to check for collision between two balls
function checkBallBallCollision(ball1, ball2) {
    const radiusSum = ball1.radius + ball2.radius;
    const distanceSquared = getDistanceSquared(ball1.x, ball1.y, ball2.x, ball2.y);
    return distanceSquared <= radiusSum * radiusSum;
}

// Function to resolve collision between two balls
function resolveBallBallCollision(ball1, ball2) {
    // Calculate the normal vector between the two balls
    const dx = ball1.x - ball2.x;
    const dy = ball1.y - ball2.y;
    const normal = normalizeVector(dx, dy);

    // Calculate relative velocity
    const relativeVelocityX = ball1.dx - ball2.dx;
    const relativeVelocityY = ball1.dy - ball2.dy;

    // Calculate the dot product of the relative velocity and the normal vector
    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

    // If the balls are moving away from each other, no collision response is needed
    if (dotProduct > 0) return;

    // Calculate the impulse (considering masses as inversely proportional to radii)
    const massFactor1 = 1 / (ball1.radius + 0.001); // Add a small constant to avoid division by zero
    const massFactor2 = 1 / (ball2.radius + 0.001);
    const totalMassFactor = massFactor1 + massFactor2;
    const impulse = (-2 * dotProduct) / totalMassFactor;

    // Apply the impulse to the balls' velocities
    const impulseX = impulse * normal.x;
    const impulseY = impulse * normal.y;

    ball1.dx += impulseX * massFactor1;
    ball1.dy += impulseY * massFactor1;

    /*
    // currently ball2 is fixed
    ball2.dx -= impulseX * massFactor2;
    ball2.dy -= impulseY * massFactor2;
    */
    // Correct positions to prevent overlap
    const distance = Math.sqrt(getDistanceSquared(ball1.x, ball1.y, ball2.x, ball2.y));
    const overlap = (ball1.radius + ball2.radius) - distance;

    if (overlap > 0) {
        const correctionX = normal.x * overlap * 0.5;
        const correctionY = normal.y * overlap * 0.5;

        ball1.x += correctionX;
        ball1.y += correctionY;

        /*
        // currently ball2 is fixed
        ball2.x -= correctionX;
        ball2.y -= correctionY;
         */
}
}

// Function to check if two balls are far apart
function isBallFarFromBall(ball1, ball2) {
const distanceSquared = getDistanceSquared(ball1.x, ball1.y, ball2.x, ball2.y);
const radiusSum = ball1.radius + ball2.radius;
const radiusSumSquared = radiusSum * radiusSum; // Square of the sum of radii

// Add a small epsilon value to account for floating-point inaccuracies
const epsilon = 1; // Small tolerance
return distanceSquared > radiusSumSquared + epsilon;
}








// ======================
// 11. Triangle Collision Helper
// ======================




// Function to resolve collision between a ball and a triangle
function resolveBallTriangleCollision(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);
    // Calculate the squared distance between the ball's center and the closest point
    const distanceSquared = getDistanceSquared(ball.x, ball.y, closestPoint.x, closestPoint.y);

    // Resolve the collision using the generic function
    resolveCollision(
        ball,
        closestPoint,
        distanceSquared,
        (closestPoint, distance, invDistance) => normalizeVector(ball.x - closestPoint.x, ball.y - closestPoint.y)
    );
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

    // Clamp t to the line segment
    if (t <= 0) return start;
    if (t >= 1) return end;

    return {
        x: start.x + t * dx,
        y: start.y + t * dy
    };
}

// Function to check if the ball is far from the triangle
function isBallFarFromTriangle(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);

    // Calculate the squared distance between the ball's center and the closest point
    const distanceSquared = getDistanceSquared(ball.x, ball.y, closestPoint.x, closestPoint.y);

    // Return an object with the closest point and squared distance
    return {
        isFar: distanceSquared > ball.radius * ball.radius,
        closestPoint,
        distanceSquared
    };
}







// ======================
// 12. Rectangle Collision Helper
// ======================




// Function to resolve collision between a ball and a rectangle
function resolveRectangleCollision(ball, rectangle) {
    const closestPoint = getClosestPointOnRectangle(ball, rectangle);
    // Calculate the squared distance between the ball's center and the closest point
    const distanceSquared = getDistanceSquared(ball.x, ball.y, closestPoint.x, closestPoint.y);

    // Resolve the collision using the generic function
    resolveCollision(
        ball,
        closestPoint,
        distanceSquared,
        (closestPoint, distance, invDistance) => getRectangleNormal(ball, rectangle, closestPoint)
    );
}

// Function to check if the ball is far from the rectangle
function isBallFarFromRectangle(ball, rect) {
    const closestPoint = getClosestPointOnRectangle(ball, rect);

    // Calculate the squared distance from the ball to the closest point
    const distanceSquared = getDistanceSquared(ball.x, ball.y, closestPoint.x, closestPoint.y);

    // Check if the distance is greater than the ball's radius
    return distanceSquared > ball.radius * ball.radius;
}

// Helper function to calculate the closest point on a rectangle to a given point
function getClosestPointOnRectangle(ball, rect) {
    const { x: ballX, y: ballY } = ball;
    const { x: rectX, y: rectY, width, height } = rect;

    // Clamp the ball's position to the rectangle's boundaries
    const closestX = Math.max(rectX, Math.min(ballX, rectX + width));
    const closestY = Math.max(rectY, Math.min(ballY, rectY + height));

    return { x: closestX, y: closestY };
}

// Helper function to calculate the normal vector for a rectangle collision
function getRectangleNormal(ball, rect, closestPoint) {
    const { x: ballX, y: ballY } = ball;
    const { x: rectX, y: rectY, width, height } = rect;
    const { x: closestX, y: closestY } = closestPoint;

    // Determine which edge the closest point lies on
    const deltaX = ballX - closestX;
    const deltaY = ballY - closestY;

    // Check if the closest point is closer horizontally or vertically
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Closer to left or right edge
        return deltaX > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    } else {
        // Closer to top or bottom edge
        return deltaY > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
}




// ======================
// 13. Other Vector stuff
// ======================



// Function to resolve collision between a ball and any shape
function resolveCollision(ball, closestPoint, distanceSquared, getNormal) {
    // Early exit if the ball is not colliding
    if (distanceSquared >= ball.radius * ball.radius) return;

    const distance = Math.sqrt(distanceSquared);
    const invDistance = 1 / distance; // Avoid division in the loop
    const normal = getNormal(closestPoint, distance, invDistance);

    // Calculate the overlap between the ball and the closest point
    const overlap = ball.radius - distance;

    // Correct the ball's position to prevent overlap
    ball.x += normal.x * overlap;
    ball.y += normal.y * overlap;

    // Calculate the relative velocity (for a static object, ball's velocity is the relative velocity)
    const relativeVelocityX = ball.dx;
    const relativeVelocityY = ball.dy;

    // Calculate the dot product of the relative velocity and the normal vector
    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

    // If the ball is moving away, no collision response is needed
    if (dotProduct > 0) return;

    // Calculate the impulse (assuming the object is static)
    const impulse = -2 * dotProduct;

    // Apply the impulse to the ball's velocity
    ball.dx += impulse * normal.x * bounceFactor; // Apply bounce factor
    ball.dy += impulse * normal.y * bounceFactor;

    // Apply friction to reduce horizontal velocity
    ball.dx *= 1 - ball.friction;

    // Handle resting state: Stop the ball if its vertical velocity is negligible
    if (Math.abs(ball.dy) < 0.1 && normal.y > 0) { // Only stop if the ball is on top of the object
        ball.dy = 0;
        ball.y = closestPoint.y - ball.radius; // Ensure the ball rests exactly on top
    }
}

// Function to get the normalized normal vector for a given shape
function getNormalFromPoint(ball, closestPoint, distance, invDistance) {
    return {
        x: (ball.x - closestPoint.x) * invDistance,
        y: (ball.y - closestPoint.y) * invDistance
    };
}

// Helper function to normalize a vector
function normalizeVector(dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return { x: 1, y: 0 }; // Default direction if zero length
    return { x: dx / length, y: dy / length };
}

// Utility function to clamp a value within a range
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Helper function to calculate squared distance between two points
function getDistanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

