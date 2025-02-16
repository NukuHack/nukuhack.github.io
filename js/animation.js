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
10. other collision helper
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
const TOLERANCE = 1e-6;
const MAX_ITERATIONS = 10;

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


// moved to different js file ...



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
        case 'toggleRealisticGravity':
            try {
                event.target.textContent = gravityManager.isListening ? 'Disable Realistic Gravity' : 'Enable Realistic Gravity';
                gravityManager.isListening ? gravityManager.stop() : gravityManager.start(mainBall);
            } catch (error) {
                console.error("Error toggling gravity:", error);
            }
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
    const scaleX = canvas.width / rect.width; // Scale factor for width
    const scaleY = canvas.height / rect.height; // Scale factor for height
    const canvasX = (clientX - rect.left) * scaleX; // Adjusted X coordinate
    const canvasY = (clientY - rect.top) * scaleY; // Adjusted Y coordinate

    if (type === 'touchstart' || type === 'mousedown' && event.button === 0) {
        isDragging = true;
        mouseDownTime = Date.now(); // Record the time when the mouse is pressed
        gravityManager.setDragState(true); // Inform GravityManager that dragging has started
    } else if (isDragging && (type === 'touchmove' || type === 'mousemove')) {
        ball.setPosX(canvasX); // Update ball position with normalized coordinates
        ball.setMovX(0); // Reset velocity while dragging
    } else if (type === 'touchend' || type === 'mouseup' && event.button === 0) {
        ball.setMovX(0); // Reset velocity after dragging
        isDragging = false;
        gravityManager.setDragState(false); // Inform GravityManager that dragging has ended

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

// Class to manage device orientation-based gravity for balls
class GravityManager {
    constructor() {
        this.isSupported = !!window.DeviceOrientationEvent; // Check if API is supported
        this.isListening = false; // Track whether the event listener is active
        this.isDragging = false; // Track drag state
    }

    /**
     * Start listening for device orientation changes.
     * @param {Ball} ball - The ball object affected by gravity.
     * @param {number} gravityXMultiplier - Multiplier for horizontal gravity force.
     * @param {number} gravityYMultiplier - Multiplier for vertical gravity force.
     */
    start(ball, gravityXMultiplier = 0.05, gravityYMultiplier = 0.05) {
        if (!this.isSupported) {
            console.error("DeviceOrientation API is not supported on this device.");
            return;
        }
        if (this.isListening) {
            console.warn("Already listening for device orientation events.");
            return;
        }

        this.ball = ball;
        this.gravityXMultiplier = gravityXMultiplier;
        this.gravityYMultiplier = gravityYMultiplier;
        this.isListening = true;

        window.addEventListener('deviceorientation', (event) => {
            this.applyGravity(event);
        }, true);
    }

    /**
     * Stop listening for device orientation changes.
     */
    stop() {
        if (!this.isListening) {
            console.warn("Not currently listening for device orientation events.");
            return;
        }

        this.isListening = false;
        window.removeEventListener('deviceorientation', this.applyGravity.bind(this), true);
    }

    /**
     * Apply gravity forces based on device orientation.
     * @param {Event} event - The device orientation event.
     */
    applyGravity(event) {
        const beta = event.beta || 0; // Front-to-back tilt (-180 to 180)
        const gamma = event.gamma || 0; // Left-to-right tilt (-90 to 90)

        // Normalize tilt angles to [-1, 1] range
        const normalizedBeta = Math.min(Math.max(beta / 180, -1), 1);
        const normalizedGamma = Math.min(Math.max(gamma / 90, -1), 1);

        // Apply gravity forces only when the ball is not being dragged
        if (!this.isDragging && this.ball) {
            this.ball.dx += -normalizedGamma * this.gravityXMultiplier; // Negative because gamma increases to the right
            this.ball.dy += normalizedBeta * this.gravityYMultiplier; // Positive because beta increases forward
        }
    }

    /**
     * Set the drag state of the ball.
     * @param {boolean} isDragging - Whether the ball is being dragged.
     */
    setDragState(isDragging) {
        this.isDragging = isDragging;
    }
}

// Example usage:
const gravityManager = new GravityManager();










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




function createObjectFromData(data) {
    const evaluateValue = (value) => {
        if (typeof value === "string") {
            if (value.endsWith("%")) {
                const percent = parseFloat(value);
                return value.includes("h")
                    ? canvas.height * (percent / 100)
                    : canvas.width * (percent / 100);
            } else if (value.endsWith("p")) {
                const degrees = parseFloat(value);
                return degrees * DEGREES_TO_RADIANS_MULTIPLIER;
            } else {
                return parseFloat(value) || null;
            }
        }
        return value;
    };

    const generateIdentifier = (color, type) => `${color || "unknown"}_${type}`;

    switch (data.type) {
        case "ball":
            return new Ball(
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.radius),
                evaluateValue(data.dx),
                evaluateValue(data.dy),
                evaluateValue(data.friction),
                data.color,
                data.identifier.trim() || generateIdentifier(data.color, "ball")
            );

        case "oval":
            return new Oval(
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.radiusX),
                evaluateValue(data.radiusY),
                evaluateValue(data.dx),
                evaluateValue(data.dy),
                evaluateValue(data.friction),
                data.color,
                data.identifier.trim() || generateIdentifier(data.color, "oval"),
                evaluateValue(data.rotation)
            );

        case "triangle":
            return new Triangle(
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.size),
                evaluateValue(data.dx),
                evaluateValue(data.dy),
                evaluateValue(data.rotation),
                evaluateValue(data.friction),
                data.color,
                data.identifier.trim() || generateIdentifier(data.color, "triangle")
            );

        case "rectangle":
            return new Rectangle(
                evaluateValue(data.x),
                evaluateValue(data.y),
                evaluateValue(data.width),
                evaluateValue(data.height),
                evaluateValue(data.dx),
                evaluateValue(data.dy),
                evaluateValue(data.rotation),
                evaluateValue(data.friction),
                data.color,
                data.identifier.trim() || generateIdentifier(data.color, "rectangle")
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



/**
 * Handles collisions between a ball and other objects.
 */
function handleCollision4Ball(ball, object) {
    if (ball.dy === 0 && ball.dx === 0) return; // Early exit for stationary balls

    switch (object.type) {
        case "rectangle":
            if (object.identifier === "floor" && !hasFloor) return;
            const rectCollision = isBallFarFromPolygon(ball, object.transformedVertices);
            if (!rectCollision.isFar) resolveCollision(ball, rectCollision.closestPoint, rectCollision.distanceSquared);
            break;

        case "triangle":
            const triCollision = isBallFarFromPolygon(ball, object.transformedVertices);
            if (!triCollision.isFar) resolveCollision(ball, triCollision.closestPoint, triCollision.distanceSquared);
            break;

        case "ball":
            resolveBallBallCollision(ball, object);
            break;

        case "oval":
            resolveBallOvalCollision(ball, object);
            break;

        default:
            console.warn(`Unhandled object type: ${object.type}`);
    }
}

/**
 * Checks if a ball is far from a polygon.
 */
function isBallFarFromPolygon(ball, polygonVertices) {
    let closestPoint = null;
    let minDistanceSquared = Infinity;

    for (let i = 0; i < polygonVertices.length; i++) {
        const start = polygonVertices[i];
        const end = polygonVertices[(i + 1) % polygonVertices.length];
        const pointClosest = getClosestPointOnLine({ x: ball.x, y: ball.y }, start, end);
        const distanceSquared = getDistanceSquared(ball, pointClosest);

        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = pointClosest;
        }
    }

    for (const vertex of polygonVertices) {
        const distanceSquared = getDistanceSquared(ball, vertex);
        if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            closestPoint = vertex;
        }
    }

    return {
        isFar: minDistanceSquared > ball.radius * ball.radius,
        closestPoint,
        distanceSquared: minDistanceSquared
    };
}

