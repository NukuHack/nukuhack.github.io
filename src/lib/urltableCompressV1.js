// ─── URL table "V1" text compressor ────────────────────────────────────────
// Verbatim port of legacy/js/compress.js (a pure-JS, no-WASM compression
// codec) to an ES module. The urltable page's WASM loader
// (src/lib/urltableWasm.js) exposes this as window.decompressV1, exactly
// mirroring the original's <script>window.decompressV1 = decompress;</script>
// snippet — kept around for migration/back-compat with old-format saves.
"use strict";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRINT_START    = 32;
const PRINT_END      = 126;
const PRINT_RANGE    = PRINT_END - PRINT_START + 1;   // 95
const HEADER_SEP     = "_";
const SEP_CANDIDATES = "$^~`#@!%&*+=<>?/";

const PRNG_SEED  = 0x6A09E667;
const BLOCK_SIZE = 16;

// ─── PRNG ─────────────────────────────────────────────────────────────────────

function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

// ─── Encryption ───────────────────────────────────────────────────────────────

function encodeStr(s) {
  const n   = s.length;
  const rng = makePRNG(PRNG_SEED);

  // Pass 1: per-char keystream shift
  const codes = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const c     = s.charCodeAt(i);
    const shift = rng() % PRINT_RANGE;
    codes[i] = (c >= PRINT_START && c <= PRINT_END)
      ? ((c - PRINT_START + shift) % PRINT_RANGE) + PRINT_START
      : c;
  }

  // Pass 2: block shuffle — build shuffled order
  const numBlocks = Math.ceil(n / BLOCK_SIZE);
  const order     = new Int32Array(numBlocks);
  for (let i = 0; i < numBlocks; i++) order[i] = i;
  for (let i = numBlocks - 1; i > 0; i--) {
    const j      = rng() % (i + 1);
    const tmp    = order[i];
    order[i]     = order[j];
    order[j]     = tmp;
  }

  // Emit each block in shuffled order with a 2-char base-95 length prefix
  const parts = new Array(numBlocks);
  for (let bi = 0; bi < numBlocks; bi++) {
    const src   = order[bi];
    const start = src * BLOCK_SIZE;
    const end   = Math.min(start + BLOCK_SIZE, n);
    const len   = end - start;
    // 2-char prefix encodes the block length
    let block = String.fromCharCode(
      PRINT_START + Math.floor(len / PRINT_RANGE),
      PRINT_START + (len % PRINT_RANGE)
    );
    for (let k = start; k < end; k++) block += String.fromCharCode(codes[k]);
    parts[bi] = block;
  }
  return parts.join("");
}

function decodeStr(s) {
  // Re-read blocks (stripping 2-char length prefixes)
  const blocks = [];
  let pos = 0;
  while (pos + 2 <= s.length) {
    const hi  = s.charCodeAt(pos)     - PRINT_START;
    const lo  = s.charCodeAt(pos + 1) - PRINT_START;
    const len = hi * PRINT_RANGE + lo;
    blocks.push(s.slice(pos + 2, pos + 2 + len));
    pos += 2 + len;
  }

  // Burn pass-1 PRNG calls (one per original char), then replay shuffle
  const totalChars = blocks.reduce((a, b) => a + b.length, 0);
  const rng        = makePRNG(PRNG_SEED);
  for (let i = 0; i < totalChars; i++) rng();

  const order = new Int32Array(blocks.length);
  for (let i = 0; i < blocks.length; i++) order[i] = i;
  for (let i = blocks.length - 1; i > 0; i--) {
    const j     = rng() % (i + 1);
    const tmp   = order[i];
    order[i]    = order[j];
    order[j]    = tmp;
  }

  // Invert the permutation — NOTE: must use Array (not Int32Array) for string mapping
  const inv = new Array(order.length);
  for (let i = 0; i < order.length; i++) inv[order[i]] = i;
  const reassembled = inv.map(si => blocks[si]).join("");

  // Reverse pass 1
  const rng2  = makePRNG(PRNG_SEED);
  const chars = new Array(reassembled.length);
  for (let i = 0; i < reassembled.length; i++) {
    const c     = reassembled.charCodeAt(i);
    const shift = rng2() % PRINT_RANGE;
    chars[i] = (c >= PRINT_START && c <= PRINT_END)
      ? String.fromCharCode(((c - PRINT_START - shift + PRINT_RANGE) % PRINT_RANGE) + PRINT_START)
      : reassembled[i];
  }
  return chars.join("");
}

// ─── Separator selection ──────────────────────────────────────────────────────

function chooseSep(text) {
  for (const c of SEP_CANDIDATES) if (!text.includes(c)) return c;
  return null;
}

