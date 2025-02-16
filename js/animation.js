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
8. Json and shape building
9. Collision
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

    handleCollisions4Ball(ball) {
        this.objects.forEach(object => {
            if (object !== ball) {
                handleCollision4Ball(ball, object);
            }
        });
    }

    handleCollisions(ball) {
        // -_- Idk what to do here so ... skip it
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
    updateMovement(currentXMov,currentYMov) {
        if (currentXMov === undefined)
            return;
        else{
            this.dx += currentXMov;
            this.dy += currentYMov;
        }
    }
    updateMovX(currentXMov) {
        if (currentXMov !== undefined)
            this.dx += currentXMov;
    }
    updateMovY(currentYMov) {
        if (currentYMov !== undefined)
            this.dy += currentYMov;
    }

    applyGravity(){
        this.dy+=currentGravity;
    }


    setMovement(currentXMov,currentYMov) {
        if (currentXMov === undefined)
            return;
        else {
            this.dx = currentXMov;
            this.dy = currentYMov;
        }
    }
    setMovX(currentXMov) {
        if (currentXMov !== undefined)
            this.dx = currentXMov;
    }
    setMovY(currentYMov) {
        if (currentYMov !== undefined)
            this.dy = currentYMov;
    }


    // Update position based on velocity
    updatePosition(currentXUpdate,currentYUpdate) {
        if (currentXUpdate === undefined){
            this.x += this.dx;
            this.y += this.dy;
        }
        else {
            this.x += currentXUpdate;
            this.y += currentYUpdate;
        }
    }
    updatePosX(currentXUpdate) {
        if (currentXUpdate === undefined)
            this.x += this.dx;
        else
            this.x += currentXUpdate;
    }
    updatePosY(currentYUpdate) {
        if (currentYUpdate === undefined)
            this.y += this.dy;
        else
            this.y += currentYUpdate;
    }


    // Update position based on velocity
    setPosition(currentXUpdate,currentYUpdate) {
        if (currentXUpdate === undefined)
            return;
        else {
            this.x = currentXUpdate;
            this.y = currentYUpdate;
        }
    }
    setPosX(currentXUpdate) {
        if (currentXUpdate !== undefined)
            this.x = currentXUpdate;
    }
    setPosY(currentYUpdate) {
        if (currentYUpdate !== undefined)
            this.y = currentYUpdate;
    }


    // Default update method that calls all sub-methods
    updateAll() {
        this.applyFriction();
        this.applyGravity();
        this.updatePosition();
    }

    // Abstract method for drawing
    draw(ctx) {
        throw new Error('draw() method must be implemented by subclasses.');
    }
}

