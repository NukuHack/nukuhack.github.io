


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


/*
        //this.angle = 0;
        //this.speed = 0;
        //this.rotationSpeed = 0;

    //speed = Math.sqrt(dx * dx + dy * dy)
    //angle = Math.atan2(dy, dx)
    applyForce(forceAngle, forceMagnitude) {
        this.speed += forceMagnitude;
        this.angle = (this.angle + forceAngle) % (2 * Math.PI); // Update angle
        this.updateVelocityFromSpeedAndAngle();
    }

    updateVelocityFromSpeedAndAngle() {
        this.dx = this.speed * Math.cos(this.angle);
        this.dy = this.speed * Math.sin(this.angle);
    }
*/


class GameObject {
	/**
	 * Creates a new game object with initial properties.
	 * @param {number} x - Initial x position.
	 * @param {number} y - Initial y position.
	 * @param {number} dx - Initial horizontal velocity.
	 * @param {number} dy - Initial vertical velocity.
	 * @param {number} friction - Friction coefficient (0 to 1).
	 * @param {string} color - Color of the object.
	 * @param {string} identifier - Identifier for the object.
	 */
	constructor(x = 0, y = 0, dx = 0, dy = 0, friction = 0.2, color = "purple", identifier = "default") {
		if (![x, y].every(val => typeof val === 'number')) {
			throw new Error('Position values must be numbers.');
		}
		if (![dx, dy].every(val => typeof val === 'number')) {
			throw new Error('Velocity values must be numbers.');
		}
		if (friction < 0 || friction > 1) {
			throw new Error('Friction must be between 0 and 1.');
		}

		this.x = x;
		this.y = y;
		this.dx = dx;
		this.dy = dy;
		this.friction = friction;
		this.color = color;
		this.identifier = identifier;
		this.isActive = true; // Tracks whether the object is active
	}

	/**
	 * Handles user interaction events.
	 * @param {Event} event - The event object.
	 */
	handleEvent(event) {
		if (event.type === "click" && typeof this.onClick === "function") {
			this.onClick(); // Call the onClick handler if defined
		}
	}

	/**
	 * Teleports the object to a random position within the canvas.
	 */
	randomTeleport() {
		this.x = Math.random() * canvas.width;
		this.y = Math.random() * canvas.height;
	}

	/**
	 * Activates the object.
	 */
	activate() {
		this.isActive = true;
	}

	/**
	 * Deactivates the object.
	 */
	deactivate() {
		this.isActive = false;
	}

	/**
	 * Applies friction to reduce velocity.
	 */
	applyFriction() {
		this.dx *= 1 - this.friction;
		this.dy *= 1 - this.friction;
	}

	/**
	 * Updates movement based on external forces.
	 * @param {number} [currentXMov=0] - Horizontal movement adjustment.
	 * @param {number} [currentYMov=0] - Vertical movement adjustment.
	 */
	updateMovement(currentXMov = 0, currentYMov = 0) {
		this.dx += currentXMov;
		this.dy += currentYMov;
	}
	updateMovX(currentXMov = 0) {
		this.dx += currentXMov;
	}
	updateMovY(currentYMov = 0) {
		this.dy += currentYMov;
	}

	/**
	 * Applies gravity to vertical velocity.
	 */
	applyGravity() {
		this.dy += currentGravity; // Assumes `currentGravity` is defined globally
	}

	/**
	 * Sets movement directly.
	 * @param {number|null} [currentXMov=null] - New horizontal velocity.
	 * @param {number|null} [currentYMov=null] - New vertical velocity.
	 */
	setMovement(currentXMov = null, currentYMov = null) {
		if (currentXUpdate !== null) {
			this.dx = currentXUpdate;
			this.dy = currentYUpdate;
		}
	}
	setMovX(currentXMov = null) {
		this.dx = currentXMov ?? this.dx;
	}
	setMovY(currentYMov = null) {
		this.dy = currentYMov ?? this.dy;
	}