// ─── RLE ─────────────────────────────────────────────────────────────────────
// Only emits a token when it is strictly shorter than the raw run.

function applyRLE(text, sep) {
  const parts = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    let run = 1;
    while (i + run < n && text[i + run] === ch) run++;
    const token = `${sep}${sep}${run}${sep}${ch}${sep}`;
    parts.push(token.length < run ? token : text.slice(i, i + run));
    i += run;
  }
  return parts.join("");
}

function reverseRLE(text, sep) {
  const e = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`${e}${e}(\\d+)${e}([^${e}])${e}`, "g"),
    (_, n, ch) => ch.repeat(Number(n))
  );
}

// ─── Dictionary table ─────────────────────────────────────────────────────────
//
// Greedy simulation:
//   1. Collect all n-gram candidates (n = 1..4 words).
//   2. Score each by net savings on the CURRENT remaining text.
//   3. Admit the best-scoring phrase, substitute it into the running text,
//      remove it from the candidate set, and repeat.
//   4. Stop when no candidate has positive net savings.
//
// This ensures:
//   • Every admitted entry truly saves bytes (measured on post-substitution text).
//   • Sub-phrases absorbed by longer n-grams are never wastefully stored.
//   • Overlapping n-gram counts are handled correctly.
//
// Single-pass substitution (applyTable):
//   Groups phrases by first character; at each position tries candidates
//   longest-first.  O(n·L) where L = max phrase length.

function refLen(id) {
  return 2 + String(id).length;       // <sep><id><sep>
}

function entryOverhead(phrase) {
  return String(phrase.length).length + 1 + phrase.length;  // "<len>_<phrase>"
}

function countNonOverlapping(text, phrase) {
  let count = 0, pos = 0;
  while ((pos = text.indexOf(phrase, pos)) !== -1) { count++; pos += phrase.length; }
  return count;
}

function buildTable(text, sep) {
  // Tokenise preserving whitespace so n-gram reconstruction is exact
  const tokens  = text.split(/(\s+)/).filter(s => s.length > 0);
  const wordIdx = [];
  for (let i = 0; i < tokens.length; i++)
    if (tokens[i].trim().length > 0) wordIdx.push(i);

  // Collect all unique candidate phrases
  const phraseSet = new Set();
  for (let n = 1; n <= 4; n++) {
    for (let wi = 0; wi + n - 1 < wordIdx.length; wi++) {
      const phrase = tokens.slice(wordIdx[wi], wordIdx[wi + n - 1] + 1).join("");
      if (!phrase.includes(sep) && phrase.length >= 3) phraseSet.add(phrase);
    }
  }

  const table    = [];
  const wordToId = new Map();
  let   remaining = text;    // running copy shrinks as we substitute

  while (phraseSet.size > 0) {
    let bestPhrase = null, bestNet = 0;   // only admit if net > 0

    for (const phrase of phraseSet) {
      if (phrase.includes(sep)) { phraseSet.delete(phrase); continue; }
      const id  = table.length;
      const ref = refLen(id);
      if (phrase.length <= ref) continue;                     // can never save
      const count = countNonOverlapping(remaining, phrase);
      if (count < 2) continue;
      const net = (phrase.length - ref) * count - entryOverhead(phrase);
      if (net > bestNet) { bestNet = net; bestPhrase = phrase; }
    }

    if (!bestPhrase) break;

    const id = table.length;
    table.push(bestPhrase);
    wordToId.set(bestPhrase, id);
    // Substitute into the running copy so future counts are accurate
    remaining = remaining.split(bestPhrase).join(`${sep}${id}${sep}`);
    phraseSet.delete(bestPhrase);
  }

  return { table, wordToId };
}

