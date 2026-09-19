import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '../styles/animation.css';
import { createAnimationEngine } from '../lib/animationEngine.js';
import { useDarkMode } from '../hooks/useDarkMode.js';

export default function Animation() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const { prefersDark } = useDarkMode();

  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const [floorEnabled, setFloorEnabled] = useState(true);
  const [normalGravity, setNormalGravity] = useState(true);
  const [realisticGravityOn, setRealisticGravityOn] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const engine = createAnimationEngine(canvasRef.current, {
      onContextMenu: (x, y) => setContextMenu({ show: true, x, y }),
    });
    engineRef.current = engine;
    engine.start();

    return () => engine.destroy();
  }, []);

  useEffect(() => {
    engineRef.current?.setPrefersDark(prefersDark);
  }, [prefersDark]);

  // Close the menu on any outside click, same as the original's
  // `document.addEventListener('click', hideCustomContextMenu)`.
  useEffect(() => {
    if (!contextMenu.show) return undefined;
    function handleDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu((prev) => ({ ...prev, show: false }));
      }
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [contextMenu.show]);

  function closeMenu() {
    setContextMenu((prev) => ({ ...prev, show: false }));
  }

  // Clamp the menu to stay on-screen, matching the original's
  // Math.min(pageX, window.innerWidth - menu.offsetWidth) logic. Runs in a
  // layout effect (measure-after-mutation-but-before-paint) rather than
  // during render, since reading a ref's DOM size is a render side-effect.
  useLayoutEffect(() => {
    if (!contextMenu.show || !menuRef.current) return;
    setMenuPos({
      left: Math.min(contextMenu.x, window.innerWidth - menuRef.current.offsetWidth),
      top: Math.min(contextMenu.y, window.innerHeight - menuRef.current.offsetHeight),
    });
  }, [contextMenu]);

  function handleReset(e) {
    e.stopPropagation();
    engineRef.current.resetBall();
    closeMenu();
  }

  function handleToggleFloor(e) {
    e.stopPropagation();
    setFloorEnabled(engineRef.current.toggleFloor());
    closeMenu();
  }

  function handleToggleGravity(e) {
    e.stopPropagation();
    setNormalGravity(engineRef.current.toggleGravity());
    closeMenu();
  }

  function handleToggleRealisticGravity(e) {
    e.stopPropagation();
    setRealisticGravityOn(engineRef.current.toggleRealisticGravity());
    closeMenu();
  }

  const menuStyle = {
    display: contextMenu.show ? 'block' : 'none',
    left: menuPos.left,
    top: menuPos.top,
  };

  return (
    <>
      <div id="customContextMenu" ref={menuRef} style={menuStyle}>
        <ul>
          <li onClick={handleReset}>Reset Ball</li>
          <li onClick={handleToggleFloor}>{floorEnabled ? 'Delete Floor' : 'Generate Floor'}</li>
          <li onClick={handleToggleGravity}>{normalGravity ? 'Small Gravity' : 'Normal Gravity'}</li>
          <li onClick={handleToggleRealisticGravity}>
            {realisticGravityOn ? 'Disable Realistic Gravity' : 'Enable Realistic Gravity'}
          </li>
        </ul>
      </div>
      <canvas id="gameCanvas" ref={canvasRef} />
    </>
  );
}
