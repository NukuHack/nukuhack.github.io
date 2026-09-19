import { decompress as decompressV1 } from './urltableCompressV1.js';

let initPromise = null;

/**
 * Sets up window.compress / window.decompress (WASM-backed) and
 * window.decompReady (a promise the page awaits before decompressing
 * auto-saved data), exactly like urltable.html's three inline <script>
 * blocks did:
 *   1. window.decompressV1 = decompress;              (pure-JS V1 codec)
 *   2. window.decompReady = new Promise(...);
 *   3. dynamic import of /wasm/wasm.js, wiring window.compress/decompress
 *      to the WASM module, then loading /wasm/compressor/migrate.js for
 *      the isOld()/migrate() helpers window.decompress relies on.
 *
 * Idempotent — safe to call from every mount of the URL Table page.
 */
export function initWasmCompression() {
  if (initPromise) return initPromise;

  // 1. V1 (pure-JS) decompressor, kept around for migration / back-compat.
  window.decompressV1 = decompressV1;

  // 2. Promise the page awaits before trusting window.decompress.
  window.decompReady = new Promise((resolve) => {
    window._decompReady = resolve;
  });

  // 3. WASM module + migration helpers.
  initPromise = (async () => {
    // /public files can't be import()ed from source in Vite (it rewrites the
    // request and rejects it). A plain <script type="module"> is left alone
    // and served as-is, so load the entry that way and hand it back via window.
    const getWasm = await loadPublicModule('/wasm/wasm.js');

    const wasm = await getWasm('Compression').then(async (m) => {
      await m.default();
      return m;
    });

    window.compress = (txt, encode = 'a', doComp = true) => wasm.compress(txt, encode, doComp);
    window.decompress = (comp) => wasm.decompress(window.migrate(comp)).text;

    await loadScript('/wasm/compressor/migrate.js');

    window._decompReady();
  })();

  return initPromise;
}

function loadScript(src) {
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
function loadPublicModule(src) {
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
