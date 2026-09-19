
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Loads an ES module that lives in /public through a real <script type="module">
 * tag (allowed by Vite) and resolves with its default export.
 */
export function loadPublicModule(src) {
  return new Promise((resolve, reject) => {
    const key = `__publicModule_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent =
      `import * as m from ${JSON.stringify(src)};` +
      `window.${key} = m;`;
    script.onerror = () => reject(new Error(`Failed to load module: ${src}`));
    document.head.appendChild(script);

    // Inline module scripts don't fire onload, so poll for the handoff.
    const started = Date.now();
    const timer = setInterval(() => {
      if (window[key]) {
        clearInterval(timer);
        const mod = window[key];
        delete window[key];
        script.remove();
        resolve(mod.default);
      } else if (Date.now() - started > 15000) {
        clearInterval(timer);
        reject(new Error(`Timed out loading module: ${src}`));
      }
    }, 20);
  });
}