/**
 * Resolves a collision between a ball and any shape with straight sides.
 */
function resolveCollision(ball, closestPoint, distanceSquared) {
    const radiusSquared = ball.radius * ball.radius;
    if (distanceSquared > radiusSquared) return;

    const distance = Math.sqrt(distanceSquared);
    const overlap = ball.radius - distance;

    const normal = normalizeVector(ball.x - closestPoint.x, ball.y - closestPoint.y);
    ball.updatePosition(normal.x * overlap, normal.y * overlap);

    const relativeVelocityX = ball.dx;
    const relativeVelocityY = ball.dy;

    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;
    if (dotProduct > 0) return;

    const impulse = -2 * dotProduct * bounceFactor;
    ball.updateMovement(impulse * normal.x, impulse * normal.y);
}




// ======================
// 10. other collision helper
// ======================




/**
 * Resolves a collision between two balls.
 */
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

/**
 * Resolves a collision between a ball and an oval.
 */
function resolveBallOvalCollision(ball, oval) {
    const closestPoint = getClosestPointOnOval(ball, oval);
    const distanceSquared = getDistanceSquared(ball, closestPoint);

    const localClosest = transformToLocalCoordinates(closestPoint, oval);
    const effectiveRadius = Math.sqrt((localClosest.x / oval.radiusX) ** 2 + (localClosest.y / oval.radiusY) ** 2);

    const radiusSumSquared = (ball.radius + effectiveRadius) ** 2;
    if (distanceSquared > radiusSumSquared) return;

    resolveCollision(ball, closestPoint, distanceSquared);
}