// Single-pass greedy substitution — longest-match wins at each position.
function applyTable(text, wordToId, sep) {
  if (wordToId.size === 0) return text;

  // Group by first character, sorted longest-first within each group
  const byFirst = new Map();
  for (const [phrase] of wordToId) {
    const fc = phrase[0];
    if (!byFirst.has(fc)) byFirst.set(fc, []);
    byFirst.get(fc).push(phrase);
  }
  for (const arr of byFirst.values()) arr.sort((a, b) => b.length - a.length);

  const parts = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const cands  = byFirst.get(text[i]);
    let matched  = false;
    if (cands) {
      for (const phrase of cands) {
        if (text.startsWith(phrase, i)) {
          parts.push(`${sep}${wordToId.get(phrase)}${sep}`);
          i += phrase.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) { parts.push(text[i]); i++; }
  }
  return parts.join("");
}

function reverseTable(text, table, sep) {
  const e = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(
    new RegExp(`${e}(\\d+)${e}`, "g"),
    (match, id) => table[Number(id)] ?? match
  );
}

// ─── Table serialization ──────────────────────────────────────────────────────

function serializeTable(table) {
  return table.map(word => `${word.length}_${word}`).join("");
}

function deserializeTable(blob) {
  const table = [];
  let i = 0;
  while (i < blob.length) {
    let j = i;
    while (j < blob.length && blob[j] !== "_") j++;
    const len  = Number(blob.slice(i, j));
    const word = blob.slice(j + 1, j + 1 + len);
    table.push(word);
    i = j + 1 + len;
  }
  return table;
}

// ─── Header ───────────────────────────────────────────────────────────────────
// Format: "<tableBlobLen>_<encodeMode>_<isCompressed>_<sep>_"
// encodeMode: "n" = none, "t" = table only, "d" = data only, "a" = all

function makeHeader(tableBlobLen, encodeMode, isCompressed, sep) {
  return `${tableBlobLen}${HEADER_SEP}${encodeMode}${HEADER_SEP}${isCompressed ? "c" : "d"}${HEADER_SEP}${sep}${HEADER_SEP}`;
}

function parseHeader(str) {
  const parts = [];
  let pos = 0;
  for (let field = 0; field < 4; field++) {
    const next = str.indexOf(HEADER_SEP, pos);
    if (next === -1) throw new Error(`Bad header: ${JSON.stringify(str.slice(0, 40))}`);
    parts.push(str.slice(pos, next));
    pos = next + 1;
  }
  const headerLen  = pos;
  const rawMode    = parts[1];
  const encodeMode = rawMode === "f" ? "n" : rawMode;   // back-compat with old boolean
  if (!["n", "t", "d", "a"].includes(encodeMode))
    throw new Error(`Unknown encode mode "${encodeMode}" in header.`);
  return {
    headerLen,
    tableBlobLen: Number(parts[0]),
    encodeMode,
    isCompressed: parts[2] === "c",
    sep:          parts[3],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compress (and optionally encrypt) a string.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {"n"|"t"|"d"|"a"} [opts.encode="a"]
 *   "n" none · "t" table only · "d" data only · "a" all (table + data)
 *   Legacy boolean: true → "a", false → "n"
 * @param {boolean} [opts.compress=true]   Apply dictionary + RLE compression
 * @param {string}  [opts.sep]             Force a specific separator char
 * @returns {string}
 */
function compress(text, { encode = "a", compress: doCompress = true, sep: forceSep } = {}) {
  if (encode === true)  encode = "a";
  if (encode === false) encode = "n";
  if (!["n", "t", "d", "a"].includes(encode))
    throw new Error(`Invalid encode mode "${encode}". Use "n", "t", "d", or "a".`);

  let sep          = forceSep ?? chooseSep(text);
  let payload      = text;
  let encodedEarly = false;

  if (!sep) {
    // All separator candidates appear in the text — scramble first to free one up
    payload      = encodeStr(payload);
    encodedEarly = true;
    sep          = chooseSep(payload) ?? SEP_CANDIDATES[0];
  }

  let table = [], wordToId = new Map();

  if (doCompress) {
    ({ table, wordToId } = buildTable(payload, sep));
    payload = applyTable(payload, wordToId, sep);
    payload = applyRLE(payload, sep);
  }

  const encodeMode  = encodedEarly ? "a" : encode;
  const encodeData  = encodeMode === "d" || encodeMode === "a";
  const encodeTable = encodeMode === "t" || encodeMode === "a";

  if (encodeData && !encodedEarly) payload = encodeStr(payload);

  let tableBlob = serializeTable(table);
  if (encodeTable) tableBlob = encodeStr(tableBlob);

  const header = makeHeader(tableBlob.length, encodeMode, doCompress, sep);
  return header + tableBlob + payload;
}

/**
 * Decompress (and decrypt) a payload produced by `compress`.
 *
 * @param {string} compressed
 * @returns {string}
 */
function decompress(compressed) {
  const { headerLen, tableBlobLen, encodeMode, isCompressed, sep } = parseHeader(compressed);

  let tableBlob = compressed.slice(headerLen, headerLen + tableBlobLen);
  let payload   = compressed.slice(headerLen + tableBlobLen);

  const decodeData  = encodeMode === "d" || encodeMode === "a";
  const decodeTable = encodeMode === "t" || encodeMode === "a";

  if (decodeTable) tableBlob = decodeStr(tableBlob);
  const table = deserializeTable(tableBlob);

  if (decodeData) payload = decodeStr(payload);
  if (isCompressed) {
    payload = reverseRLE(payload, sep);
    payload = reverseTable(payload, table, sep);
  }

  return payload;
}

// ─── Exports ──────────────────────────────────────────────────────────────────


export { compress, decompress };
