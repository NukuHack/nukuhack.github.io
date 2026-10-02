// src/lib/image.js
// ─────────────────────────────────────────────────────────────────────────
//  Tiny image helpers: clipboard reading, data-URL ↔ Blob/bytes conversion,
//  natural-size lookup, and small textarea helpers. No dependencies.
// ─────────────────────────────────────────────────────────────────────────

/* ── Data URL helpers ─────────────────────────────────────────────────── */

export function isDataUrl(s) {
  return typeof s === 'string' && /^data:[^,]*;base64,/i.test(s);
}

export function dataUrlMime(dataUrl) {
  const m = /^data:([^;,]+)/i.exec(dataUrl || '');
  return m ? m[1].toLowerCase() : '';
}

/** Decodes a base64 `data:` URL into a Uint8Array (or null on failure). */
export function dataUrlToBytes(dataUrl) {
  const m = /^data:[^,]*;base64,(.*)$/is.exec(dataUrl || '');
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error || new Error('FileReader failed'));
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const raw = m[2] ? atob(m[3].replace(/\s+/g, '')) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ── Natural size ─────────────────────────────────────────────────────── */

/** Resolves { width, height } for any src a browser can render. */
export function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('No src'));
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/* ── Clipboard ────────────────────────────────────────────────────────── */

/** Pulls the first image file out of a `paste` (or `drop`) event, if any. */
export function readClipboardImageFromEvent(e) {
  const items = e?.clipboardData?.items;
  if (!items) return null;
  for (const it of items) {
    if (it.kind === 'file' && /^image\//.test(it.type)) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

/** Async clipboard API — needs permission, may return null. */
export async function readClipboardImage() {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          if (blob) return blob;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/* ── Filename / extension helpers ─────────────────────────────────────── */

export function extFromMime(mime) {
  switch ((mime || '').toLowerCase()) {
    case 'image/png': return 'png';
    case 'image/jpeg':
    case 'image/jpg': return 'jpeg';
    case 'image/gif': return 'gif';
    default: return 'png';
  }
}

/* ── Textarea insertion (returns new value + cursor range) ────────────── */

export function computeInsertion(textarea, text) {
  const value = textarea?.value ?? '';
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? start;
  return {
    value: value.slice(0, start) + text + value.slice(end),
    selectionStart: start + text.length,
    selectionEnd: start + text.length,
  };
}