// ─────────────────────────────────────────────────────────────────────────
//  src/lib/docToHtml.js
//
//  Universal "document → rich HTML" converter for the Convert page.
//
//  This is the spiritual successor to doc_to_txt.py, but where that script
//  flattened everything to one line of text, this preserves the structure
//  the source formats actually carry:
//
//    • .docx → reuses DocxRenderer from documentViewer.js, so bold/italic/
//              underline/strike, font colour, highlight, shading, alignment,
//              indents, paragraph spacing, real <ol>/<ul> with list-style-
//              type, tables with colspan/rowspan, hyperlinks and embedded
//              images (as data: URLs) all survive.
//    • .odt  → real XML walker: paragraph/character styles, list styles
//              (ordered vs bullet), headings, tables, links, embedded imgs.
//    • .md   → rendered through marked (GFM tables, ---, fenced code, …).
//    • .html → sanitised but structurally preserved (styles kept).
//    • .csv  → real <table>.
//    • .json → pretty-printed <pre>.
//    • text  → paragraphs on blank lines, <br> for soft breaks.
// ─────────────────────────────────────────────────────────────────────────

import { DocxRenderer } from './documentViewer.js';

/* ── tiny helpers ──────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const _scripts = new Map();
function loadScript(url) {
  if (_scripts.has(url)) return _scripts.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(s);
  });
  _scripts.set(url, p);
  return p;
}

const MARKED_URL = 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js';

/* ── text decoding (read_text) ─────────────────────────────────────────── */

async function readText(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  }
  for (const enc of ['utf-8', 'utf-16le', 'latin1']) {
    try { return new TextDecoder(enc, { fatal: true }).decode(buf); }
    catch { /* try next */ }
  }
  return new TextDecoder('utf-8').decode(buf);
}

/* ── mime guesser (used by ODT image embedding) ────────────────────────── */

function guessMime(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml',
    webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
    emf: 'image/x-emf', wmf: 'image/x-wmf',
  })[ext] || 'application/octet-stream';
}

/* ═════════════════════════════════════════════════════════════════════════
 *  DOCX  —  delegate to the full OOXML renderer already in the codebase.
 * ═════════════════════════════════════════════════════════════════════════ */

