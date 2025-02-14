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
9. Json and shape building
10. Ball collision helper
11. Triangle collision helper
12. Rectangle collision helper
13. Other Vector stuff
*/




// ======================
// 1. Constants and basic helping values
// ======================

// Get the default stuff made
const customContextMenu = document.getElementById('customContextMenu');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth; // Set canvas size to full screen
canvas.height = window.innerHeight*0.8;
let mouseDownTime = 0;
let paused = false; // Global variable to track pause state
let isDragging= false;
let gameObjectManager;
let mainBall;
let floorRect;


let frameCount = 0; // Counter for the number of frames rendered
let fps = 0; // Current FPS value

// Physics constants
const gravity = 0.1; // Gravity strength
const bounceFactor = 0.8; // Adjust bounce factor (0.8 = 80% energy retained)
let hasFloor = true; // Whether the floor exists
let currentGravity = gravity;

// Gravity constants
const GRAVITY_X_MULTIPLIER = 0.5; // Strength of gravity in the X-axis
const GRAVITY_Y_MULTIPLIER = 0.5; // Strength of gravity in the Y-axis
const DEGREES_TO_RADIANS_MULTIPLIER = Math.PI / 180;




// ======================
// 2. FPS counter
// ======================




function updateFPS() {
    frameCount++; // Increment the frame counter

    // Schedule the FPS calculation to happen after half second
    if (!updateFPS.timeoutId) { // Ensure only one timeout is active at a time
        updateFPS.timeoutId = setTimeout(() => {
            fps = frameCount * 2; // Set the FPS to the half of the number of frames counted in the last second
            frameCount = 0; // Reset the frame counter
            updateFPS.timeoutId = null; // Clear the timeout ID
        }, 500); // Run this every half second
    }
}

function drawFPS() {
    ctx.fillStyle = PrefersDark ? "black" : "white"; // Set the text color
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
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Position values must be numbers.');
        }
        if (typeof dx !== 'number' || typeof dy !== 'number') {
            throw new Error('Velocity values must be numbers.');
        }
        if (friction < 0 || friction > 1) {
            throw new Error('Friction must be between 0 and 1.');
        }
        this.x = x || 0;
        this.y = y || 0;
        this.dx = dx || 0;
        this.dy = dy || 0;
        this.friction = friction || 0.2;
        this.color = color || "purple";
        this.identifier = identifier || "default";
    }

    // Apply friction to velocity
    applyFriction() {
        this.dx *= 1 - this.friction;
        this.dy *= 1 - this.friction;
    }

    // Apply gravity to vertical velocity
    applyMovement(currentYMovement, currentXMovement) {
        this.dy += currentYMovement;
        this.dx += currentXMovement;
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
        this.applyMovement();
        this.updatePosition();
    }

    // Abstract method for drawing
    draw(ctx) {
        throw new Error('draw() method must be implemented by subclasses.');
    }

    handleEdgeCollision(canvas) {
        const { x, y, radius } = this;

        // Horizontal collision
        this.handleEdgeHorizontalCollision(canvas, x, radius);
        // Vertical collision
        this.handleEdgeVerticalCollision(canvas, y, radius);
    }

    handleEdgeHorizontalCollision(canvas, x, radius) {
        if (x - radius <= 0) {
            this.dx = -(Math.abs(this.dx) * (1 - this.friction) * bounceFactor);
            this.x = radius; // Prevent sinking
        } else if (x + radius >= canvas.width) {
            this.dx = -(Math.abs(this.dx) * (1 - this.friction) * bounceFactor);
            this.x = canvas.width - radius; // Prevent sinking
        }
    }

    handleEdgeVerticalCollision(canvas, y, radius) {
        if (y - radius <= 0) {
            this.dy = Math.abs(this.dy) * (1 - this.friction) * bounceFactor;
            this.y = radius; // Prevent sinking
        } else if (y + radius >= canvas.height) {
            this.dy = -(Math.abs(this.dy) * (1 - this.friction) * bounceFactor);
            this.y = canvas.height - radius; // Prevent sinking
        }
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
        this.applyMovement(currentGravity,0);

        this.handleEdgeCollision(canvas);

    }
}

