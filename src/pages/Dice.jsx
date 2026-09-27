import { useEffect, useRef } from 'react';
import '../styles/dice.css';

// ─── Pure 3D math helpers (unchanged from the original dice.js) ────────────

function precomputeTrigValues(x, y, z) {
  return {
    sinX: Math.sin(((x % 360) * Math.PI) / 180),
    cosX: Math.cos(((x % 360) * Math.PI) / 180),
    sinY: Math.sin(((y % 360) * Math.PI) / 180),
    cosY: Math.cos(((y % 360) * Math.PI) / 180),
    sinZ: Math.sin(((z % 360) * Math.PI) / 180),
    cosZ: Math.cos(((z % 360) * Math.PI) / 180),
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

function project3Dto2D([x, y, z], canvas) {
  const scale = 200;
  const zOffset = 10;

  if (Math.abs(z + zOffset) < 0.001) return [canvas.width / 2, canvas.height / 2];
  const projectedX = (x / (z + zOffset)) * scale + canvas.width / 2;
  const projectedY = (y / (z + zOffset)) * scale + canvas.height / 2;

  return [projectedX, projectedY];
}

function isFaceVisible(faceNormal, trigValues) {
  const normal = rotatePoint(faceNormal, trigValues);
  return Math.abs(normal[2]) > 0.1;
}

function getFaceNormal(faceIndex, cube) {
  const v1 = cube.vertices[cube.faces[faceIndex].indices[0]];
  const v2 = cube.vertices[cube.faces[faceIndex].indices[1]];
  const v3 = cube.vertices[cube.faces[faceIndex].indices[2]];

  const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
  const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

  return [
    edge1[1] * edge2[2] - edge1[2] * edge2[1],
    edge1[2] * edge2[0] - edge1[0] * edge2[2],
    edge1[0] * edge2[1] - edge1[1] * edge2[0],
  ];
}

function getDotPositions(number, normalizedWidth, normalizedHeight) {
  const dotMap = {
    1: [[0, 0, 0]],
    2: [
      [-normalizedWidth / 2, -normalizedHeight / 2, 0],
      [normalizedWidth / 2, normalizedHeight / 2, 0],
    ],
    3: [
      [-normalizedWidth / 2, -normalizedHeight / 2, 0],
      [0, 0, 0],
      [normalizedWidth / 2, normalizedHeight / 2, 0],
    ],
    4: [
      [-normalizedWidth / 2, -normalizedHeight / 2, 0],
      [-normalizedWidth / 2, normalizedHeight / 2, 0],
      [normalizedWidth / 2, -normalizedHeight / 2, 0],
      [normalizedWidth / 2, normalizedHeight / 2, 0],
    ],
    5: [
      [-normalizedWidth / 2, -normalizedHeight / 2, 0],
      [-normalizedWidth / 2, normalizedHeight / 2, 0],
      [normalizedWidth / 2, -normalizedHeight / 2, 0],
      [normalizedWidth / 2, normalizedHeight / 2, 0],
      [0, 0, 0],
    ],
    6: [
      [-normalizedWidth / 2, -normalizedHeight / 3, 0],
      [-normalizedWidth / 2, 0, 0],
      [-normalizedWidth / 2, normalizedHeight / 3, 0],
      [normalizedWidth / 2, -normalizedHeight / 3, 0],
      [normalizedWidth / 2, 0, 0],
      [normalizedWidth / 2, normalizedHeight / 3, 0],
    ],
  };

  return dotMap[number] || [];
}

function drawDiceDots(ctx, canvas, number, faceIndices, rotatedVertices, projectedVertices, dotSize = 5) {
  function calculateFaceCenter(facePoints) {
    const centerX = facePoints.reduce((sum, [x]) => sum + x, 0) / facePoints.length;
    const centerY = facePoints.reduce((sum, [, y]) => sum + y, 0) / facePoints.length;
    const centerZ = facePoints.reduce((sum, [, , z]) => sum + z, 0) / facePoints.length;
    return [centerX, centerY, centerZ];
  }

  function calculateFaceDimensions(facePoints) {
    const width = Math.max(...facePoints.map((p) => p[0])) - Math.min(...facePoints.map((p) => p[0]));
    const height = Math.max(...facePoints.map((p) => p[1])) - Math.min(...facePoints.map((p) => p[1]));
    return { width, height };
  }

  const facePoints = faceIndices.map((i) => rotatedVertices[i]);

  const [centerX3D, centerY3D, centerZ3D] = calculateFaceCenter(facePoints);
  const { width: width3D, height: height3D } = calculateFaceDimensions(facePoints);

  const normalizedWidth = width3D / 2;
  const normalizedHeight = height3D / 2;

  const dotPositions3D = getDotPositions(number, normalizedWidth, normalizedHeight);

  ctx.fillStyle = 'black';
  for (const [xOffset, yOffset, zOffset] of dotPositions3D) {
    const dotX3D = centerX3D + xOffset;
    const dotY3D = centerY3D + yOffset;
    const dotZ3D = centerZ3D + zOffset;

    const [dotX2D, dotY2D] = project3Dto2D([dotX3D, dotY3D, dotZ3D], canvas);

    ctx.beginPath();
    ctx.arc(dotX2D, dotY2D, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

function drawCube(ctx, canvas, cube) {
  const trigValues = precomputeTrigValues(cube.rotation.x, cube.rotation.y, cube.rotation.z);

  const rotatedVertices = cube.vertices.map((vertex) => rotatePoint(vertex, trigValues));
  const projectedVertices = rotatedVertices.map((vertex) => project3Dto2D(vertex, canvas));

  const faceData = cube.faces.map((face, index) => {
    const faceNormal = getFaceNormal(index, cube);
    const isVisible = isFaceVisible(faceNormal, trigValues);

    const zValues = face.indices.map((i) => rotatedVertices[i][2]);
    const avgZ = zValues.reduce((sum, z) => sum + z, 0) / zValues.length;

    return { face, avgZ, isVisible };
  });

  faceData.sort((a, b) => b.avgZ - a.avgZ);

  ctx.lineWidth = 2;

  for (const { face, isVisible } of faceData) {
    if (!isVisible) continue;

    const facePoints = face.indices.map((i) => projectedVertices[i]);

    ctx.fillStyle = face.color;
    ctx.beginPath();
    ctx.moveTo(facePoints[0][0], facePoints[0][1]);
    facePoints.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    drawDiceDots(ctx, canvas, face.number, face.indices, rotatedVertices, projectedVertices);
  }
}

function makeCube() {
  return {
    vertices: [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
    ],
    faces: [
      { indices: [0, 1, 2, 3], color: '#FF5733', number: 1 },
      { indices: [4, 5, 6, 7], color: '#33FFF3', number: 6 },
      { indices: [0, 1, 5, 4], color: '#33FF57', number: 5 },
      { indices: [2, 3, 7, 6], color: '#F3FF33', number: 2 },
      { indices: [0, 3, 7, 4], color: '#FF33F3', number: 4 },
      { indices: [1, 2, 6, 5], color: '#3357FF', number: 3 },
    ],
    rotation: { x: 0, y: 0, z: 0 },
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dice() {
  const canvasRef = useRef(null);
  const cubeRef = useRef(makeCube());
  const isRollingRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      const scaleFactor = 0.4;
      canvas.width = window.innerWidth * scaleFactor;
      canvas.height = window.innerHeight * scaleFactor;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    drawCube(ctx, canvas, cubeRef.current);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const rollDice = () => {
    if (isRollingRef.current) return;
    isRollingRef.current = true;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cube = cubeRef.current;

    const startTime = Date.now();
    const duration = Math.random() * 1500 + 1000;

    const genRandom = () => Math.random() * 360 * 2 - 360;
    const targetRotationX = genRandom();
    const targetRotationY = genRandom();
    const targetRotationZ = genRandom();

    const currentRotationX = cube.rotation.x;
    const currentRotationY = cube.rotation.y;
    const currentRotationZ = cube.rotation.z;

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      const easedProgress = progress * (2 - progress);

      cube.rotation.x = currentRotationX + (targetRotationX - currentRotationX) * easedProgress;
      cube.rotation.y = currentRotationY + (targetRotationY - currentRotationY) * easedProgress;
      cube.rotation.z = currentRotationZ + (targetRotationZ - currentRotationZ) * easedProgress;

      drawCube(ctx, canvas, cube);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cube.rotation.x = Math.round(cube.rotation.x / 90) * 90;
        cube.rotation.y = Math.round(cube.rotation.y / 90) * 90;
        cube.rotation.z = Math.round(cube.rotation.z / 90) * 90;

        drawCube(ctx, canvas, cube);
        isRollingRef.current = false;
      }
    }

    animate();
  };

  return (
    <div className="dice-page">
      <canvas id="canvas" ref={canvasRef} />
      <button id="rollButton" onClick={rollDice}>
        Roll Dice
      </button>
    </div>
  );
}
