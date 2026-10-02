import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode.js';

const NAV_STRUCTURE = [
  { type: 'link', label: 'Main Webpage', to: '/' },
  { type: 'link', label: 'Actual Code', to: '/code' },
  {
    type: 'dropdown',
    label: 'Animations',
    items: [
      { label: 'Animation Page', to: '/animation' },
      { label: 'Dice Page', to: '/dice' },
      { label: '3D Test Page', to: '/test3d' },
    ],
  },
  {
    type: 'dropdown',
    label: 'Random Things',
    items: [
      { label: 'Extra', to: '/extra' },
      { label: 'Links', to: '/links' },
      { label: 'Navigator', to: '/navigator' },
      { label: 'DocViewer', to: '/document' },
      { label: 'Convert', to: '/convert' },
    ],
  },
  {
    type: 'dropdown',
    label: 'Small Apps',
    items: [
      { label: 'UrlTable', to: '/urltable' },
      { label: 'Video', to: '/video' },
      { label: 'Weather', to: '/weather' },
      { label: 'Subnet', to: '/subnet' },
    ],
  },
];

function pageTitle(pathname) {
  if (pathname === '/' || pathname === '') return 'Main Page';
  const name = pathname.replace(/^\//, '');
  return name.slice(0, 1).toUpperCase() + name.slice(1) + ' Page';
}

function Dropdown({ label, items }) {
  const [open, setOpen] = useState(false);

  return (
    <li
      className="navbar_li dropdown"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <p className="navbar_item">{label}</p>
      <ul className={`dropdown_menu${open ? ' show' : ''}`}>
        {items.map((item) => (
          <li className="dropdown_li" key={item.to}>
            <Link className="dropdown_item link" to={item.to}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function Navbar() {
  const location = useLocation();
  const { prefersDark, toggleDarkMode } = useDarkMode();
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    function handleDocClick(event) {
      if (
        toggleRef.current &&
        navRef.current &&
        !toggleRef.current.contains(event.target) &&
        !navRef.current.contains(event.target)
      ) {
        setNavOpen(false);
      }
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Close the mobile dropdown whenever the route changes
  useEffect(() => setNavOpen(false), [location.pathname]);

  return (
    <>
      <nav className="navbar" id="navbar">
        <div className="navbar_in">
          <div className="navbar_spacer" aria-hidden="true" />
          <div className="navbar_center">
            <Link className="navbar_head link" to="/">
              {pageTitle(location.pathname)}
            </Link>
            <button
              type="button"
              className="navbar_toggle"
              id="navbarToggle"
              ref={toggleRef}
              onClick={() => setNavOpen((v) => !v)}
            >
              <img id="menu_image" src="/assets/menu_bars.png" alt="Menu" />
            </button>
          </div>
          <div
            className={`navbar_items${navOpen ? ' show' : ''}`}
            id="navbarDropdown"
            ref={navRef}
          >
            <ul className="navbar_ul">
              {NAV_STRUCTURE.map((entry) =>
                entry.type === 'link' ? (
                  <li className="navbar_li" key={entry.to}>
                    <Link className="navbar_item link" to={entry.to}>
                      {entry.label}
                    </Link>
                  </li>
                ) : (
                  <Dropdown key={entry.label} label={entry.label} items={entry.items} />
                )
              )}
            </ul>
          </div>
          <div className="darkmode-slider">
            <label className="switch">
              <input
                type="checkbox"
                id="darkModeToggle"
                checked={prefersDark}
                onChange={toggleDarkMode}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      </nav>
      <div id="navbarHelp">.</div>
    </>
  );
}
