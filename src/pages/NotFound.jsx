import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/not-found.css';

export default function NotFound() {
  const navigate = useNavigate();

  const handleClearCache = () => {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return (
    <div className="not-found">
      <div className="container">
        <h1>404</h1>
        
        <div className="card">
          <p>
            This page doesn't exist in this website
          </p>
          <p>
            Since this is a <strong>single-page application</strong>, all routes are 
            handled client-side by the WASM router. The route you tried may have been 
            moved, renamed, or never existed.
          </p>
          <p>
            Try navigating back to <a className="btn-ghost" onClick={() => navigate("/")}>the home page</a> or 
            check the URL for typos.
          </p>
        </div>

        <div className="refresh-notice">
          <p>If you believe this page should exist, try clearing your cache:</p>
          <button onClick={handleClearCache} className="cacheClear">
            Clear Cache & Reload
          </button>
        </div>
      </div>
    </div>
  );
};