class Triangle extends GameObject {
    constructor(x, y, size, dx, dy, rotation, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.size = size;
        this.rotation = rotation; // Rotation angle in radians
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
        this.transformedVertices = [{x:0,y:0},{x:0,y:0},{x:0,y:0},];
        this.updateVertices();
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
    constructor(x, y, width, height, dx, dy, rotation, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.width = width;
        this.height = height;
        this.rotation = rotation; // Rotation angle in radians
        this.type = "rectangle";

        // Precompute the vertices in local space (relative to the center)
        this.localVertices = [
            { x: 0, y: 0}, // Top-left
            { x: this.width, y: 0},  // Top-right
            { x: this.width, y: this.height},   // Bottom-right
            { x: 0, y: this.height}   // Bottom-left
        ];

        // Initialize the transformed vertices
        this.transformedVertices = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
        this.updateVertices();
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

    // Draw the rectangle
    draw(ctx) {
        // Update the vertices if the rectangle has moved or rotated
        this.updateVertices();

        // Draw the rectangle
        ctx.beginPath();
        ctx.moveTo(this.transformedVertices[0].x, this.transformedVertices[0].y);
        for (let i = 1; i < this.transformedVertices.length; i++) {
            ctx.lineTo(this.transformedVertices[i].x, this.transformedVertices[i].y);
        }
        ctx.closePath(); // Close the path by connecting the last vertex to the first

        ctx.fillStyle = this.color;
        ctx.fill();
    }
}









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
canvas.addEventListener('contextmenu', showCustomContextMenu);
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
    const rect = canvas.getBoundingClientRect(); // Get the bounding rectangle of the canvas

    // Normalize the mouse/touch position relative to the canvas
    const scaleX = canvas.width / rect.width; // Scale factor for width
    const scaleY = canvas.height / rect.height; // Scale factor for height
    const canvasX = (clientX - rect.left) * scaleX; // Adjusted X coordinate
    const canvasY = (clientY - rect.top) * scaleY; // Adjusted Y coordinate

    // Logic for dragging and jumping
    if (type === 'touchstart' || type === 'mousedown' && event.button === 0) {
        isDragging = true;
        mouseDownTime = Date.now(); // Record the time when the mouse is pressed
    } else if (isDragging && (type === 'touchmove' || type === 'mousemove')) {
        ball.x = canvasX; // Update ball position with normalized coordinates
        ball.dx = 0; // Reset velocity while dragging
    } else if (type === 'touchend' || type === 'mouseup' && event.button === 0) {
        isDragging = false;
        // Check for jump condition on mouse/touch release
        const clickDuration = Date.now() - mouseDownTime;
        if (clickDuration < 100) {
            mainBall.dy = -5; // Apply upward force for jumping
        }
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



// TODO: make this actually work

/**
 * Class to manage device orientation-based gravity for balls.
 */
class GravityManager {
    constructor() {
        this.isSupported = !!window.DeviceOrientationEvent; // Check if API is supported
        this.isDragging = false; // Track if the user is dragging the ball
    }

    /**
     * Start listening for device orientation changes.
     * @param {Ball} ball - The ball object affected by gravity.
     */
    start(ball) {
        if (!this.isSupported) {
            console.warn("DeviceOrientation API is not supported on this device.");
            return;
        }

        window.addEventListener('deviceorientation', (event) => {
            this.applyGravity(event, ball);
        }, true);
    }

    /**
     * Apply gravity forces based on device orientation.
     * @param {Event} event - The device orientation event.
     * @param {Ball} ball - The ball object affected by gravity.
     */
    applyGravity(event, ball) {
        const beta = event.beta || 0; // Front-to-back tilt (-180 to 180)
        const gamma = event.gamma || 0; // Left-to-right tilt (-90 to 90)

        // Normalize tilt angles to [-1, 1] range
        const normalizedBeta = Math.min(Math.max(beta / 180, -1), 1);
        const normalizedGamma = Math.min(Math.max(gamma / 90, -1), 1);

        // Apply gravity forces only when the ball is not being dragged
        if (!this.isDragging) {
            ball.dx += -normalizedGamma * GRAVITY_X_MULTIPLIER; // Negative because gamma increases to the right
            ball.dy += normalizedBeta * GRAVITY_Y_MULTIPLIER; // Positive because beta increases forward
        }
    }

    /**
     * Set the drag state of the ball.
     * @param {boolean} isDragging - Whether the ball is being dragged.
     */
    setDraggingState(isDragging) {
        this.isDragging = isDragging;
    }
}

// Example usage:
const gravityManager = new GravityManager();

// Start applying gravity to the main ball
const gravyStart = "gravityManager.start(mainBall);";

// Optionally, you can toggle the drag state when interacting with the ball
// For example, during mouse/touch events:
// gravityManager.setDraggingState(true); // When drag starts
// gravityManager.setDraggingState(false); // When drag ends











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
        drawPausedText(ctx,canvas);
    }
    requestAnimationFrame(animate); // Always request the next frame
}

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
        const { isFar, closestPoint, distanceSquared } = isBallFarFromRectangle(ball, object);
        
