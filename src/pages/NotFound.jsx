import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

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

      <style>{`
        .not-found {
          min-height: 90%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: var(--font, 'Segoe UI', system-ui, sans-serif);
          background: var(--bg, #0f0f13);
          color: var(--text, #e8e8f0);
        }
        .not-found .container {
          max-width: 600px;
          text-align: center;
          padding: 2rem;
          transition: opacity 0.3s ease-in;
        }
        .not-found h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--accent, #7c6bff), var(--accent2, #ff6b9d));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .not-found .card {
          background: var(--surface, #18181f);
          border: 1px solid var(--border, #2e2e3e);
          border-radius: var(--radius, 10px);
          padding: 2rem;
          margin-top: 2rem;
        }
        .not-found .card p {
          color: var(--muted, #7a7a96);
          line-height: 1.6;
          margin-bottom: 1rem;
        }
        .not-found .refresh-notice {
          margin-top: 2rem;
          color: var(--yellow, #f5c542);
          transition: opacity 0.3s ease-in;
        }
        .not-found .cacheClear {
          background: var(--accent, #7c6bff);
          color: white;
          border: none;
          padding: 0.5rem 1.5rem;
          border-radius: var(--radius, 10px);
          font-size: 0.9rem;
          cursor: pointer;
          margin-top: 0.5rem;
          font-family: inherit;
        }
        .not-found .cacheClear:hover {
          background: var(--accent2, #ff6b9d);
        }
        .not-found a {
          text-decoration: none;
        }
      `}</style>
    </div>
  );
};