	/**
	 * Updates position based on velocity or external updates.
	 * @param {number|null} [currentXUpdate=null] - Horizontal position adjustment.
	 * @param {number|null} [currentYUpdate=null] - Vertical position adjustment.
	 */
	updatePosition(currentXUpdate = null, currentYUpdate = null) {
		if (currentXUpdate === null) {
			this.x += this.dx;
			this.y += this.dy;
		} else {
			this.x += currentXUpdate;
			this.y += currentYUpdate;
		}
	}
	updatePosX(currentXUpdate = null) {
		this.x += currentXUpdate ?? this.dx;
	}
	updatePosY(currentYUpdate = null) {
		this.y += currentYUpdate ?? this.dy;
	}

	setPosition(currentXUpdate = null, currentYUpdate = null) {
		if (currentXUpdate !== null) {
			this.x = currentXUpdate;
			this.y = currentYUpdate;
		}
	}
	setPosX(currentXUpdate = null) {
		this.x = currentXUpdate ?? this.x;
	}
	setPosY(currentYUpdate = null) {
		this.y = currentYUpdate ?? this.y;
	}

	/**
	 * Default update method that calls all sub-methods.
	 */
	updateAll() {
		this.applyFriction();
		this.applyGravity();
		this.updatePosition();
	}

	/**
	 * Reverses the horizontal velocity with friction and bounce applied.
	 */
	reverseHorizontalVelocity() {
		this.dx = -this.dx * bounceFactor * 0.7;
	}

	/**
	 * Reverses the vertical velocity with friction and bounce applied.
	 */
	reverseVerticalVelocity() {
		this.dy = -this.dy * bounceFactor * 0.7;
	}

	/**
	 * Abstract method for drawing.
	 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
	 */
	draw(ctx) {
		throw new Error('draw() method must be implemented by subclasses.');
	}
}

class Ellipse extends GameObject {
	/**
	 * Creates a new ellipse object with initial properties.
	 * @param {number} x - Initial x position.
	 * @param {number} y - Initial y position.
	 * @param {number} dx - Initial horizontal velocity.
	 * @param {number} dy - Initial vertical velocity.
	 * @param {number} friction - Friction coefficient (0 to 1).
	 * @param {string} color - Color of the ellipse.
	 * @param {string} identifier - Identifier for the ellipse.
	 */
	constructor(x = 0, y = 0, dx = 0, dy = 0, friction = 0.2, color = "purple", identifier = "default") {
		super(x, y, dx, dy, friction, color, identifier);
		this.type = "ellipse";
		this.startAngle = 0; // Default start angle
		this.endAngle = Math.PI * 2; // Default end angle
	}
}

class Ball extends Ellipse {
	/**
	 * Creates a new ball object with initial properties.
	 * @param {number} x - Initial x position.
	 * @param {number} y - Initial y position.
	 * @param {number} radius - Radius of the ball.
	 * @param {number} dx - Initial horizontal velocity.
	 * @param {number} dy - Initial vertical velocity.
	 * @param {number} friction - Friction coefficient (0 to 1).
	 * @param {string} color - Color of the ball.
	 * @param {string} identifier - Identifier for the ball.
	 */
	constructor(x = 0, y = 0, radius = 5, dx = 0, dy = 0, friction = 0.2, color = "red", identifier = "default") {
		super(x, y, dx, dy, friction, color, identifier);
		if (typeof radius !== 'number' || radius <= 0) {
			throw new Error('Radius must be a positive number.');
		}
		this.radius = radius;
		this.type = "ball";
	}

	draw(ctx) {
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, this.startAngle, this.endAngle);
		ctx.fillStyle = this.color;
		ctx.fill();
		ctx.closePath();
	}

	/**
	 * Handles edge collisions with the canvas boundaries.
	 * @param {number} width - Width of the canvas.
	 * @param {number} height - Height of the canvas.
	 */
	handleEdgeCollision(width, height) {
		this.checkHorizontalCollision(width);
		this.checkVerticalCollision(height);
	}

	/**
	 * Checks for horizontal collisions and updates accordingly.
	 * @param {number} width - Width of the canvas.
	 */
	checkHorizontalCollision(width) {
		// Check if the ball hits the left or right boundary
		if (this.x - this.radius <= 0 && this.dx < 0) {
			this.setPosX(this.radius); // Prevent overlap with the left boundary
			this.reverseHorizontalVelocity();
		} else if (this.x + this.radius >= width && this.dx > 0) {
			this.setPosX(width - this.radius); // Prevent overlap with the right boundary
			this.reverseHorizontalVelocity();
		}
	}

	/**
	 * Checks for vertical collisions and updates accordingly.
	 * @param {number} height - Height of the canvas.
	 */
	checkVerticalCollision(height) {
		// Check if the ball hits the top or bottom boundary
		if (this.y - this.radius <= 0 && this.dy < 0) {
			this.setPosY(this.radius); // Prevent overlap with the top boundary
			this.reverseVerticalVelocity();
		} else if (this.y + this.radius >= height && this.dy > 0) {
			this.setPosY(height - this.radius); // Prevent overlap with the bottom boundary
			this.reverseVerticalVelocity();
		}
	}


	updateAll() {
		if (this.identifier === "main_ball") {
			if (!isDragging) {
				this.updatePosition();
			} else {
				this.updatePosY();
			}
		} else {
			this.updatePosition();
		}
		this.applyGravity();
		this.applyFriction();
		this.handleEdgeCollision(canvas.width, canvas.height);
	}
}

