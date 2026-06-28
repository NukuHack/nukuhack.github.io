/**
 * migrate.js
 */

"use strict";

// ─── V1 detection ─────────────────────────────────────────────────────────────
// V1 headers look like:  "<number>_<n|t|d|a>_<c|d>_<sep>_"
// V2 headers are 64 chars of ciphertext starting with the encrypted MAGIC "C2Fx".
// We detect V1 by checking whether the first bytes look like a plain decimal number
// followed by an underscore.

function isOld(compressed) {
  { // is v1
    if (typeof compressed !== "string" || compressed.length < 9) return false;

    // V2 headers are always exactly 64 chars of ciphertext.
    // The first 4 bytes are always the encrypted MAGIC "C2Fx" using
    // the fixed HEADER_SEED=0xCAFEBABE — always decrypts to "Ql=d".
    if (compressed.startsWith("Ql=d")) return false;

    // V1 header: "<decimal>_<n|t|d|a>_<c|d>_<sep>_"
    // Validate all 4 fields, not just the leading number.
    const m = compressed.match(/^(\d+)_(n|t|d|a)_(c|d)_(.)_/);
    if (!m) return false;

    // The declared table blob length must be plausible
    // (not larger than the rest of the string after the header)
    const headerLen = m[0].length;
    const tableBlobLen = Number(m[1]);
    if (tableBlobLen*0.3 > compressed.length - headerLen) return false;

    console.log("Looks like you try to load older format");
    return true;
  }
   // from v2 the version number is included so much easier
}

// ─── Core migration ───────────────────────────────────────────────────────────

/**
 * Migrate a single V1-encoded string to newest.
 *
 * @param {string} v1str         — the old compressed string
 * @param {string} [encode="a"]  — V2 encode mode ("n"|"t"|"d"|"a")
 * @param {boolean} [doCompress=true]
 * @param {Function} [decompressOld] — override if window.decompressV1 isn't set
 * @returns {string} Newly compressed string
 */
function migrate(v1str, encode = "a", doCompress = true, decompressOld) {
  if (!isOld(v1str)) {
    // Already V2 (or unknown) — return as-is and warn.
    console.log("migrate: input does not look like a V1 string — skipping.");
    return v1str;
  }
  console.log("!! -> automatically migrating\nIn case this is really an older format please re-save it, and use that from now on");

  const decompFn = decompressOld
    ?? window.decompressV1
    ?? (() => { throw new Error("V1 decompress not found. Set window.decompressV1 first."); })();

  // Step 1: recover plain text using the V1 algorithm
  const plainText = decompFn(v1str);

  // Step 2: re-encode with new wersion
  const newCompress = window.compress;
  if (typeof newCompress !== "function") {
    throw new Error("V2 compress not found on window.compress — did you init the WASM module?");
  }

  return newCompress(plainText, encode, doCompress);
}

// ─── Exports (works as plain script or ESM) ──────────────────────────────────

if (typeof module !== "undefined") {
  module.exports = { isOld, migrate };
} else {
  window.migrate = migrate;
  window.isOld = isOld;
}