class Ball extends GameObject {
    constructor(x, y, radius, dx, dy, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.radius = radius;
        this.type = "ball";
        this.startAngle;
        this.endAngle;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, this.startAngle||0, this.endAngle||Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    updateAll() {
        // Update ball position if not being dragged
        // Suppress or conditionally execute parts of the update logic
        if (this.identifier==="main_ball") {
            if (!isDragging) {
                this.updatePosition();
            } else {
                this.updatePosY();
            }
        }
        else{
            this.updatePosition();
        }
        this.applyGravity();
        this.applyFriction();

        this.handleEdgeCollision();

    }

    handleEdgeCollision() {
        const { width, height } = canvas;

        // Horizontal CCD
        if (this.dx !== 0) {
            const timeToHitLeft = (this.radius - this.x) / this.dx;
            const timeToHitRight = (width - this.radius - this.x) / this.dx;

            if (timeToHitLeft >= 0 && timeToHitLeft < 1) {
                this.updatePosX(this.radius); // Prevent overlap
                this.updateMovX(-Math.abs(this.dx) * (1 - this.friction) * bounceFactor); // Reverse velocity
            } else if (timeToHitRight >= 0 && timeToHitRight < 1) {
                this.updatePosX(width - this.radius); // Prevent overlap
                this.updateMovX(-Math.abs(this.dx) * (1 - this.friction) * bounceFactor); // Reverse velocity
            }
        }

        // Vertical CCD
        if (this.dy !== 0) {
            const timeToHitTop = (this.radius - this.y) / this.dy;
            const timeToHitBottom = (height - this.radius - this.y) / this.dy;

            if (timeToHitTop >= 0 && timeToHitTop < 1) {
                this.updatePosY(this.radius); // Prevent overlap
                this.updateMovY(-Math.abs(this.dy) * (1 - this.friction) * bounceFactor); // Reverse velocity
            } else if (timeToHitBottom >= 0 && timeToHitBottom < 1) {
                this.updatePosY(height - this.radius); // Prevent overlap
                this.updateMovY(-Math.abs(this.dy) * (1 - this.friction) * bounceFactor); // Reverse velocity
            }
        }
    }

}

class Polygon extends GameObject {
    constructor(x, y, localVertices, dx, dy, rotation, friction, color, identifier) {
        super(x, y, dx, dy, friction, color, identifier);
        this.localVertices = localVertices; // Vertices in local space (relative to the center)
        this.rotation = rotation || 0; // Rotation angle in radians
        this.type = "polygon"; // Default type is "polygon"
        this.transformedVertices = localVertices.map(() => ({ x: 0, y: 0 })); // Initialize transformed vertices
        //console.log("super - should be 00 ",this.transformedVertices); // <- is not 00 ... idk why or how ...
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

    // Draw the polygon
    draw(ctx) {
        this.updateVertices(); // Ensure vertices are updated before drawing

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

class Triangle extends Polygon {
    constructor(x, y, size, dx, dy, rotation, friction, color, identifier) {

        // Precompute the height of the equilateral triangle
        const height = (Math.sqrt(3) * 0.5) * size;

        // Precompute the vertices in local space (relative to the center)
        const localVertices = [
            { x: 0, y: -height }, // Top vertex
            { x: -size, y: height }, // Bottom-left vertex
            { x: size, y: height } // Bottom-right vertex
        ];

        super(x, y, localVertices, dx, dy, rotation, friction, color, identifier);
        //this.transformedVertices = [{x:0,y:0},{x:0,y:0},{x:0,y:0}];
        this.type = "triangle"; // Override type
        this.height = height;
        this.size = size; // Store the size for future reference
    }
}

class Rectangle extends Polygon {
    constructor(x, y, width, height, dx, dy, rotation, friction, color, identifier) {
        // Precompute the vertices in local space (relative to the center)
        const localVertices = [
            { x: 0, y: 0}, // Top-left
            { x: width, y: 0 }, // Top-right
            { x: width, y: height }, // Bottom-right
            { x: 0, y: height } // Bottom-left
        ];

        super(x, y, localVertices, dx, dy, rotation, friction, color, identifier);
        //this.transformedVertices = [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}];
        this.type = "rectangle"; // Override type
        this.width = width; // Store dimensions for future reference
        this.height = height;
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
            mainBall.setPosition(canvas.width * 0.5,canvas.height * 0.5);
            mainBall.setMovement(0,0);
            break;
        case 'toggleFloor':
            hasFloor = !hasFloor;
            event.target.textContent = hasFloor ? "Delete Floor" : "Generate Floor";
            break;
        case 'toggleGravity':
            currentGravity = (currentGravity === gravity ? gravity * 0.5 : gravity);
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
        ball.setPosX(canvasX); // Update ball position with normalized coordinates
        ball.setMovX(0); // Reset velocity while dragging
    } else if (type === 'touchend' || type === 'mouseup' && event.button === 0) {
        ball.setMovX(0); // Reset the velocity what th ball might have collected while dragged (like at a rotated surface)
        isDragging = false;
        // Check for jump condition on mouse/touch release
        const clickDuration = Date.now() - mouseDownTime;
        if (clickDuration < 100) {
            ball.setMovY(-5); // Apply upward force for jumping
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
            ModalOpen("Error","DeviceOrientation API is not supported on this device.");
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
        if (!isDragging) {
            ball.dx += -normalizedGamma * GRAVITY_X_MULTIPLIER; // Negative because gamma increases to the right
            ball.dy += normalizedBeta * GRAVITY_Y_MULTIPLIER; // Positive because beta increases forward
        }
    }

    /**
     * Set the drag state of the ball.
     * @param {boolean} isDragging - Whether the ball is being dragged.
     */
}

// Example usage:
const gravityManager = new GravityManager();

// Start applying gravity to the main ball
const gravyStart = "gravityManager.start(mainBall);";

// Optionally, you can toggle the drag state when interacting with the ball
// For example, during mouse/touch events:











// ======================
// 7. Animation Loop
// ======================




// Animation loop
function animate() {
    if (!paused) { // Only run the animation if not paused
        updateFPS(); // Update the FPS counter
        clearCanvas();
        mainBall.updateAll(); // Update the main ball's position and velocity

        //for (let i = 0; i< 100000; i++) // With this many calculations I could still run it at 30fps
        // this is basically for stress-test also small change checking ->
        // like changing a single function to be quicker might not be noticeable
        // but running it (100K * all items) is actually kinda slow ... not too much tho
        gameObjectManager.handleCollisions4Ball(mainBall); // Handle collisions

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
// 8. Json and shape building
// ======================




// Function to create objects based on type
function createObjectFromData(data) {
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
                data.identifier.trim()===""? `${data.color}"_"${data.type}` : data.identifier,
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
                data.identifier.trim()===""? `${data.color}"_"${data.type}` : data.identifier,
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
                data.identifier.trim()===""? `${data.color}"_"${data.type}` : data.identifier,
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
            const obj = createObjectFromData(objectData);
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
            const pyPercent = parseFloat(value);
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
loadGameObjects('./json/gameObjects.json',canvas).then(rawData => {
    if (rawData) {
        gameObjectManager = rawData;
        //console.log("Game Object Manager:", gameObjectManager);

        // Initialize mainBall and floorRect
        mainBall = gameObjectManager.getObjectByIdentifier("main_ball");
        floorRect = gameObjectManager.getObjectByIdentifier("floor");

        // Start the animation loop
        animate();
    }
});







// ======================
// 9. Collision
// ======================



// Generalized function to handle collisions
function handleCollision4Ball(ball, object) {
    if (ball.dy === 0 && ball.dx === 0) return;

    if (object.type === "rectangle") {
        if (object.identifier === "floor" && !hasFloor) return;
        // Quick check: Is the ball far from the rectangle?
        const { isFar, closestPoint, distanceSquared } = isBallFarFromRectangle(ball, object.transformedVertices);
        if (isFar) return; // Quick exit if the ball is far from the rectangle

        // Resolve the collision
        resolveBallRectangleCollision(ball, closestPoint, distanceSquared);
    } else if (object.type === "triangle") {
        // Perform the quick check and get the closest point and distance
        const { isFar, closestPoint, distanceSquared } = isBallFarFromTriangle(ball, object.transformedVertices);
        if (isFar) return; // Quick exit if the ball is far from the triangle

        resolveBallTriangleCollision(ball, closestPoint, distanceSquared);
    } else if (object.type === "ball") {
        // Check for collision and resolve it
        resolveBallBallCollision(ball, object);
    }
}

// Helper function to calculate the closest point on a polygon (or any shape with straight sides) to a given point
function getClosestPointOnPolygon(point, polygonVertices) {
    let closestPoint = null;
    let minDistanceSquared = Infinity;

    // Check each edge of the polygon
    for (let i = 0; i < polygonVertices.length; i++) {
        const start = polygonVertices[i];
        const end = polygonVertices[(i + 1) % polygonVertices.length]; // Next vertex (wraps around)
        const pointClosest = getClosestPointOnLine(point, start, end);
        const distanceSquared = getDistanceSquared(point, pointClosest);

        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = pointClosest;
        }
    }

    // Check the polygon's vertices
    for (const vertex of polygonVertices) {
        const distanceSquared = getDistanceSquared(point, vertex);

        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = vertex;
        }
    }

    return closestPoint;
}

// Function to resolve collision between a ball and any shape (with straight sides)
function resolveCollision(ball, closestPoint, distanceSquared, normal) {
    // Early exit if the ball is not colliding
    const radiusSquared = ball.radius * ball.radius;
    if (distanceSquared > radiusSquared) return;

    // Calculate the overlap between the ball and the closest point
    const distance = Math.sqrt(distanceSquared);
    const overlap = ball.radius - distance;

    // Correct the ball's position to prevent overlap
    ball.updatePosition(
        normal.x * overlap,
        normal.y * overlap
    );

    // Calculate the relative velocity (for a static object, ball's velocity is the relative velocity)
    const relativeVelocityX = ball.dx;
    const relativeVelocityY = ball.dy;

    // Calculate the dot product of the relative velocity and the normal vector
    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

    // If the ball is moving away, no collision response is needed
    if (dotProduct > 0) return;

    // Calculate the impulse (assuming the object is static)
    const impulse = -2 * dotProduct;

    // Apply the impulse to the ball's velocity with bounce factor
    ball.updateMovement(
        impulse * normal.x * bounceFactor,
        impulse * normal.y * bounceFactor
    );
}








// ======================
// 10. Ball collision helper
// ======================





function resolveBallBallCollision(ball, object) {
    const distanceSquared = getDistanceSquared(ball, object);
    const radiusSum = ball.radius + object.radius;

    // Quick exit if the balls are not touching
    const epsilon = 0.0001;
    if (distanceSquared > (radiusSum * radiusSum + epsilon)) return;

    const distance = Math.sqrt(distanceSquared); // Required for position correction

    // Calculate the normal vector between the two balls
    const normal = {
        x: (ball.x - object.x) / distance,
        y: (ball.y - object.y) / distance
    };

    // Calculate relative velocity (only ball's velocity since object is stationary)
    const relativeVelocityX = ball.dx// - object.dx;
    const relativeVelocityY = ball.dy// - object.dy;

    // Calculate the dot product of the relative velocity and the normal vector
    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;

    // If the balls are moving away from each other, no collision response is needed
    if (dotProduct > -epsilon) return; // Ensure the balls are moving toward each other

    // Calculate the impulse (considering masses as inversely proportional to radii)
    // Only ball moves, so only its mass factor matters
    const massFactor1 = 1 / (ball.radius * ball.radius || 1); // Default to 1 if mass is undefined
//    const massFactor2 = 1 / (object.radius * object.radius || 1); // Default to 1 if mass is undefined
//    const totalMassFactor = massFactor1 + massFactor2;
    const impulse = (-2 * dotProduct) / massFactor1;

    // Apply the impulse to ball's velocities
    const impulseX = impulse * normal.x;
    const impulseY = impulse * normal.y;

    ball.updateMovement(
        impulseX * massFactor1 * ball.friction * bounceFactor,
        impulseY * massFactor1 * ball.friction * bounceFactor
    );
    // Only ball moves, so only its velocity will be updated

    // Correct positions to prevent overlap
    const overlap = (ball.radius + object.radius) - distance;
    if (overlap > -epsilon) {
        const correctionFactor = 1; // Adjust as needed (this ensures partial correction)
        const correctionX = normal.x * overlap * correctionFactor;
        const correctionY = normal.y * overlap * correctionFactor;

        ball.updatePosition(
            correctionX,
            correctionY
        );
        // Only ball moves, so only its position will be updated
    }
}







// ======================
// 11. Triangle Collision Helper
// ======================




// Function to resolve collision between a ball and a triangle
function resolveBallTriangleCollision(ball, closestPoint, distanceSquared) {
    // Normalize vector from the closest point to ball's center
    const dx = ball.x - closestPoint.x;
    const dy = ball.y - closestPoint.y;
    const distance = Math.sqrt(distanceSquared);
    const invDistance = 1 / distance;

    // Pass the normalized vector as the normal
    resolveCollision(
        ball,
        closestPoint,
        distanceSquared,
        { x: dx * invDistance, y: dy * invDistance }
    );
}

// Function to check if the ball is far from the triangle
function isBallFarFromTriangle(ball, triangleVertices) {
    const closestPoint = getClosestPointOnPolygon(ball, triangleVertices);

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
function resolveBallRectangleCollision(ball, closestPoint, distanceSquared) {
    // Get the rectangle's normal at the closest point
    const normal = normalizeVector(ball.x - closestPoint.x, ball.y - closestPoint.y);

    // Resolve the collision using the generic function
    resolveCollision(
        ball,
        closestPoint,
        distanceSquared,
        normal
    );
}

// Function to check if the ball is far from the rotated rectangle
function isBallFarFromRectangle(ball, rectangleVertices) {
    const closestPoint = getClosestPointOnPolygon(ball, rectangleVertices);
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
function getClosestPointOnLine(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    // Handle the case where the line segment is degenerate (start and end are the same)
    if (lengthSquared === 0) return { x: start.x, y: start.y };

    // Project the ball's center onto the line segment
    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;

    // Clamp t to the range [0, 1] to ensure the closest point lies on the segment
    const clampedT = Math.max(0, Math.min(1, t));

    // Compute the closest point on the line segment
    return {
        x: start.x + clampedT * dx,
        y: start.y + clampedT * dy
    };
}

// Helper function to normalize a vector
function normalizeVector(x, y, distance = Math.sqrt(x * x + y * y)) {
    if (distance === 0) return { x: 0, y: 0 }; // Handle zero-length vectors
    return { x: x / distance, y: y / distance };
}

// Helper function to calculate squared distance between two points
function getDistanceSquared(a,b) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return x * x + y * y;
}

