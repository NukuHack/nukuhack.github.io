// wasm helers
const REGISTRY = {
  Compression: {
    path: './compressor/pkg/compressor.js',
    dependencies: [] // For modules that depend on other WASM
  },
  React: {
    path: './micro-react/pkg/micro_react.js',
    dependencies: []
  },
};

const initialized = new Map();

export default async function getWasm(alias) {
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
  const module = await import(/* @vite-ignore */ config.path);
  await module.default(); // init
  
  initialized.set(alias, module);
  return module;
}