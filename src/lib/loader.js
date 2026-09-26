// wasm helers
const REGISTRY = {
  Compression: {
    path: '/wasm/compressor/pkg/compressor.js',
    dependencies: [] // For modules that depend on other WASM
  },
  React: {
    path: 'https://nukuhack.github.io/micro-react/micro_react.js',
    dependencies: []
  },
};

const initialized = new Map();

export async function getWasm(alias) {
  if (initialized.has(alias)) {
    return initialized.get(alias);
  }

  const config = REGISTRY[alias];
  if (!config) {
    throw new Error(`WASM module "${alias}" not registered`);
  }

  // Load dependencies first
  await Promise.all(
    config.dependencies.map(dep => getWasm(dep))
  );

  // Dynamic import with Vite/Rollup support
  const module = await loadPublicModule(config.path);
  await module.default(); // init
  
  initialized.set(alias, module);
  return module;
}

const PUBLIC_PREFIX = '/public';
export function resolve(src) {
  return src.startsWith(PUBLIC_PREFIX) ? src : PUBLIC_PREFIX + src;
}

export function loadScript(src) {
  const url = resolve(src);
  if (window.__root && window.loadJsx) {
    Object.assign(window, window.loadJsx(url).then((m) => m));
    return;
  }
  return new Promise((resolve_, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve_();
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
}

export function loadPublicModule(src, { timeout = 15000 } = {}) {
  // If it's already an absolute URL (http/https), use it directly, otherwise, resolve it.
  const url = /^https?:\/\//i.test(src)
    ? src : resolve(src);

  if (window.__root && window.loadJsx) {
    return window.loadJsx(url);
  }

  // Prefer a real external module script over an inline one (CSP-safe).
  return import(/* @vite-ignore */ url);
}