/**
 * Finds the closest point on a rotated oval to a given point.
 */
function getClosestPointOnOval(ball, oval) {
    const dx = ball.x - oval.x;
    const dy = ball.y - oval.y;
    const cosTheta = Math.cos(-oval.rotation);
    const sinTheta = Math.sin(-oval.rotation);

    const localX = dx * cosTheta - dy * sinTheta;
    const localY = dx * sinTheta + dy * cosTheta;

    const normalizedX = localX / oval.radiusX;
    const normalizedY = localY / oval.radiusY;

    const t = solveEllipseProjection(normalizedX, normalizedY);
    const closestLocalX = t * oval.radiusX;
    const closestLocalY = Math.sqrt(Math.max(0, 1 - t * t)) * oval.radiusY * Math.sign(normalizedY);

    const cosRot = Math.cos(oval.rotation);
    const sinRot = Math.sin(oval.rotation);

    return {
        x: oval.x + closestLocalX * cosRot - closestLocalY * sinRot,
        y: oval.y + closestLocalX * sinRot + closestLocalY * cosRot
    };
}

/**
 * Solves for the parameter t that projects a point onto the ellipse boundary.
 */
function solveEllipseProjection(x, y) {
    let t = 0.5;
    let prevT = t;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const fx = t * t + (y * y) / (1 - t * t) - 1;
        const dfx = 2 * t + (2 * y * y * t) / Math.pow(1 - t * t, 2);

        if (Math.abs(dfx) < TOLERANCE) break;
        t = t - fx / dfx;

        if (Math.abs(t - prevT) < TOLERANCE) break;
        prevT = t;
    }

    return Math.max(-1, Math.min(1, t));
}

/**
 * Transforms a point into the oval's local coordinate system.
 */
function transformToLocalCoordinates(point, oval) {
    const dx = point.x - oval.x;
    const dy = point.y - oval.y;
    const cosTheta = Math.cos(-oval.rotation);
    const sinTheta = Math.sin(-oval.rotation);

    return {
        x: dx * cosTheta - dy * sinTheta,
        y: dx * sinTheta + dy * cosTheta
    };
}




// ======================
// 13. Other Vector stuff
// ======================

/**
 * Finds the closest point on a line segment to a given point.
 */
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

/**
 * Normalizes a vector.
 */
function normalizeVector(x, y) {
    const magnitude = Math.sqrt(x * x + y * y);
    return magnitude === 0 ? { x: 0, y: 0 } : { x: x / magnitude, y: y / magnitude };
}

/**
 * Calculates the squared distance between two points.
 */
function getDistanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}