        if (isFar) return; // Quick exit if the ball is far from the rectangle

        // Resolve the collision
        resolveRectangleCollision(ball, object, closestPoint, distanceSquared);
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
        // Check for collision and resolve it
        resolveBallBallCollision(ball, object);
    }
}








// ======================
// 9. Json and shape building
// ======================





// Function to create objects based on type
function createObjectFromData(data, canvas) {
    //console.log(data);
    switch (data.type) {
        case "ball":
            return new Ball(
                //(x, y, radius, dx, dy, friction, color, identifier)
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.radius),
                data.dx,
                data.dy,
                data.friction,
                data.color,
                data.identifier,
            );
        case "triangle":
            return new Triangle(
                //(x, y, size, dx, dy, rotation, friction, color, identifier)
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.size),
                data.dx,
                data.dy,
                evaluateValue(data.rotation), // Rotation in radians
                data.friction,
                data.color,
                data.identifier,
            );
        case "rectangle":
            return new Rectangle(
                //(x, y, width, height, dx, dy, rotation, friction, color, identifier)
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.width),
                evaluateValue(data.height),
                data.dx,
                data.dy,
                evaluateValue(data.rotation), // Rotation in radians
                data.friction,
                data.color,
                data.identifier,
            );
        default:
            throw new Error(`Unknown object type: ${data.type}`);
    }
}
async function loadGameObjects(place) {
    try {
        const response = await fetch(place);
        if (!response.ok) {
            throw new Error(`Failed to load game objects: ${response.status}`);
        }
        const jsonData = await response.json();

        // Create an instance of GameObjectManager
        const gameObjectManager = new GameObjectManager();

        // Add objects to the manager
        jsonData.objects.forEach(objectData => {
            const obj = createObjectFromData(objectData, canvas);
            gameObjectManager.addObject(obj);
        });

        console.log("Game objects loaded successfully!");
        return gameObjectManager;
    } catch (error) {
        console.error("Error loading game objects:", error);
    }
}

// Function to evaluate relative values
function evaluateValue(value) {
    if (typeof value === "string") {
        if (value.endsWith("%")) {
            // Handle percentage values
            const percent = parseFloat(value);
            //console.log(percent)
            if (value.includes("h")) {
                return canvas.height * (percent / 100);
            } else {
                return canvas.width * (percent / 100); // Default to width
            }
        } else if (value.endsWith("p")) {
            const pyPercent = parseFloat(value)*0.01;
            return pyPercent* DEGREES_TO_RADIANS_MULTIPLIER;
        } else {
            // Fallback to parsing as a number
            try{
                return parseFloat(value);
            }
            catch (e){
                console.error(e);
                return null;
            }
        }
    }
    return value; // Return as-is if not a string
}