class Oval extends Ellipse {
	/**
	 * Creates a new oval object with initial properties.
	 * @param {number} x - Initial x position (center of the oval).
	 * @param {number} y - Initial y position (center of the oval).
	 * @param {number} radiusX - Horizontal radius of the oval.
	 * @param {number} radiusY - Vertical radius of the oval.
	 * @param {number} dx - Initial horizontal velocity.
	 * @param {number} dy - Initial vertical velocity.
	 * @param {number} friction - Friction coefficient (0 to 1).
	 * @param {string} color - Color of the oval.
	 * @param {string} identifier - Identifier for the oval.
	 * @param {number} rotation - Initial rotation angle in radians.
	 */
	constructor(x = 0, y = 0, radiusX = 20, radiusY = 10, dx = 0, dy = 0, friction = 0.2, color = "green", identifier = "default", rotation = 0) {
		super(x, y, dx, dy, friction, color, identifier);
		if (typeof radiusX !== 'number' || radiusX <= 0) {
			throw new Error('Horizontal radius must be a positive number.');
		}
		if (typeof radiusY !== 'number' || radiusY <= 0) {
			throw new Error('Vertical radius must be a positive number.');
		}
		this.radiusX = radiusX;
		this.radiusY = radiusY;
		this.rotation = rotation;
		this.type = "oval";
	}

	draw(ctx) {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		ctx.scale(this.radiusX / this.radiusY, 1);
		ctx.beginPath();
		ctx.arc(0, 0, this.radiusY, this.startAngle, this.endAngle);
		ctx.restore();
		ctx.fillStyle = this.color;
		ctx.fill();
		ctx.closePath();
	}

	updateAll() {
		this.updatePosition();
		this.applyGravity();
		this.applyFriction();
		this.handleEdgeCollision(canvas.width, canvas.height);
	}
}

/**
 * Polygon class represents a generic polygon shape.
 * It extends GameObject and includes logic for rotation and drawing.
 */
class Polygon extends GameObject {
	/**
	 * Constructor for the Polygon class.
	 * @param {number} x - The x-coordinate of the polygon's center.
	 * @param {number} y - The y-coordinate of the polygon's center.
	 * @param {number} dx - Horizontal velocity.
	 * @param {number} dy - Vertical velocity.
	 * @param {number} rotation - Rotation angle in radians (default: 0).
	 * @param {number} friction - Friction coefficient.
	 * @param {string} color - Color of the polygon.
	 * @param {string} identifier - Identifier for the polygon.
	 * @param {Array<{x: number, y: number}>} localVertices - Vertices in local space (relative to the center).
	 */
	constructor(x, y, dx, dy, rotation = 0, friction, color, identifier, localVertices) {
		super(x, y, dx, dy, friction, color, identifier);

		this.localVertices = localVertices; // Vertices in local space (relative to the center)
		this.rotation = rotation || 0; // Rotation angle in radians
		this.type = "polygon"; // Default type is "polygon"

		// Initialize transformed vertices as an array of objects with x and y set to 0
		this.transformedVertices = localVertices.map(() => ({ x: 0, y: 0 }));
	}

