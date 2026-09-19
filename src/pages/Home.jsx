import { useState } from 'react';
import '../styles/index.css';

const DICE_FACES = {
  front: 'dice_1.png',
  back: 'dice_6.png',
  left: 'dice_3.png',
  right: 'dice_4.png',
  top: 'dice_5.png',
  bottom: 'dice_2.png',
};

const POLYGONS = ['square', 'triangle', 'circle', 'octagon', 'pentagon'];

export default function Home() {
  const [cubeAnimating, setCubeAnimating] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState('default');
  const [animatedPolygons, setAnimatedPolygons] = useState(() => new Set());

  const toggleCube = () => setCubeAnimating((v) => !v);

  const handlePolygonSelect = (event) => {
    const value = event.target.value;
    setSelectedPolygon(value);
    if (value !== 'default') {
      setAnimatedPolygons((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    } else {
      setAnimatedPolygons(new Set());
    }
  };

  const handlePolygonClick = (polygon) => {
    setAnimatedPolygons((prev) => {
      const next = new Set(prev);
      if (next.has(polygon)) next.delete(polygon);
      else next.add(polygon);
      return next;
    });
  };

  return (
    <>
      <div className="cube-section">
        <div className={`cube${cubeAnimating ? ' animate' : ''}`} id="cube" onClick={toggleCube}>
          {Object.entries(DICE_FACES).map(([face, img]) => (
            <div className={`face ${face}`} key={face}>
              <img src={`/assets/${img}`} className="cube_img" alt={`dice side ${img}`} />
            </div>
          ))}
        </div>
        <input
          type="button"
          id="animCube"
          className="animate_button"
          onClick={toggleCube}
          value={cubeAnimating ? 'Stop the Cube' : 'Animate the Cube'}
        />
      </div>

      <label htmlFor="select_animation" id="select_anim_label">
        Select a polygon:
      </label>
      <select id="select_animation" value={selectedPolygon} onChange={handlePolygonSelect}>
        <option value="default">Nothing</option>
        {POLYGONS.map((p) => (
          <option value={p} key={p}>
            {p.slice(0, 1).toUpperCase() + p.slice(1)}
          </option>
        ))}
      </select>

      {POLYGONS.map((polygon) => (
        <div
          key={polygon}
          className={`polygon ${polygon}${animatedPolygons.has(polygon) ? ' animate' : ''}`}
          id={polygon}
          onClick={() => handlePolygonClick(polygon)}
        />
      ))}
    </>
  );
}