async function docxToHtml(file) {
  if (!window.JSZip) throw new Error('JSZip is not loaded — call ensureDeps() first.');
  const renderer = await DocxRenderer.fromFile(file);
  const { blocks, title } = await renderer.render();
  // `blocks` is an array of { html, breakBefore }; we join them into a
  // single continuous document (no pagination) since this is HTML, not a
  // paged Word layout. `breakBefore` was only used to place page numbers
  // in the DOCX viewer — irrelevant here, so we ignore it.
  return { html: blocks.map((b) => b.html).join('\n'), title };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  ODT  —  real XML walker (styles + lists + tables + images).
 * ═════════════════════════════════════════════════════════════════════════ */

const ODF_NS = {
  text:   'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style:  'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo:     'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  table:  'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  draw:   'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  xlink:  'http://www.w3.org/1999/xlink',
};

function collectOdtStyles(doc, out) {
  // style:style — used by both paragraphs and spans
  for (const s of doc.getElementsByTagNameNS(ODF_NS.style, 'style')) {
    const name = s.getAttributeNS(ODF_NS.style, 'name');
    if (!name) continue;
    const st = {};

    const tp = s.getElementsByTagNameNS(ODF_NS.style, 'text-properties')[0];
    if (tp) {
      const fw = tp.getAttributeNS(ODF_NS.fo, 'font-weight');
      if (fw) st.fontWeight = fw;
      const fs = tp.getAttributeNS(ODF_NS.fo, 'font-style');
      if (fs) st.fontStyle = fs;
      const us = tp.getAttributeNS(ODF_NS.style, 'text-underline-style');
      if (us && us !== 'none') st.underline = true;
      const ls = tp.getAttributeNS(ODF_NS.style, 'text-line-through-style');
      if (ls && ls !== 'none') st.strike = true;
      const col = tp.getAttributeNS(ODF_NS.fo, 'color');
      if (col) st.color = col;
      const bg = tp.getAttributeNS(ODF_NS.fo, 'background-color');
      if (bg && bg !== 'transparent') st.background = bg;
      const sz = tp.getAttributeNS(ODF_NS.fo, 'font-size');
      if (sz) st.fontSize = sz;
    }

    const pp = s.getElementsByTagNameNS(ODF_NS.style, 'paragraph-properties')[0];
    if (pp) {
      const ta = pp.getAttributeNS(ODF_NS.fo, 'text-align');
      if (ta) st.textAlign = ta;
      const ml = pp.getAttributeNS(ODF_NS.fo, 'margin-left');
      if (ml) st.marginLeft = ml;
      const mr = pp.getAttributeNS(ODF_NS.fo, 'margin-right');
      if (mr) st.marginRight = mr;
      const mt = pp.getAttributeNS(ODF_NS.fo, 'margin-top');
      if (mt) st.marginTop = mt;
      const mb = pp.getAttributeNS(ODF_NS.fo, 'margin-bottom');
      if (mb) st.marginBottom = mb;
      const bg = pp.getAttributeNS(ODF_NS.fo, 'background-color');
      if (bg && bg !== 'transparent' && !st.background) st.background = bg;
    }

    out.text[name] = st;
  }

  // text:list-style — used to distinguish <ol> from <ul>
  for (const ls of doc.getElementsByTagNameNS(ODF_NS.text, 'list-style')) {
    const name = ls.getAttributeNS(ODF_NS.style, 'name');
    if (!name) continue;
    let ordered = false;
    for (const child of ls.children) {
      if (child.namespaceURI === ODF_NS.text && child.localName === 'list-level-style-number') {
        ordered = true;
        break;
      }
    }
    out.list[name] = { ordered };
  }
}

function odtStyleToCss(st) {
  if (!st) return '';
  const p = [];
  if (st.fontWeight && st.fontWeight !== 'normal') p.push(`font-weight:${st.fontWeight}`);
  if (st.fontStyle && st.fontStyle !== 'normal') p.push(`font-style:${st.fontStyle}`);
  const deco = [];
  if (st.underline) deco.push('underline');
  if (st.strike) deco.push('line-through');
  if (deco.length) p.push(`text-decoration:${deco.join(' ')}`);
  if (st.color) p.push(`color:${st.color}`);
  if (st.background) p.push(`background-color:${st.background}`);
  if (st.fontSize) p.push(`font-size:${st.fontSize}`);
  if (st.textAlign) p.push(`text-align:${st.textAlign}`);
  if (st.marginLeft) p.push(`margin-left:${st.marginLeft}`);
  if (st.marginRight) p.push(`margin-right:${st.marginRight}`);
  if (st.marginTop) p.push(`margin-top:${st.marginTop}`);
  if (st.marginBottom) p.push(`margin-bottom:${st.marginBottom}`);
  return p.join(';');
}

async function odtFrame(frame, zip) {
  const imgs = frame.getElementsByTagNameNS(ODF_NS.draw, 'image');
  if (!imgs.length) return '';
  const href = imgs[0].getAttributeNS(ODF_NS.xlink, 'href');
  if (!href) return '';
  const entry = zip.file(href);
  if (!entry) return '';
  const b64 = await entry.async('base64');
  return `<img src="data:${guessMime(href)};base64,${b64}" style="max-width:100%;height:auto" alt="">`;
}

async function odtInline(node, styles, zip) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { out += esc(child.nodeValue); continue; }
    if (child.nodeType !== 1) continue;

    const ns = child.namespaceURI;
    const local = child.localName;

    if (ns === ODF_NS.text && local === 'span') {
      const inner = await odtInline(child, styles, zip);
      const css = odtStyleToCss(styles.text[child.getAttributeNS(ODF_NS.text, 'style-name')]);
      out += css ? `<span style="${css}">${inner}</span>` : inner;
    } else if (ns === ODF_NS.text && local === 's') {
      const c = parseInt(child.getAttributeNS(ODF_NS.text, 'c') || '1', 10);
      out += ' '.repeat(c);
    } else if (ns === ODF_NS.text && local === 'tab') {
      out += '\t';
    } else if (ns === ODF_NS.text && local === 'line-break') {
      out += '<br>';
    } else if (ns === ODF_NS.text && local === 'a') {
      const href = child.getAttributeNS(ODF_NS.xlink, 'href');
      const inner = await odtInline(child, styles, zip);
      out += href ? `<a href="${esc(href)}">${inner}</a>` : inner;
    } else if (ns === ODF_NS.draw && local === 'frame') {
      out += await odtFrame(child, zip);
    } else {
      out += await odtInline(child, styles, zip);
    }
  }
  return out;
}

