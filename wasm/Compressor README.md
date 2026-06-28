# compressor — Rust/WASM build guide

## 1. Install the toolchain (one-time)

```bash
# Install Rust (if you don't have it)
curl https://sh.rustup.rs -sSf | sh

# Add the WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack  (builds + generates the JS glue automatically)
cargo install wasm-pack
```

---

## 2. Set your secret seeds

Open `src/lib.rs` and replace the placeholder values at the top:

```rust
const PRNG_SEED:   u32  = 0xDEAD_BEEF;   // ← your private value
const HEADER_SEED: u32  = 0xCAFE_BABE;   // ← your private value
const MAGIC:       &str = "C2Fx";        // ← your 4-char magic
const VERSION_STR: &str = "002";         // ← bump when format changes
```

**Do not commit the real values to a public repo.**

---

## 3. Build

```bash
# From the project root (where Cargo.toml lives):
wasm-pack build --target web --release
```

This creates a `pkg/` folder containing:

```
pkg/
  compressor_bg.wasm   ← the binary (ship this)
  compressor.js        ← auto-generated JS glue (ship this, do not edit)
  compressor.d.ts      ← TypeScript types (optional)
  package.json         ← if you want to publish to npm
```

For Node.js instead of a browser, use `--target nodejs`.

---

## 4. File layout after build

```
your-project/
  pkg/
    compressor_bg.wasm
    compressor.js
  compressor.js          ← the hand-written wrapper (this repo)
  your-app.js            ← your existing code
```

---

## 5. Import in your existing JS file

Replace the old `compress` / `decompress` imports with the wrapper:

### ES modules (browser / Vite / Webpack / etc.)

```js
// your-app.js  — replace the old import line with this:
import { compress, decompress } from "./compressor.js";

// compress is now async (WASM needs one async init on first call)
const cipher = await compress("hello world");
console.log(cipher);   // flat printable-ASCII string

const result = await decompress(cipher);
console.log(result.text);              // "hello world"
console.log(result.meta.timestamp);   // Date object
console.log(result.meta.version);     // "002"
```

### Options (same as before)

```js
// skip encryption, keep compression
const cipher = await compress("hello", { encode: "n" });

// skip compression too (raw cipher only)
const cipher = await compress("hello", { encode: "a", compress: false });
```

### CommonJS / Node

```js
const { compress, decompress } = require("./compressor.js");

(async () => {
  const cipher = await compress("hello world");
  const { text, meta } = await decompress(cipher);
  console.log(text, meta);
})();
```

### Plain HTML (no bundler)

```html
<script type="module">
  import { compress, decompress } from "./compressor.js";

  const c = await compress("hello");
  const r = await decompress(c);
  console.log(r.text);
</script>
```

---

## 6. Bundler notes

| Bundler | What to do |
|---------|-----------|
| **Vite** | Nothing extra — Vite handles `.wasm` natively in ES module mode |
| **Webpack 5** | Add `experiments: { asyncWebAssembly: true }` in `webpack.config.js` |
| **Rollup** | Add `@rollup/plugin-wasm` |
| **esbuild** | Pass `--bundle` + copy the `.wasm` file to your output dir manually |
| **No bundler** | Serve with a proper web server (WASM requires `Content-Type: application/wasm`); opening `file://` won't work |

---

## 7. Rebuilding after changes

Any change to `src/lib.rs` or the secret constants requires a rebuild:

```bash
wasm-pack build --target web --release
```

The `pkg/` folder is fully regenerated each time — do not hand-edit files inside it.

---

## 8. Migrating

```js
// migrate a string:
const newStr = migrateV1toV2(oldV1String);

// Check if something is V1:
isV1(someString); // true/false
```
