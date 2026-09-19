import gameObjectsData from '../json/gameObjects.json';

const TOLERANCE = 1e-6; // Tolerance for numerical convergence
const MAX_ITERATIONS = 10; // Maximum iterations for numerical solver
const DEGREES_TO_RADIANS_MULTIPLIER = Math.PI / 180;

/**
 * Builds a fresh, self-contained physics/animation engine bound to `canvas`.
 * Call `.start()` once mounted, `.destroy()` on unmount.
 *
 * options:
 *   onContextMenu(x, y) — called instead of showing a raw DOM context menu;
 *     the React component owns rendering the menu and calls back into the
 *     engine's resetBall()/toggleFloor()/toggleGravity()/toggleRealisticGravity().
 */
export function createAnimationEngine(canvas, options = {}) {
  const ctx = canvas.getContext('2d');

  // ── Physics constants & mutable state (were page-level globals originally) ──
  const gravity = 0.1;
  const bounceFactor = 0.99; // Adjust bounce factor (0.8 = 80% energy retained)
  let hasFloor = true;
  let currentGravity = gravity;
  let paused = false;
  let isDragging = false;
  let mouseDownTime = 0;
  let frameCount = 0;
  let fps = 0;
  let fpsTimeoutId = null;
  let prefersDark = true;
  let gameObjectManager = null;
  let mainBall = null;
  let floorRect = null;
  let rafId = null;
  let destroyed = false;

  // ======================
  // Body classes
  // ======================

  class GameObjectManager {
    constructor() {
      this.objects = [];
    }
    addObject(object) {
      this.objects.push(object);
    }
    removeObject(identifier) {
      this.objects = this.objects.filter((obj) => obj.identifier !== identifier);
    }
    draw(ctx) {
      this.objects.forEach((obj) => {
        if (obj.draw) obj.draw(ctx);
      });
    }
    drawConditionally(ctx, hasFloor) {
      this.objects.forEach((obj) => {
        if (!hasFloor && obj.identifier === 'floor') return;
        if (obj.draw) obj.draw(ctx);
      });
    }
    getAllObjects() {
      return this.objects;
    }
    getObjectByIdentifier(identifier) {
      return this.objects.find((obj) => obj.identifier === identifier);
    }
    handleCollisions4Ball(ball) {
      this.objects.forEach((object) => {
        if (object !== ball) {
          handleCollision4Ball(ball, object);
        }
      });
    }
  }

  class GameObject {
    constructor(x = 0, y = 0, dx = 0, dy = 0, friction = 0.2, color = 'purple', identifier = 'default') {
      if (![x, y].every((val) => typeof val === 'number')) {
        throw new Error('Position values must be numbers.');
      }
      if (![dx, dy].every((val) => typeof val === 'number')) {
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
      this.isActive = true;
    }

    handleEvent(event) {
      if (event.type === 'click' && typeof this.onClick === 'function') {
        this.onClick();
      }
    }

    randomTeleport() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
    }

    activate() {
      this.isActive = true;
    }
    deactivate() {
      this.isActive = false;
    }

    applyFriction() {
      this.dx *= 1 - this.friction;
      this.dy *= 1 - this.friction;
    }

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

    applyGravity() {
      this.dy += currentGravity;
    }

    setMovement(currentXUpdate = null, currentYUpdate = null) {
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

    updateAll() {
      this.applyFriction();
      this.applyGravity();
      this.updatePosition();
    }

    reverseHorizontalVelocity() {
      this.dx = -this.dx * bounceFactor * 0.7;
    }
    reverseVerticalVelocity() {
      this.dy = -this.dy * bounceFactor * 0.7;
    }

    draw() {
      throw new Error('draw() method must be implemented by subclasses.');
    }
  }

  class Ellipse extends GameObject {
    constructor(x = 0, y = 0, dx = 0, dy = 0, friction = 0.2, color = 'purple', identifier = 'default') {
      super(x, y, dx, dy, friction, color, identifier);
      this.type = 'ellipse';
      this.startAngle = 0;
      this.endAngle = Math.PI * 2;
    }
  }

  class Ball extends Ellipse {
    constructor(x = 0, y = 0, radius = 5, dx = 0, dy = 0, friction = 0.2, color = 'red', identifier = 'default') {
      super(x, y, dx, dy, friction, color, identifier);
      if (typeof radius !== 'number' || radius <= 0) {
        throw new Error('Radius must be a positive number.');
      }
      this.radius = radius;
      this.type = 'ball';
      this.mass = radius * radius * 0.25;
    }

    draw(ctx) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, this.startAngle, this.endAngle);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.closePath();
    }

    handleEdgeCollision(width, height) {
      this.checkHorizontalCollision(width);
      this.checkVerticalCollision(height);
    }

    checkHorizontalCollision(width) {
      if (this.x - this.radius <= 0 && this.dx < 0) {
        this.setPosX(this.radius);
        this.reverseHorizontalVelocity();
      } else if (this.x + this.radius >= width && this.dx > 0) {
        this.setPosX(width - this.radius);
        this.reverseHorizontalVelocity();
      }
    }

    checkVerticalCollision(height) {
      if (this.y - this.radius <= 0 && this.dy < 0) {
        this.setPosY(this.radius);
        this.reverseVerticalVelocity();
      } else if (this.y + this.radius >= height && this.dy > 0) {
        this.setPosY(height - this.radius);
        this.reverseVerticalVelocity();
      }
    }

    updateAll() {
      if (this.identifier === 'main_ball') {
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
    constructor(x = 0, y = 0, radiusX = 20, radiusY = 10, dx = 0, dy = 0, friction = 0.2, color = 'green', identifier = 'default', rotation = 0) {
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
      this.type = 'oval';
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

  class Polygon extends GameObject {
    constructor(x, y, dx, dy, rotation = 0, friction, color, identifier, localVertices) {
      super(x, y, dx, dy, friction, color, identifier);
      this.localVertices = localVertices;
      this.rotation = rotation || 0;
      this.type = 'polygon';
      this.transformedVertices = localVertices.map(() => ({ x: 0, y: 0 }));
    }

    updateVertices() {
      const cosTheta = Math.cos(this.rotation);
      const sinTheta = Math.sin(this.rotation);

      for (let i = 0; i < this.localVertices.length; i++) {
        const local = this.localVertices[i];
        const transformed = this.transformedVertices[i];

        transformed.x = local.x * cosTheta - local.y * sinTheta;
        transformed.y = local.x * sinTheta + local.y * cosTheta;

        transformed.x += this.x;
        transformed.y += this.y;
      }
    }

    draw(ctx) {
      this.updateVertices();

      ctx.beginPath();
      ctx.moveTo(this.transformedVertices[0].x, this.transformedVertices[0].y);

      for (let i = 1; i < this.transformedVertices.length; i++) {
        ctx.lineTo(this.transformedVertices[i].x, this.transformedVertices[i].y);
      }

      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  class Triangle extends Polygon {
    constructor(x, y, size = 10, dx, dy, rotation, friction, color, identifier) {
      const height = Math.sqrt(3) * 0.5 * size;
      const localVertices = [
        { x: 0, y: -height },
        { x: -size, y: height },
        { x: size, y: height },
      ];
      super(x, y, dx, dy, rotation, friction, color, identifier, localVertices);
      this.type = 'triangle';
      this.height = height;
      this.size = size;
    }
  }

  class Rectangle extends Polygon {
    constructor(x, y, width = 10, height = 10, dx, dy, rotation, friction, color, identifier) {
      const localVertices = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];
      super(x, y, dx, dy, rotation, friction, color, identifier, localVertices);
      this.type = 'rectangle';
      this.width = width;
      this.height = height;
    }
  }

  // ======================
  // Device-orientation gravity
  // ======================

  class GravityManager {
    constructor() {
      this.isSupported = !!window.DeviceOrientationEvent;
      this.isListening = false;
      this.isDragging = false;
      this._boundApplyGravity = null;
    }

    start(ball, gravityXMultiplier = 0.05, gravityYMultiplier = 0.05) {
      if (!this.isSupported) {
        console.error('DeviceOrientation API is not supported on this device.');
        return;
      }
      if (this.isListening) {
        console.warn('Already listening for device orientation events.');
        return;
      }

      this.ball = ball;
      this.gravityXMultiplier = gravityXMultiplier;
      this.gravityYMultiplier = gravityYMultiplier;
      this.isListening = true;
      this._boundApplyGravity = (event) => this.applyGravity(event);
      window.addEventListener('deviceorientation', this._boundApplyGravity, true);
    }

    stop() {
      if (!this.isListening) {
        console.warn('Not currently listening for device orientation events.');
        return;
      }
      this.isListening = false;
      if (this._boundApplyGravity) window.removeEventListener('deviceorientation', this._boundApplyGravity, true);
    }

    applyGravity(event) {
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;

      const normalizedBeta = Math.min(Math.max(beta / 180, -1), 1);
      const normalizedGamma = Math.min(Math.max(gamma / 90, -1), 1);

      if (!this.isDragging && this.ball) {
        this.ball.dx += -normalizedGamma * this.gravityXMultiplier;
        this.ball.dy += normalizedBeta * this.gravityYMultiplier;
      }
    }

    setDragState(isDragging) {
      this.isDragging = isDragging;
    }
  }

  const gravityManager = new GravityManager();

  // ======================
  // FPS counter
  // ======================

  function updateFPS() {
    frameCount++;
    if (!fpsTimeoutId) {
      fpsTimeoutId = setTimeout(() => {
        fps = frameCount * 2;
        frameCount = 0;
        fpsTimeoutId = null;
      }, 500);
    }
  }

  function drawFPS() {
    ctx.fillStyle = prefersDark ? 'black' : 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`FPS: ${fps}`, canvas.width / 30, canvas.height / 15);
  }

  // ======================
  // Canvas helpers
  // ======================

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawPausedText(ctx, canvas) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.font = `${Math.min(canvas.width / 10, 48)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'Paused';
    const x = canvas.width * 0.5;
    const y = canvas.height * 0.5;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  // ======================
  // Ball movement (pointer & touch)
  // ======================

  function getEventCoordinates(event) {
    return event.touches && event.touches.length > 0
      ? { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY }
      : { clientX: event.clientX, clientY: event.clientY };
  }

  function handleScreenEvent(event, type, ball) {
    const { clientX, clientY } = getEventCoordinates(event);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    void canvasY;

    if (type === 'touchstart' || (type === 'mousedown' && event.button === 0)) {
      isDragging = true;
      mouseDownTime = Date.now();
      gravityManager.setDragState(true);
    } else if (isDragging && (type === 'touchmove' || type === 'mousemove')) {
      ball.setPosX(canvasX);
      ball.setMovX(0);
    } else if (type === 'touchend' || (type === 'mouseup' && event.button === 0)) {
      ball.setMovX(0);
      isDragging = false;
      gravityManager.setDragState(false);

      const clickDuration = Date.now() - mouseDownTime;
      if (clickDuration < 100) {
        ball.setMovY(-5);
      }
    }
  }

  // ======================
  // Animation loop
  // ======================

  function animate() {
    if (destroyed) return;
    if (!paused) {
      updateFPS();
      clearCanvas();
      mainBall.updateAll();
      gameObjectManager.handleCollisions4Ball(mainBall);
      gameObjectManager.drawConditionally(ctx, hasFloor);
      drawFPS();
    } else {
      drawPausedText(ctx, canvas);
    }
    rafId = requestAnimationFrame(animate);
  }

  // ======================
  // Scene building (was a runtime fetch of json/gameObjects.json; that file
  // is now a bundled static asset, so this is synchronous)
  // ======================

  function createObjectFromData(data) {
    const evaluateValue = (value) => {
      if (typeof value === 'string') {
        if (value.endsWith('%')) {
          const percent = parseFloat(value);
          return value.includes('h') ? canvas.height * (percent / 100) : canvas.width * (percent / 100);
        } else if (value.endsWith('p')) {
          const degrees = parseFloat(value);
          return degrees * DEGREES_TO_RADIANS_MULTIPLIER;
        } else {
          return parseFloat(value) || null;
        }
      }
      return value;
    };

    const generateIdentifier = (color, type) => `${color || 'unknown'}_${type}`;

    switch (data.type) {
      case 'ball':
        return new Ball(
          evaluateValue(data.x),
          evaluateValue(data.y),
          evaluateValue(data.radius),
          evaluateValue(data.dx),
          evaluateValue(data.dy),
          evaluateValue(data.friction),
          data.color,
          data.identifier.trim() || generateIdentifier(data.color, 'ball')
        );

      case 'oval':
        return new Oval(
          evaluateValue(data.x),
          evaluateValue(data.y),
          evaluateValue(data.radiusX),
          evaluateValue(data.radiusY),
          evaluateValue(data.dx),
          evaluateValue(data.dy),
          evaluateValue(data.friction),
          data.color,
          data.identifier.trim() || generateIdentifier(data.color, 'oval'),
          evaluateValue(data.rotation)
        );

      case 'triangle':
        return new Triangle(
          evaluateValue(data.x),
          evaluateValue(data.y),
          evaluateValue(data.size),
          evaluateValue(data.dx),
          evaluateValue(data.dy),
          evaluateValue(data.rotation),
          evaluateValue(data.friction),
          data.color,
          data.identifier.trim() || generateIdentifier(data.color, 'triangle')
        );

      case 'rectangle':
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
          data.identifier.trim() || generateIdentifier(data.color, 'rectangle')
        );

      default:
        throw new Error(`Unknown object type: ${data.type}`);
    }
  }

  function buildGameObjectManager(jsonData) {
    const manager = new GameObjectManager();
    jsonData.objects.forEach((objectData) => {
      manager.addObject(createObjectFromData(objectData));
    });
    return manager;
  }

  // ======================
  // Collision
  // ======================

  function handleCollision4Ball(ball, object) {
    if (ball.dy === 0 && ball.dx === 0) return;

    switch (object.type) {
      case 'rectangle': {
        if (object.identifier === 'floor' && !hasFloor) return;
        const rectCollision = isBallFarFromPolygon(ball, object.transformedVertices);
        if (!rectCollision.isFar) resolveCollision(ball, rectCollision.closestPoint, object, rectCollision.distanceSquared);
        break;
      }
      case 'triangle': {
        const triCollision = isBallFarFromPolygon(ball, object.transformedVertices);
        if (!triCollision.isFar) resolveCollision(ball, triCollision.closestPoint, object, triCollision.distanceSquared);
        break;
      }
      case 'ball':
        resolveBallBallCollision(ball, object);
        break;
      case 'oval':
        resolveBallOvalCollision(ball, object);
        break;
      default:
        console.warn(`Unhandled object type: ${object.type}`);
    }
  }

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
      distanceSquared: minDistanceSquared,
    };
  }

  function resolveCollision(ball, closestPoint, object, distanceSquared) {
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

    const impulse = -2 * dotProduct * bounceFactor * (1 - ball.friction) * (1 - object.friction);
    ball.updateMovement(impulse * normal.x, impulse * normal.y);
  }

  function resolveBallBallCollision(ball, object) {
    const distanceSquared = getDistanceSquared(ball, object);
    const radiusSum = ball.radius + object.radius;

    const epsilon = 0.0001;
    if (distanceSquared > radiusSum * radiusSum + epsilon) return;

    const distance = Math.sqrt(distanceSquared);

    const normal = {
      x: (ball.x - object.x) / distance,
      y: (ball.y - object.y) / distance,
    };

    const relativeVelocityX = ball.dx;
    const relativeVelocityY = ball.dy;

    const dotProduct = relativeVelocityX * normal.x + relativeVelocityY * normal.y;
    if (dotProduct > -epsilon) return;

    const massFactor1 = ball.mass * 10;
    const massFactor2 = object.mass;
    const totalMassFactor = massFactor1 + massFactor2;
    const impulse = (-2 * dotProduct) / totalMassFactor;

    const impulseX = impulse * normal.x;
    const impulseY = impulse * normal.y;

    ball.updateMovement(
      impulseX * massFactor1 * (1 - ball.friction) * bounceFactor * (1 - object.friction),
      impulseY * massFactor1 * (1 - ball.friction) * bounceFactor * (1 - object.friction)
    );

    const overlap = ball.radius + object.radius - distance;
    if (overlap > -epsilon) {
      const correctionFactor = 1;
      const correctionX = normal.x * overlap * correctionFactor;
      const correctionY = normal.y * overlap * correctionFactor;
      ball.updatePosition(correctionX, correctionY);
    }
  }

  function resolveBallOvalCollision(ball, object) {
    const closestPoint = getClosestPointOnOval(object, ball);
    const distanceSquared = getDistanceSquared(ball, closestPoint);

    const ballRadiusSquared = ball.radius * ball.radius;
    if (distanceSquared > ballRadiusSquared) return;

    resolveCollision(ball, closestPoint, object, distanceSquared);
  }

  function getClosestPointOnOval(object, point) {
    const { x, y, radiusX, radiusY, rotation } = object;

    const localPoint = transformToLocalCoordinates(point, object);

    const t = solveEllipseProjection(localPoint.x / radiusX, localPoint.y / radiusY);
    const closestLocalX = radiusX * t;
    const closestLocalY = radiusY * Math.sqrt(1 - t * t);

    const signX = Math.sign(localPoint.x);
    const signY = Math.sign(localPoint.y);
    const normalizedClosestLocalX = signX * closestLocalX;
    const normalizedClosestLocalY = signY * closestLocalY;

    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    const closestX = normalizedClosestLocalX * cosRotation - normalizedClosestLocalY * sinRotation + x;
    const closestY = normalizedClosestLocalX * sinRotation + normalizedClosestLocalY * cosRotation + y;

    return { x: closestX, y: closestY };
  }

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

  function transformToLocalCoordinates(point, object) {
    const dx = point.x - object.x;
    const dy = point.y - object.y;
    const cosTheta = Math.cos(-object.rotation);
    const sinTheta = Math.sin(-object.rotation);

    return {
      x: dx * cosTheta - dy * sinTheta,
      y: dx * sinTheta + dy * cosTheta,
    };
  }

  function getClosestPointOnLine(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) return { x: start.x, y: start.y };

    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    const clampedT = Math.max(0, Math.min(1, t));

    return {
      x: start.x + clampedT * dx,
      y: start.y + clampedT * dy,
    };
  }

  function normalizeVector(x, y) {
    const magnitude = Math.sqrt(x * x + y * y);
    return magnitude === 0 ? { x: 0, y: 0 } : { x: x / magnitude, y: y / magnitude };
  }

  function getDistanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // ======================
  // Setup: size canvas, build the scene, wire up listeners
  // ======================

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.8;
    if (floorRect) {
      floorRect.y = canvas.height * 0.8;
      floorRect.width = canvas.width;
    }
  }
  resizeCanvas();

  gameObjectManager = buildGameObjectManager(gameObjectsData);
  mainBall = gameObjectManager.getObjectByIdentifier('main_ball');
  floorRect = gameObjectManager.getObjectByIdentifier('floor');
  resizeCanvas(); // now that floorRect exists, size it correctly too

  function onContextMenuEvent(e) {
    e.preventDefault();
    options.onContextMenu?.(e.pageX, e.pageY);
  }
  canvas.addEventListener('contextmenu', onContextMenuEvent);

  function onKeyDown(e) {
    if (e.code === 'Space') paused = !paused;
  }
  document.addEventListener('keydown', onKeyDown);

  window.addEventListener('resize', resizeCanvas);

  const pointerHandlers = {};
  ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend'].forEach((type) => {
    const handler = (event) => handleScreenEvent(event, type, mainBall);
    pointerHandlers[type] = handler;
    canvas.addEventListener(type, handler);
  });

  // ======================
  // Public API
  // ======================

  return {
    start() {
      if (!rafId && !destroyed) animate();
    },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (fpsTimeoutId) clearTimeout(fpsTimeoutId);
      canvas.removeEventListener('contextmenu', onContextMenuEvent);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', resizeCanvas);
      Object.entries(pointerHandlers).forEach(([type, handler]) => canvas.removeEventListener(type, handler));
      if (gravityManager.isListening) gravityManager.stop();
    },
    resetBall() {
      mainBall.setPosition(canvas.width * 0.5, canvas.height * 0.5);
      mainBall.setMovement(0, 0);
    },
    toggleFloor() {
      hasFloor = !hasFloor;
      return hasFloor;
    },
    toggleGravity() {
      currentGravity = currentGravity === gravity ? gravity * 0.5 : gravity;
      return currentGravity === gravity; // true = normal gravity
    },
    toggleRealisticGravity() {
      try {
        if (gravityManager.isListening) gravityManager.stop();
        else gravityManager.start(mainBall);
      } catch (error) {
        console.error('Error toggling gravity:', error);
      }
      return gravityManager.isListening;
    },
    setPrefersDark(v) {
      prefersDark = v;
    },
    isFloorEnabled: () => hasFloor,
    isNormalGravity: () => currentGravity === gravity,
    isRealisticGravityOn: () => gravityManager.isListening,
  };
}