// Call the function to load objects
loadGameObjects('./json/gameObjects.json',canvas).then(a => {
    if (a) {
        gameObjectManager = a;
        //console.log("Game Object Manager:", gameObjectManager);

        // Initialize mainBall and floorRect
        mainBall = gameObjectManager.getObjectByIdentifier("main_ball");
        floorRect = gameObjectManager.getObjectByIdentifier("floor");

        // Start the animation loop
        animate();
    }
});







// ======================
// 10. Ball collision helper
// ======================





// Function to resolve collision between two balls
function resolveBallBallCollision(ball1, ball2) {
    const distanceSquared = getDistanceSquared(ball1, ball2);
    const radiusSum = ball1.radius + ball2.radius;
    // Quick exit if the balls are not touching 
    if (distanceSquared > radiusSum * radiusSum) return;
    
    const distance = Math.sqrt(distanceSquared); // Required for position correction
    // Calculate the normal vector between the two balls
    const normal = normalizeVector(ball1.x - ball2.x, ball1.y - ball2.y);

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









// ======================
// 11. Triangle Collision Helper
// ======================




// Function to resolve collision between a ball and a triangle
function resolveBallTriangleCollision(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);
    // Calculate the squared distance between the ball's center and the closest point
    const distanceSquared = getDistanceSquared(ball, closestPoint);

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

// Function to check if the ball is far from the triangle
function isBallFarFromTriangle(ball, triangleVertices) {
    const closestPoint = getClosestPointOnTriangle(ball, triangleVertices);

    // Calculate the squared distance between the ball's center and the closest point
    const distanceSquared = getDistanceSquared(ball, closestPoint);

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



// Function to resolve collision between a ball and a rotated rectangle
function resolveRectangleCollision(ball, rectangle, closestPoint, distanceSquared) {
    // Resolve the collision using the generic function
    resolveCollision(
        ball,
        closestPoint,
        distanceSquared,
        (closestPoint, distance, invDistance) => getRectangleNormal(ball, rectangle, closestPoint)
    );
}

// Helper function to calculate the closest point on a rotated rectangle to a given point
function getClosestPointOnRectangle(ball, rectangle) {
    let closestPoint = null;
    let minDistanceSquared = Infinity;

    // Get the transformed vertices of the rectangle
    const vertices = rectangle.transformedVertices;

    // Check each edge of the rectangle
    for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i];
        const end = vertices[(i + 1) % vertices.length]; // Next vertex (wraps around)
        const point = getClosestPointOnLine(ball, start, end);

        const dx = ball.x - point.x;
        const dy = ball.y - point.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = point;
        }
    }

    // Check the rectangle's vertices
    for (const vertex of vertices) {
        const dx = ball.x - vertex.x;
        const dy = ball.y - vertex.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = vertex;
        }
    }

    return closestPoint;
}

// Helper function to calculate the normal vector for a rotated rectangle collision
function getRectangleNormal(ball, rectangle, closestPoint) {
    const { x: ballX, y: ballY } = ball;
    const { x: closestX, y: closestY } = closestPoint;

    // Normalize the vector to get the normal
    return normalizeVector(ballX - closestX, ballY - closestY);
}

// Function to check if the ball is far from the rotated rectangle
function isBallFarFromRectangle(ball, rectangle) {
    const closestPoint = getClosestPointOnRectangle(ball, rectangle);
    const distanceSquared = getDistanceSquared(ball, closestPoint);

    return {
        isFar: distanceSquared > ball.radius * ball.radius,
        closestPoint,
        distanceSquared
    };
}





// ======================
// 13. Other Vector stuff
// ======================



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
function getDistanceSquared(a,b) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return x * x + y * y;
}