	/**
	 * Updates the transformed vertices based on rotation and position.
	 * This method applies rotation and translation to the local vertices.
	 */
	updateVertices() {
		const cosTheta = Math.cos(this.rotation); // Cosine of the rotation angle
		const sinTheta = Math.sin(this.rotation); // Sine of the rotation angle

		// Iterate through each vertex and apply rotation and translation
		for (let i = 0; i < this.localVertices.length; i++) {
			const local = this.localVertices[i]; // Local vertex
			const transformed = this.transformedVertices[i]; // Transformed vertex

			// Apply rotation using the rotation matrix
			transformed.x = local.x * cosTheta - local.y * sinTheta;
			transformed.y = local.x * sinTheta + local.y * cosTheta;

			// Apply translation by adding the polygon's position
			transformed.x += this.x;
			transformed.y += this.y;
		}
	}

	/**
	 * Draws the polygon on the canvas.
	 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
	 */
	draw(ctx) {
		this.updateVertices(); // Ensure vertices are updated before drawing

		ctx.beginPath(); // Start a new path
		ctx.moveTo(this.transformedVertices[0].x, this.transformedVertices[0].y); // Move to the first vertex

		// Draw lines between consecutive vertices
		for (let i = 1; i < this.transformedVertices.length; i++) {
			ctx.lineTo(this.transformedVertices[i].x, this.transformedVertices[i].y);
		}

		ctx.closePath(); // Close the path by connecting the last vertex to the first
		ctx.fillStyle = this.color; // Set the fill color
		ctx.fill(); // Fill the polygon
	}
}

/**
 * Triangle class represents an equilateral triangle.
 * It extends Polygon and precomputes the vertices for an equilateral triangle.
 */
class Triangle extends Polygon {
	/**
	 * Constructor for the Triangle class.
	 * @param {number} x - The x-coordinate of the triangle's center.
	 * @param {number} y - The y-coordinate of the triangle's center.
	 * @param {number} size - The size of the triangle (length of one side).
	 * @param {number} dx - Horizontal velocity.
	 * @param {number} dy - Vertical velocity.
	 * @param {number} rotation - Rotation angle in radians.
	 * @param {number} friction - Friction coefficient.
	 * @param {string} color - Color of the triangle.
	 * @param {string} identifier - Identifier for the triangle.
	 */
	constructor(x, y, size = 10, dx, dy, rotation, friction, color, identifier) {
		// Precompute the height of the equilateral triangle using the formula: height = (sqrt(3) / 2) * size
		const height = (Math.sqrt(3) * 0.5) * size;

		// Precompute the vertices in local space (relative to the center)
		const localVertices = [
			{ x: 0, y: -height }, // Top vertex
			{ x: -size, y: height }, // Bottom-left vertex
			{ x: size, y: height } // Bottom-right vertex
		];

		super(x, y, dx, dy, rotation, friction, color, identifier, localVertices);

		this.type = "triangle"; // Override type
		this.height = height; // Store the height for future reference
		this.size = size; // Store the size for future reference
	}
}

/**
 * Rectangle class represents a rectangle shape.
 * It extends Polygon and precomputes the vertices for a rectangle.
 */
class Rectangle extends Polygon {
	/**
	 * Constructor for the Rectangle class.
	 * @param {number} x - The x-coordinate of the rectangle's center.
	 * @param {number} y - The y-coordinate of the rectangle's center.
	 * @param {number} width - The width of the rectangle.
	 * @param {number} height - The height of the rectangle.
	 * @param {number} dx - Horizontal velocity.
	 * @param {number} dy - Vertical velocity.
	 * @param {number} rotation - Rotation angle in radians.
	 * @param {number} friction - Friction coefficient.
	 * @param {string} color - Color of the rectangle.
	 * @param {string} identifier - Identifier for the rectangle.
	 */
	constructor(x, y, width = 10, height = 10, dx, dy, rotation, friction, color, identifier) {
		// Precompute the vertices in local space (relative to the center)
		const localVertices = [
			{ x: 0, y: 0 }, // Top-left
			{ x: width, y: 0 }, // Top-right
			{ x: width, y: height }, // Bottom-right
			{ x: 0, y: height } // Bottom-left
		];

		super(x, y, dx, dy, rotation, friction, color, identifier, localVertices);

		this.type = "rectangle"; // Override type
		this.width = width; // Store the width for future reference
		this.height = height; // Store the height for future reference
	}
}