async function odtList(listEl, styles, zip) {
  const styleName = listEl.getAttributeNS(ODF_NS.text, 'style-name');
  const ordered = !!(styles.list[styleName] && styles.list[styleName].ordered);
  const tag = ordered ? 'ol' : 'ul';

  let out = `<${tag}>`;
  for (const item of listEl.children) {
    if (item.namespaceURI !== ODF_NS.text || item.localName !== 'list-item') continue;

    let inline = '';
    let nested = '';
    for (const sub of item.children) {
      const sns = sub.namespaceURI;
      const sl = sub.localName;
      if (sns === ODF_NS.text && sl === 'p') {
        if (inline) inline += '<br>';
        inline += await odtInline(sub, styles, zip);
      } else if (sns === ODF_NS.text && sl === 'h') {
        if (inline) inline += '<br>';
        const lvl = Math.max(1, Math.min(6, parseInt(sub.getAttributeNS(ODF_NS.text, 'outline-level') || '3', 10)));
        inline += `<h${lvl}>${await odtInline(sub, styles, zip)}</h${lvl}>`;
      } else if (sns === ODF_NS.text && sl === 'list') {
        nested += await odtList(sub, styles, zip);
      }
    }
    out += `<li>${inline || '&nbsp;'}${nested}</li>`;
  }
  return out + `</${tag}>`;
}

async function odtTable(tableEl, styles, zip) {
  let out = '<table>';
  for (const row of tableEl.children) {
    if (row.namespaceURI !== ODF_NS.table || row.localName !== 'table-row') continue;
    out += '<tr>';
    for (const cell of row.children) {
      if (cell.namespaceURI !== ODF_NS.table) continue;
      if (cell.localName === 'covered-table-cell') continue;
      if (cell.localName !== 'table-cell') continue;

      const colspan = parseInt(cell.getAttributeNS(ODF_NS.table, 'number-columns-spanned') || '1', 10);
      const rowspan = parseInt(cell.getAttributeNS(ODF_NS.table, 'number-rows-spanned') || '1', 10);
      const attrs = (colspan > 1 ? ` colspan="${colspan}"` : '') + (rowspan > 1 ? ` rowspan="${rowspan}"` : '');

      let content = '';
      for (const sub of cell.children) {
        if (sub.namespaceURI === ODF_NS.text && sub.localName === 'p') {
          content += `<p>${await odtInline(sub, styles, zip)}</p>`;
        }
      }
      out += `<td${attrs}>${content || '&nbsp;'}</td>`;
    }
    out += '</tr>';
  }
  return out + '</table>';
}

async function odtBlocks(parent, styles, zip) {
  let out = '';
  for (const child of parent.children) {
    const ns = child.namespaceURI;
    const local = child.localName;

    if (ns === ODF_NS.text && local === 'h') {
      const lvl = Math.max(1, Math.min(6, parseInt(child.getAttributeNS(ODF_NS.text, 'outline-level') || '1', 10)));
      const inner = await odtInline(child, styles, zip);
      const css = odtStyleToCss(styles.text[child.getAttributeNS(ODF_NS.text, 'style-name')]);
      out += `<h${lvl}${css ? ` style="${css}"` : ''}>${inner}</h${lvl}>`;
    } else if (ns === ODF_NS.text && local === 'p') {
      const inner = await odtInline(child, styles, zip);
      const css = odtStyleToCss(styles.text[child.getAttributeNS(ODF_NS.text, 'style-name')]);
      out += `<p${css ? ` style="${css}"` : ''}>${inner || '<br>'}</p>`;
    } else if (ns === ODF_NS.text && local === 'list') {
      out += await odtList(child, styles, zip);
    } else if (ns === ODF_NS.table && local === 'table') {
      out += await odtTable(child, styles, zip);
    } else if (ns === ODF_NS.office && local === 'text') {
      out += await odtBlocks(child, styles, zip);
    } else if (ns === ODF_NS.text && local === 'section') {
      out += await odtBlocks(child, styles, zip);
    }
  }
  return out;
}

