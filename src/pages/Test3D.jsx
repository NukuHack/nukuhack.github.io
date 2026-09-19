import { useEffect, useRef } from 'react';
import '../styles/test3d.css';

// ─── Pure 3D math helpers (unchanged from the original test3d.js) ──────────

function precomputeTrigValues(x, y, z) {
  const radX = (x * Math.PI) / 180;
  const radY = (y * Math.PI) / 180;
  const radZ = (z * Math.PI) / 180;
  return {
    sinX: Math.sin(radX), cosX: Math.cos(radX),
    sinY: Math.sin(radY), cosY: Math.cos(radY),
    sinZ: Math.sin(radZ), cosZ: Math.cos(radZ),
  };
}

function rotatePoint([x, y, z], { sinX, cosX, sinY, cosY, sinZ, cosZ }) {
  const rotatedY = y * cosX - z * sinX;
  const rotatedZ = y * sinX + z * cosX;
  const rotatedX = x * cosY - rotatedZ * sinY;
  const rotatedZ2 = x * sinY + rotatedZ * cosY;
  const rotatedX2 = rotatedX * cosZ - rotatedY * sinZ;
  const rotatedY2 = rotatedX * sinZ + rotatedY * cosZ;
  return [rotatedX2, rotatedY2, rotatedZ2];
}

function transformToCameraSpace([x, y, z], camera) {
  const { pos, trigValues } = camera;
  x -= pos.x;
  y -= pos.y;
  z -= pos.z;
  const { sinX, cosX, sinY, cosY, sinZ, cosZ } = trigValues;
  const rotatedX = x * cosZ + y * sinZ;
  const rotatedY = -x * sinZ + y * cosZ;
  const rotatedX2 = rotatedX * cosY + z * sinY;
  const rotatedZ = -rotatedX * sinY + z * cosY;
  const rotatedY2 = rotatedY * cosX + rotatedZ * sinX;
  const rotatedZ2 = -rotatedY * sinX + rotatedZ * cosX;
  return [rotatedX2, rotatedY2, rotatedZ2];
}

function project3Dto2D([x, y, z], canvas) {
  const scale = 200;
  const zOffset = 10;
  if (z + zOffset === 0) return [0, 0];
  const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
  const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;
  return [projectedX, projectedY];
}

function normalizeVector([x, y, z]) {
  const length = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  return length ? [x / length, y / length, z / length] : [0, 0, 0];
}

function getForwardVector(camera) {
  const radY = (camera.rotation.y * Math.PI) / 180;
  const radX = (camera.rotation.x * Math.PI) / 180;
  return normalizeVector([Math.sin(radY) * Math.cos(radX), Math.sin(radX), -Math.cos(radY) * Math.cos(radX)]);
}

function getRightVector(camera) {
  const radY = (camera.rotation.y * Math.PI) / 180;
  return normalizeVector([Math.sin(radY + Math.PI / 2), 0, -Math.cos(radY + Math.PI / 2)]);
}

function moveCamera(camera, vector, factor) {
  camera.pos.x += vector[0] * factor;
  camera.pos.y += vector[1] * factor;
  camera.pos.z += vector[2] * factor;
}