async function odtToHtml(file) {
  if (!window.JSZip) throw new Error('JSZip is not loaded — call ensureDeps() first.');
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const contentEntry = zip.file('content.xml');
  if (!contentEntry) throw new Error('Not a valid ODT file (missing content.xml).');
  const contentXml = await contentEntry.async('string');
  const stylesEntry = zip.file('styles.xml');
  const stylesXml = stylesEntry ? await stylesEntry.async('string') : '';

  const contentDoc = new DOMParser().parseFromString(contentXml, 'application/xml');
  const stylesDoc  = stylesXml ? new DOMParser().parseFromString(stylesXml, 'application/xml') : null;

  const styles = { text: {}, list: {} };
  collectOdtStyles(contentDoc, styles);
  if (stylesDoc) collectOdtStyles(stylesDoc, styles);

  // office:body / office:text is the actual content container.
  const body =
    contentDoc.getElementsByTagNameNS(ODF_NS.office, 'text')[0] ||
    contentDoc.documentElement;

  return { html: await odtBlocks(body, styles, zip), title: file.name };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  Markdown  —  hand off to marked (GFM).
 * ═════════════════════════════════════════════════════════════════════════ */

async function markdownToHtml(file) {
  if (!window.marked) await loadScript(MARKED_URL);
  const text = await readText(file);
  const html = window.marked.parse(text, { gfm: true, breaks: false });
  return { html, title: file.name };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  HTML  —  keep everything except scripts / inline handlers.
 * ═════════════════════════════════════════════════════════════════════════ */

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, iframe, object, embed, noscript, template, base').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (
        (attr.name === 'href' || attr.name === 'src' || attr.name === 'xlink:href') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body ? doc.body.innerHTML : '';
}

async function htmlToHtml(file) {
  const raw = await readText(file);
  return { html: sanitizeHtml(raw), title: file.name };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  CSV / TSV  →  real <table>
 * ═════════════════════════════════════════════════════════════════════════ */

function parseDelimited(text, delim) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // skip CR
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

async function delimitedToHtml(file, delim) {
  const text = await readText(file);
  const rows = parseDelimited(text, delim);
  if (!rows.length) return { html: '<p>(empty)</p>', title: file.name };

  const [header, ...body] = rows;
  const th = header.map((h) => `<th>${esc(h)}</th>`).join('');
  const trs = body
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return {
    html: `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`,
    title: file.name,
  };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  JSON  →  pretty <pre>
 * ═════════════════════════════════════════════════════════════════════════ */

async function jsonToHtml(file) {
  const text = await readText(file);
  let pretty = text;
  try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
  return { html: `<pre>${esc(pretty)}</pre>`, title: file.name };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  Plain text  →  paragraphs on blank lines, <br> for hard breaks.
 * ═════════════════════════════════════════════════════════════════════════ */

function textToHtml(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let buf = [];
  for (const ln of lines) {
    if (ln.trim() === '') {
      if (buf.length) { blocks.push(buf.join('\n')); buf = []; }
    } else {
      buf.push(ln);
    }
  }
  if (buf.length) blocks.push(buf.join('\n'));
  return blocks.map((b) => `<p>${esc(b).replace(/\n/g, '<br>')}</p>`).join('\n');
}

async function textToHtmlFile(file) {
  const text = await readText(file);
  return { html: textToHtml(text), title: file.name };
}

/* ═════════════════════════════════════════════════════════════════════════
 *  Public API
 * ═════════════════════════════════════════════════════════════════════════ */

const TEXT_EXTS = new Set([
  'txt', 'log', 'ini', 'cfg', 'conf', 'yaml', 'yml', 'rst',
]);

/**
 * Port of doc_to_txt.py, but returning structured, styled HTML.
 * @param {File} file
 * @returns {Promise<{ html: string, title: string, kind: string }>}
 */
export async function extractDocumentToHtml(file) {
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';

  try {
    if (ext === 'docx' || ext === 'docm' || ext === 'dotx' || ext === 'dotm') {
      const r = await docxToHtml(file);
      return { ...r, kind: 'docx' };
    }
    if (ext === 'odt' || ext === 'fodt') {
      // Flat ODT (fodt) is a single XML file, not a zip.
      if (ext === 'fodt') {
        const text = await readText(file);
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const styles = { text: {}, list: {} };
        collectOdtStyles(doc, styles);
        const body = doc.getElementsByTagNameNS(ODF_NS.office, 'text')[0] || doc.documentElement;
        return { html: await odtBlocks(body, styles, { file: () => null }), title: file.name, kind: 'odt' };
      }
      const r = await odtToHtml(file);
      return { ...r, kind: 'odt' };
    }
    if (ext === 'md' || ext === 'markdown' || ext === 'mdown') {
      const r = await markdownToHtml(file);
      return { ...r, kind: 'markdown' };
    }
    if (ext === 'html' || ext === 'htm' || ext === 'xhtml') {
      const r = await htmlToHtml(file);
      return { ...r, kind: 'html' };
    }
    if (ext === 'csv') {
      const r = await delimitedToHtml(file, ',');
      return { ...r, kind: 'csv' };
    }
    if (ext === 'tsv' || ext === 'tab') {
      const r = await delimitedToHtml(file, '\t');
      return { ...r, kind: 'tsv' };
    }
    if (ext === 'json' || ext === 'geojson') {
      const r = await jsonToHtml(file);
      return { ...r, kind: 'json' };
    }
    if (TEXT_EXTS.has(ext)) {
      const r = await textToHtmlFile(file);
      return { ...r, kind: 'text' };
    }
    // Unknown: best-effort text.
    const r = await textToHtmlFile(file);
    return { ...r, kind: 'text' };
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/* ── Standalone page wrapper ───────────────────────────────────────────── */

export function wrapHtmlPage(fragment, title = 'Document') {
  const safeTitle = esc(title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  :root { color-scheme: light; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Calibri, "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1f1f1f;
    background: #fff;
  }
  main {
    max-width: 850px;
    margin: 0 auto;
    padding: 2.5rem 2.5rem 4rem;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin: 1.4em 0 0.5em;
    font-weight: 600;
    color: #111;
  }
  h1 { font-size: 2em; }
  h2 { font-size: 1.55em; }
  h3 { font-size: 1.3em; }
  h4 { font-size: 1.15em; }
  h5 { font-size: 1em; }
  h6 { font-size: 0.9em; color: #555; }
  h1:first-child, h2:first-child, h3:first-child, p:first-child { margin-top: 0; }
  p { margin: 0.5em 0; }
  ul, ol { margin: 0.5em 0; padding-left: 2em; }
  li { margin: 0.15em 0; }
  li > p { margin: 0; }
  li > ul, li > ol { margin: 0.15em 0; }
  a { color: #0563c1; text-decoration: underline; }
  a:visited { color: #6b3fa0; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  del, s { text-decoration: line-through; }
  u { text-decoration: underline; }
  code, pre, kbd, samp {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.92em;
  }
  code { background: #f2f2f4; padding: 0.1em 0.35em; border-radius: 3px; }
  pre {
    background: #f5f5f7;
    padding: 0.9em 1.1em;
    overflow-x: auto;
    border-radius: 6px;
    line-height: 1.45;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 4px solid #cfcfd6;
    margin: 0.8em 0;
    padding: 0.1em 1em;
    color: #555;
  }
  hr { border: none; border-top: 1px solid #d0d0d5; margin: 1.5em 0; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; margin: 0.8em 0; }
  th, td { border: 1px solid #b8b8bf; padding: 0.35em 0.6em; vertical-align: top; text-align: left; }
  th { background: #f2f2f5; font-weight: 600; }
  table p { margin: 0; }
  mark { background: #ffe680; padding: 0.05em 0.15em; }
  .doc-title { text-align: center; }
  sup { font-size: 0.75em; vertical-align: super; }
  sub { font-size: 0.75em; vertical-align: sub; }
</style>
</head>
<body>
<main>
${fragment}
</main>
</body>
</html>
`;
}