function drawObject(ctx, canvas, camera, object, cubeRotation, style, applyRotation) {
  const { vertices, edges } = object;
  let rotatedVertices;

  if (applyRotation) {
    const trigValues = precomputeTrigValues(cubeRotation.x, cubeRotation.y, cubeRotation.z);
    rotatedVertices = vertices.map((vertex) => rotatePoint(vertex, trigValues));
  } else {
    rotatedVertices = vertices;
  }

  const cameraSpaceVertices = rotatedVertices.map((v) => transformToCameraSpace(v, camera));
  const projectedVertices = cameraSpaceVertices.map((v) => project3Dto2D(v, canvas));

  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.beginPath();
  for (const [start, end] of edges) {
    const [x1, y1] = projectedVertices[start];
    const [x2, y2] = projectedVertices[end];
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  if (style.fill) {
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
}

function makeScene() {
  return {
    cube: {
      vertices: [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ],
      rotation: { x: 0, y: 0, z: 0 },
    },
    plate: {
      vertices: [[-2, -2, -0.5], [2, -2, -0.5], [2, 2, -0.5], [-2, 2, -0.5]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
    },
    camera: {
      pos: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      trigValues: precomputeTrigValues(0, 0, 0),
    },
  };
}

const MOVE_SPEED = 0.5;

export default function Test3D() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scene = makeScene();
    sceneRef.current = scene;

    let rafId = null;
    let destroyed = false;

    function resizeCanvas() {
      canvas.width = window.innerWidth * 0.8;
      canvas.height = window.innerHeight * 0.8;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function animate() {
      if (destroyed) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      scene.cube.rotation.x += 0.3;
      scene.cube.rotation.y += 0.5;
      scene.cube.rotation.z -= 0.4;

      drawObject(ctx, canvas, scene.camera, scene.plate, scene.cube.rotation, { strokeStyle: '#888', lineWidth: 1 }, false);
      drawObject(ctx, canvas, scene.camera, scene.cube, scene.cube.rotation, { strokeStyle: '#fff', lineWidth: 2 }, true);

      rafId = requestAnimationFrame(animate);
    }
    animate();

    // ── Mouse look ──────────────────────────────────────────────────────
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function updateCameraLook(deltaX, deltaY) {
      scene.camera.rotation.y -= deltaX * 4;
      scene.camera.rotation.x += deltaY * 4;
      scene.camera.trigValues = precomputeTrigValues(-scene.camera.rotation.x, -scene.camera.rotation.y, -scene.camera.rotation.z);
    }

    function onMouseDown(e) {
      isMouseDown = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    function onMouseMove(e) {
      if (!isMouseDown) return;
      updateCameraLook(e.clientX - lastMouseX, e.clientY - lastMouseY);
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
    function onMouseUp() {
      isMouseDown = false;
    }
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    // ── Touch look ──────────────────────────────────────────────────────
    let isTouching = false;
    let lastTouchX = 0;
    let lastTouchY = 0;

    function onTouchStart(e) {
      e.preventDefault();
      isTouching = true;
      const touch = e.touches[0];
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (!isTouching) return;
      const touch = e.touches[0];
      updateCameraLook(touch.clientX - lastTouchX, touch.clientY - lastTouchY);
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
    function onTouchEnd() {
      isTouching = false;
    }
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', onTouchEnd);

    // ── Keyboard movement ───────────────────────────────────────────────
    function onKeyDown(e) {
      const forward = getForwardVector(scene.camera);
      const right = getRightVector(scene.camera);
      if (['w', 'W'].includes(e.key)) moveCamera(scene.camera, forward, -MOVE_SPEED);
      if (['s', 'S'].includes(e.key)) moveCamera(scene.camera, forward, MOVE_SPEED);
      if (['a', 'A'].includes(e.key)) moveCamera(scene.camera, right, -MOVE_SPEED);
      if (['d', 'D'].includes(e.key)) moveCamera(scene.camera, right, MOVE_SPEED);
      if (['q', 'Q'].includes(e.key)) scene.camera.pos.y += MOVE_SPEED;
      if (['e', 'E'].includes(e.key)) scene.camera.pos.y -= MOVE_SPEED;
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // On-screen buttons move the camera once per click, exactly like the
  // original (no press-and-hold repeat — the original's touchend handlers
  // on these buttons were empty no-ops).
  function moveForward() {
    const scene = sceneRef.current;
    moveCamera(scene.camera, getForwardVector(scene.camera), MOVE_SPEED);
  }
  function moveBackward() {
    const scene = sceneRef.current;
    moveCamera(scene.camera, getForwardVector(scene.camera), -MOVE_SPEED);
  }
  function moveLeft() {
    const scene = sceneRef.current;
    moveCamera(scene.camera, getRightVector(scene.camera), -MOVE_SPEED);
  }
  function moveRight() {
    const scene = sceneRef.current;
    moveCamera(scene.camera, getRightVector(scene.camera), MOVE_SPEED);
  }
  function moveUpp() {
    sceneRef.current.camera.pos.y -= MOVE_SPEED;
  }
  function moveDown() {
    sceneRef.current.camera.pos.y += MOVE_SPEED;
  }

  return (
    <>
      <canvas id="canvas" ref={canvasRef} />

      <div id="controls">
        <span id="vert-buttons">
          <button id="upp-button" onClick={moveUpp}>
            Upp
          </button>
          <button id="down-button" onClick={moveDown}>
            Down
          </button>
        </span>

        <span id="wasd-buttons">
          <button id="w-button" onClick={moveBackward}>
            W
          </button>
          <button id="a-button" onClick={moveLeft}>
            A
          </button>
          <button id="s-button" onClick={moveForward}>
            S
          </button>
          <button id="d-button" onClick={moveRight}>
            D
          </button>
        </span>
      </div>
    </>
  );
}
