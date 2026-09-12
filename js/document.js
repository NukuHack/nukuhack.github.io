
"use strict";

/* ======================================================================
 *  0.  Tiny DOM + utility helpers
 * ====================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const XML_NS = {
  w:"http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  r:"http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  wp:"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  a:"http://schemas.openxmlformats.org/drawingml/2006/main",
  rel:"http://schemas.openxmlformats.org/package/2006/relationships",
  dc:"http://purl.org/dc/elements/1.1/",
  ss:"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  pkg:"http://schemas.openxmlformats.org/package/2006/relationships",
};

const escapeHtml = s => String(s ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const escapeAttr = escapeHtml;

function parseXml(str) {
  const doc = new DOMParser().parseFromString(str, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML parse error");
  return doc;
}
async function parseXmlZip(zip, path) {
  const f = zip.file(path);
  return f ? parseXml(await f.async("string")) : null;
}
const childEls      = (n, ns, l) => !n ? [] : Array.from(n.children).filter(c => c.namespaceURI === ns && c.localName === l);
const firstChildEl  = (n, ns, l) => childEls(n, ns, l)[0] || null;
const allDescendants= (n, ns, l) => n ? Array.from(n.getElementsByTagNameNS(ns, l)) : [];
const attr          = (el, ns, name) => el ? el.getAttributeNS(ns, name) : null;
const twipsToPx = v => { const n = parseInt(v,10); return isNaN(n) ? 0 : Math.round(n/15); };
const emuToPx   = v => { const n = parseInt(v,10); return isNaN(n) ? null : Math.round(n/9525); };

/* ======================================================================
 *  1.  Lazy loaders  (scripts + ESM modules)
 * ====================================================================== */
const _loadedScripts = new Map();

function loadScript(url) {
  if (_loadedScripts.has(url)) return _loadedScripts.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
  _loadedScripts.set(url, p);
  return p;
}

const _loadedModules = new Map();
function loadModule(url) {
  if (_loadedModules.has(url)) return _loadedModules.get(url);
  const p = import(/* @vite-ignore */ url);
  _loadedModules.set(url, p);
  return p;
}

/* ======================================================================
 *  2.  Reusable renderers  (DOCX + XLSX from the earlier answer)
 * ====================================================================== */

/* -------- DOCX -------- */
const HIGHLIGHT_COLORS = {
  yellow:"#FFFF00", green:"#00FF00", cyan:"#00FFFF", magenta:"#FF00FF",
  blue:"#0000FF", red:"#FF0000", darkBlue:"#000080", darkCyan:"#008080",
  darkGreen:"#008000", darkMagenta:"#800080", darkRed:"#800000",
  darkYellow:"#808000", darkGray:"#808080", lightGray:"#C0C0C0", black:"#000000",
};
const JC_MAP = { left:"left", right:"right", center:"center", both:"justify", distribute:"justify" };
const ORDERED_FORMATS = {
  decimal:"decimal", decimalZero:"decimal",
  lowerLetter:"lower-alpha", upperLetter:"upper-alpha",
  lowerRoman:"lower-roman", upperRoman:"upper-roman",
};
// Internal marker for an explicit <w:br w:type="page"/> inside a run's text
// stream, letting the top-level paragraph renderer split into page-aware
// blocks. Never shown to the user.
const PAGE_BREAK_MARKER = "\u0000PAGE_BREAK\u0000";

class DocxRenderer {
  constructor(zip, parts) {
    this.zip = zip;
    this.document   = parts.document.documentElement;
    this.rels       = this._loadRels(parts.rels);
    this.numbering  = this._loadNumbering(parts.numbering);
    this.styleNumPr = this._loadStyleNumPr(parts.styles);
    this.coreDoc    = parts.core;
    this._imageCache = {};
  }
  _loadRels(relsDoc) {
    const out = {};
    if (!relsDoc) return out;
    for (const rel of childEls(relsDoc.documentElement, XML_NS.rel, "Relationship"))
      out[rel.getAttribute("Id")] = {
        target: rel.getAttribute("Target"),
        mode:   rel.getAttribute("TargetMode") || "Internal",
      };
    return out;
  }
  async _imageDataUri(rId) {
    if (this._imageCache[rId] !== undefined) return this._imageCache[rId];
    const rel = this.rels[rId];
    if (!rel || rel.mode === "External") {
      this._imageCache[rId] = rel && rel.mode === "External" ? rel.target : null;
      return this._imageCache[rId];
    }
    let path = rel.target.startsWith("word/") ? rel.target : "word/" + rel.target.replace(/^\/+/, "");
    path = path.replace(/word\/word\//, "word/");
    let entry = this.zip.file(path);
    if (!entry) entry = this.zip.file("word/" + rel.target);
    if (!entry) { this._imageCache[rId] = null; return null; }
    const b64 = await entry.async("base64");
    const uri = `data:${guessMime(path)};base64,${b64}`;
    this._imageCache[rId] = uri;
    return uri;
  }
  _loadNumbering(doc) {
    const out = {};
    if (!doc) return out;
    const root = doc.documentElement;
    const abstract = {};
    for (const an of childEls(root, XML_NS.w, "abstractNum")) {
      const id = an.getAttributeNS(XML_NS.w, "abstractNumId");
      const levels = {};
      for (const lvl of childEls(an, XML_NS.w, "lvl")) {
        const ilvl = lvl.getAttributeNS(XML_NS.w, "ilvl");
        const fmtEl = firstChildEl(lvl, XML_NS.w, "numFmt");
        levels[ilvl] = fmtEl ? fmtEl.getAttributeNS(XML_NS.w, "val") : "decimal";
      }
      abstract[id] = levels;
    }
    for (const num of childEls(root, XML_NS.w, "num")) {
      const numId = num.getAttributeNS(XML_NS.w, "numId");
      const ref = firstChildEl(num, XML_NS.w, "abstractNumId");
      if (ref) out[numId] = abstract[ref.getAttributeNS(XML_NS.w, "val")] || {};
    }
    return out;
  }
  _loadStyleNumPr(doc) {
    if (!doc) return {};
    const raw = {}, basedOn = {};
    for (const style of childEls(doc.documentElement, XML_NS.w, "style")) {
      const id = style.getAttributeNS(XML_NS.w, "styleId");
      const based = firstChildEl(style, XML_NS.w, "basedOn");
      if (based) basedOn[id] = based.getAttributeNS(XML_NS.w, "val");
      const ppr = firstChildEl(style, XML_NS.w, "pPr");
      if (!ppr) continue;
      const numPr = firstChildEl(ppr, XML_NS.w, "numPr");
      if (!numPr) continue;
      const numIdEl = firstChildEl(numPr, XML_NS.w, "numId");
      const ilvlEl  = firstChildEl(numPr, XML_NS.w, "ilvl");
      if (numIdEl) raw[id] = [numIdEl.getAttributeNS(XML_NS.w, "val"),
                              ilvlEl ? ilvlEl.getAttributeNS(XML_NS.w, "val") : null];
    }
    const resolve = (id, seen = new Set()) => {
      if (raw[id]) return raw[id];
      const p = basedOn[id];
      if (p && !seen.has(id)) return resolve(p, new Set([...seen, id]));
      return null;
    };
    const out = {};
    for (const id of new Set([...Object.keys(raw), ...Object.keys(basedOn)])) out[id] = resolve(id);
    return out;
  }
  _listFormat(numId, ilvl) {
    return (this.numbering[numId] || {})[ilvl] || "bullet";
  }
  async _runToHtml(run) {
    const rpr = firstChildEl(run, XML_NS.w, "rPr");
    const styles = [];
    if (rpr) {
      const hl = firstChildEl(rpr, XML_NS.w, "highlight");
      if (hl) { const c = HIGHLIGHT_COLORS[hl.getAttributeNS(XML_NS.w, "val")]; if (c) styles.push(`background-color:${c}`); }
      const col = firstChildEl(rpr, XML_NS.w, "color");
      if (col) { const v = col.getAttributeNS(XML_NS.w, "val"); if (v && v !== "auto") styles.push(`color:#${v}`); }
      const sz = firstChildEl(rpr, XML_NS.w, "sz");
      if (sz) { const n = parseInt(sz.getAttributeNS(XML_NS.w, "val"), 10); if (!isNaN(n)) styles.push(`font-size:${n/2}pt`); }
      const b = firstChildEl(rpr, XML_NS.w, "b");
      if (b && b.getAttributeNS(XML_NS.w, "val") !== "false") styles.push("font-weight:bold");
      const i = firstChildEl(rpr, XML_NS.w, "i");
      if (i && i.getAttributeNS(XML_NS.w, "val") !== "false") styles.push("font-style:italic");
      const u = firstChildEl(rpr, XML_NS.w, "u");
      const uv = u && u.getAttributeNS(XML_NS.w, "val");
      if (u && uv && uv !== "none") styles.push("text-decoration:underline");
      const strike = firstChildEl(rpr, XML_NS.w, "strike");
      if (strike && strike.getAttributeNS(XML_NS.w, "val") !== "false") {
        const idx = styles.findIndex(s => s.startsWith("text-decoration"));
        if (idx >= 0) styles[idx] = "text-decoration:underline line-through";
        else styles.push("text-decoration:line-through");
      }
    }
    const parts = [];
    for (const child of run.children) {
      switch (child.localName) {
        case "t": parts.push(escapeHtml(child.textContent)); break;
        case "br": case "cr":
          parts.push((child.localName === "br" && child.getAttributeNS(XML_NS.w, "type") === "page")
            ? PAGE_BREAK_MARKER : "<br>");
          break;
        case "tab": parts.push('<span style="display:inline-block;width:24px"></span>'); break;
        case "noBreakHyphen": parts.push("-"); break;
        case "softHyphen": parts.push("&shy;"); break;
        case "drawing": { const img = await this._drawingToHtml(child); if (img) parts.push(img); break; }
      }
    }
    const inner = parts.join("");
    if (!inner) return "";
    return styles.length ? `<span style="${styles.join(";")}">${inner}</span>` : inner;
  }
  async _drawingToHtml(drawing) {
    const blip = allDescendants(drawing, XML_NS.a, "blip")[0];
    if (!blip) return "";
    const rId = blip.getAttributeNS(XML_NS.r, "embed");
    if (!rId) return "";
    const src = await this._imageDataUri(rId);
    if (!src) return "";
    const extent = allDescendants(drawing, XML_NS.wp, "extent")[0];
    let dims = "";
    if (extent) {
      const w = emuToPx(extent.getAttribute("cx"));
      const h = emuToPx(extent.getAttribute("cy"));
      if (w && h) dims = ` width="${w}" height="${h}"`;
    }
    return `<img src="${src}"${dims} alt="">`;
  }
  _paragraphStyle(ppr) {
    const out = [];
    if (!ppr) return out;
    const jc = firstChildEl(ppr, XML_NS.w, "jc");
    if (jc) { const v = jc.getAttributeNS(XML_NS.w, "val"); if (JC_MAP[v]) out.push(`text-align:${JC_MAP[v]}`); }
    const ind = firstChildEl(ppr, XML_NS.w, "ind");
    if (ind) {
      const l = ind.getAttributeNS(XML_NS.w, "left") || ind.getAttributeNS(XML_NS.w, "start");
      const r = ind.getAttributeNS(XML_NS.w, "right") || ind.getAttributeNS(XML_NS.w, "end");
      const f = ind.getAttributeNS(XML_NS.w, "firstLine");
      if (l) out.push(`margin-left:${twipsToPx(l)}px`);
      if (r) out.push(`margin-right:${twipsToPx(r)}px`);
      if (f) out.push(`text-indent:${twipsToPx(f)}px`);
    }
    const spacing = firstChildEl(ppr, XML_NS.w, "spacing");
    if (spacing) {
      const before = spacing.getAttributeNS(XML_NS.w, "before");
      const after  = spacing.getAttributeNS(XML_NS.w, "after");
      const line   = spacing.getAttributeNS(XML_NS.w, "line");
      if (before) out.push(`margin-top:${twipsToPx(before)}px`);
      if (after)  out.push(`margin-bottom:${twipsToPx(after)}px`);
      if (line) { const n = parseInt(line, 10); if (!isNaN(n)) out.push(`line-height:${(n/240).toFixed(2)}`); }
    }
    return out;
  }
  _paragraphListInfo(ppr) {
    if (!ppr) return null;
    let numId = null, ilvl = "0";
    const numPr = firstChildEl(ppr, XML_NS.w, "numPr");
    if (numPr) {
      const ilvlEl  = firstChildEl(numPr, XML_NS.w, "ilvl");
      const numIdEl = firstChildEl(numPr, XML_NS.w, "numId");
      if (numIdEl) { numId = numIdEl.getAttributeNS(XML_NS.w, "val"); ilvl = ilvlEl ? ilvlEl.getAttributeNS(XML_NS.w, "val") : "0"; }
    }
    if (numId === null) {
      const styleEl = firstChildEl(ppr, XML_NS.w, "pStyle");
      if (styleEl) {
        const resolved = this.styleNumPr[styleEl.getAttributeNS(XML_NS.w, "val")];
        if (resolved) { numId = resolved[0]; if (resolved[1] != null) ilvl = resolved[1]; }
      }
    }
    if (numId === null || numId === "0") return null;
    const fmt = this._listFormat(numId, ilvl);
    return { numId, ilvl: parseInt(ilvl,10), ordered: !!ORDERED_FORMATS[fmt], listStyle: ORDERED_FORMATS[fmt] || "disc" };
  }
  async _paragraphInnerHtml(p) {
    const parts = [];
    for (const child of p.children) {
      const tag = child.localName;
      if (tag === "r") parts.push(await this._runToHtml(child));
      else if (tag === "hyperlink") {
        const rId = child.getAttributeNS(XML_NS.r, "id");
        const rel = this.rels[rId];
        const href = (rel && rel.target) || "#";
        const inner = [];
        for (const r of childEls(child, XML_NS.w, "r")) inner.push(await this._runToHtml(r));
        parts.push(`<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${inner.join("")}</a>`);
      }
    }
    return parts.join("");
  }
  async _paragraphToHtml(p) {
    const ppr = firstChildEl(p, XML_NS.w, "pPr");
    const styles = this._paragraphStyle(ppr);
    let inner = await this._paragraphInnerHtml(p);
    // Table cells/list items aren't split across pages, so any explicit
    // page break just collapses to a line break here.
    inner = inner.split(PAGE_BREAK_MARKER).join("<br>");
    const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
    return `<p${styleAttr}>${inner || "<br>"}</p>`;
  }
  // Top-level paragraph renderer: honors w:pageBreakBefore and any inline
  // <w:br w:type="page"/> by splitting into multiple blocks, each tagged
  // with whether a forced page break precedes it.
  async _paragraphToBlocks(p) {
    const ppr = firstChildEl(p, XML_NS.w, "pPr");
    const styles = this._paragraphStyle(ppr);
    const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
    const forceBreak = !!(ppr && firstChildEl(ppr, XML_NS.w, "pageBreakBefore"));
    const inner = await this._paragraphInnerHtml(p);
    const segments = inner.split(PAGE_BREAK_MARKER);
    return segments.map((seg, idx) => ({
      html: `<p${styleAttr}>${seg || "<br>"}</p>`,
      breakBefore: idx === 0 ? forceBreak : true,
    }));
  }
  async _renderBody(body) {
    const blocks = [];
    const listStack = [];
    let listHtml = "";
    let listForceBreak = false;
    const flushList = () => {
      if (!listStack.length) return;
      let html = listHtml;
      while (listStack.length) { const { ordered } = listStack.pop(); html += ordered ? "</ol>" : "</ul>"; }
      blocks.push({ html, breakBefore: listForceBreak });
      listHtml = ""; listForceBreak = false;
    };
    for (const el of body.children) {
      const tag = el.localName;
      if (tag === "p") {
        const ppr = firstChildEl(el, XML_NS.w, "pPr");
        const info = this._paragraphListInfo(ppr);
        const forceBreak = !!(ppr && firstChildEl(ppr, XML_NS.w, "pageBreakBefore"));
        if (!info) {
          flushList();
          for (const block of await this._paragraphToBlocks(el)) blocks.push(block);
          continue;
        }
        const isNewList = listStack.length === 0;
        const targetLevel = info.ilvl + 1;
        while (listStack.length > targetLevel) { const { ordered } = listStack.pop(); listHtml += ordered ? "</ol>" : "</ul>"; }
        if (listStack.length === targetLevel && listStack.length && listStack[listStack.length-1].numId !== info.numId) {
          const { ordered } = listStack.pop(); listHtml += ordered ? "</ol>" : "</ul>";
        }
        while (listStack.length < targetLevel) {
          const ordered = listStack.length === targetLevel - 1 ? info.ordered : true;
          const style = ordered ? ` style="list-style-type:${info.listStyle}"` : "";
          listHtml += `<${ordered ? "ol" : "ul"}${style}>`;
          listStack.push({ numId: info.numId, ilvl: info.ilvl, ordered });
        }
        if (isNewList) listForceBreak = forceBreak;
        let inner = await this._paragraphInnerHtml(el);
        inner = inner.split(PAGE_BREAK_MARKER).join("<br>");
        listHtml += `<li>${inner || "<br>"}</li>`;
      } else if (tag === "tbl") {
        flushList();
        blocks.push({ html: await this._tableToHtml(el), breakBefore: false });
      }
    }
    flushList();
    return blocks;
  }
  async _tableToHtml(tbl) {
    const rowsXml = childEls(tbl, XML_NS.w, "tr");
    const grid = [];
    const openSpans = {};
    for (const row of rowsXml) {
      const rowCells = [];
      let colIdx = 0;
      const place = (i, d) => { while (rowCells.length <= i) rowCells.push(null); rowCells[i] = d; };
      for (const tc of childEls(row, XML_NS.w, "tc")) {
        const tcpr = firstChildEl(tc, XML_NS.w, "tcPr");
        let span = 1, vmergeVal = null, widthPx = null;
        if (tcpr) {
          const gs = firstChildEl(tcpr, XML_NS.w, "gridSpan");
          if (gs) span = parseInt(gs.getAttributeNS(XML_NS.w, "val") || "1", 10);
          const vm = firstChildEl(tcpr, XML_NS.w, "vMerge");
          if (vm) vmergeVal = vm.getAttributeNS(XML_NS.w, "val") || "continue";
          const tcW = firstChildEl(tcpr, XML_NS.w, "tcW");
          if (tcW) { const type = tcW.getAttributeNS(XML_NS.w, "type"); const w = parseInt(tcW.getAttributeNS(XML_NS.w, "w") || "0", 10);
                     if (type === "dxa" && w) widthPx = twipsToPx(w); }
        }
        if (vmergeVal === "continue" && openSpans[colIdx]) {
          openSpans[colIdx].rowspan += 1;
          place(colIdx, { skip: true }); colIdx += span; continue;
        }
        let content = "";
        for (const p of childEls(tc, XML_NS.w, "p")) content += await this._paragraphToHtml(p);
        const desc = { skip: false, colspan: span, rowspan: 1, content, widthPx };
        place(colIdx, desc);
        if (vmergeVal === "restart") openSpans[colIdx] = desc;
        else if (openSpans[colIdx]) delete openSpans[colIdx];
        colIdx += span;
      }
      grid.push(rowCells);
    }
    const html = [`<table border="1" style="border-collapse:collapse">`];
    for (const rowCells of grid) {
      html.push("<tr>");
      for (const cell of rowCells) {
        if (!cell || cell.skip) continue;
        let attrs = "";
        if (cell.colspan > 1) attrs += ` colspan="${cell.colspan}"`;
        if (cell.rowspan > 1) attrs += ` rowspan="${cell.rowspan}"`;
        if (cell.widthPx) attrs += ` style="width:${cell.widthPx}px"`;
        html.push(`<td${attrs}>${cell.content}</td>`);
      }
      html.push("</tr>");
    }
    html.push("</table>");
    return html.join("");
  }
  _documentTitle(fallback) {
    if (this.coreDoc) {
      const t = firstChildEl(this.coreDoc.documentElement, XML_NS.dc, "title");
      if (t && t.textContent.trim()) return t.textContent.trim();
    }
    const body = firstChildEl(this.document, XML_NS.w, "body");
    for (const p of childEls(body, XML_NS.w, "p")) {
      const ppr = firstChildEl(p, XML_NS.w, "pPr");
      const st  = ppr ? firstChildEl(ppr, XML_NS.w, "pStyle") : null;
      if (st && (st.getAttributeNS(XML_NS.w, "val") || "").startsWith("Heading")) {
        const text = allDescendants(p, XML_NS.w, "t").map(t => t.textContent).join("").trim();
        if (text) return text;
      }
    }
    return fallback;
  }
  static async fromFile(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    if (!zip.file("word/document.xml")) throw new Error("Not a valid DOCX file.");
    const [document, rels, numbering, styles, core] = await Promise.all([
      parseXmlZip(zip, "word/document.xml"),
      parseXmlZip(zip, "word/_rels/document.xml.rels"),
      parseXmlZip(zip, "word/numbering.xml"),
      parseXmlZip(zip, "word/styles.xml"),
      parseXmlZip(zip, "docProps/core.xml"),
    ]);
    return new DocxRenderer(zip, { document, rels, numbering, styles, core });
  }
  async render() {
    const body = firstChildEl(this.document, XML_NS.w, "body");
    const blocks = await this._renderBody(body);
    return { blocks, title: this._documentTitle("Document") };
  }
}

function guessMime(path) {
  const ext = (path.split(".").pop() || "").toLowerCase();
  return ({ png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif",
            bmp:"image/bmp", svg:"image/svg+xml", webp:"image/webp",
            tif:"image/tiff", tiff:"image/tiff", emf:"image/x-emf", wmf:"image/x-wmf" })[ext]
         || "application/octet-stream";
}

/* -------- DOCX pagination --------
 * Lays the renderer's flat { html, breakBefore } blocks out into real,
 * fixed-size (794x1123) pages instead of one continuously scrolling sheet,
 * honoring w:pageBreakBefore and inline page breaks along the way. */
function paginateDocxBlocks(blocks) {
  const PAGE_HEIGHT = 1123;
  const measurer = document.createElement("div");
  measurer.className = "page docx-page";
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.left = "-9999px";
  measurer.style.top = "0";
  measurer.style.minHeight = "0"; // measure content only
  document.body.appendChild(measurer);

  const heightOf = html => { measurer.innerHTML = html; return measurer.scrollHeight; };

  const pages = [];
  let current = "";
  for (const block of blocks) {
    if (block.breakBefore && current !== "") { pages.push(current); current = ""; }
    const candidate = current + block.html;
    if (heightOf(candidate) > PAGE_HEIGHT && current !== "") {
      pages.push(current);
      current = block.html;
    } else {
      current = candidate;
    }
  }
  if (current !== "") pages.push(current);
  if (!pages.length) pages.push("");

  document.body.removeChild(measurer);
  return pages;
}

function renderDocxPages(host, pages) {
  host.innerHTML = "";
  pages.forEach((html, idx) => {
    const pageDiv = document.createElement("div");
    pageDiv.className = "page docx-page";
    pageDiv.innerHTML = html;
    if (pages.length > 1) {
      const num = document.createElement("div");
      num.className = "page-num";
      num.textContent = `${idx + 1} / ${pages.length}`;
      pageDiv.appendChild(num);
    }
    host.appendChild(pageDiv);
  });
}

/* -------- Standard Excel indexed color palette (0-63) -------- */
const XLSX_INDEXED_COLORS = [
  "000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF",
  "000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF",
  "800000","008000","000080","808000","800080","008080","C0C0C0","808080",
  "9999FF","993366","FFFFCC","CCFFFF","660066","FF8080","0066CC","CCCCFF",
  "000080","FF00FF","FFFF00","00FFFF","800080","800000","008080","0000FF",
  "00CCFF","CCFFFF","CCFFCC","FFFF99","99CCFF","FF99CC","CC99FF","FFCC99",
  "3366FF","33CCCC","99CC00","FFCC00","FF9900","FF6600","666699","969696",
  "003366","339966","003300","333300","993300","993366","333399","333333",
];

/* -------- XLSX (modern) -------- */
class XlsxRenderer {
  constructor(zip) { this.zip = zip; this.sharedStrings = []; this.styles = []; this.fills = []; this.themeColors = []; this.sheets = []; this.rels = {}; }
  _resolveColor(el) {
    if (!el) return null;
    const rgb = el.getAttribute("rgb");
    if (rgb) return "#" + (rgb.length === 8 ? rgb.slice(2) : rgb);
    const themeIdx = el.getAttribute("theme");
    if (themeIdx !== null) {
      const base = this.themeColors[parseInt(themeIdx, 10)];
      if (base) {
        const tint = parseFloat(el.getAttribute("tint") || "0");
        return tint ? this._applyTint(base, tint) : "#" + base;
      }
    }
    const indexed = el.getAttribute("indexed");
    if (indexed !== null) {
      const base = XLSX_INDEXED_COLORS[parseInt(indexed, 10)];
      if (base) return "#" + base;
    }
    return null;
  }
  _applyTint(hex, tint) {
    let r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const adj = c => Math.max(0, Math.min(255, tint < 0 ? Math.round(c * (1 + tint)) : Math.round(c * (1 - tint) + 255 * tint)));
    r = adj(r); g = adj(g); b = adj(b);
    return `rgb(${r},${g},${b})`;
  }
  async load() {
    const ssDoc = await parseXmlZip(this.zip, "xl/sharedStrings.xml");
    if (ssDoc) for (const si of childEls(ssDoc.documentElement, XML_NS.ss, "si"))
      this.sharedStrings.push(allDescendants(si, XML_NS.ss, "t").map(t => t.textContent).join(""));

    // Theme colors (needed to resolve theme-based fill colors)
    const themeDoc = await parseXmlZip(this.zip, "xl/theme/theme1.xml");
    if (themeDoc) {
      const clrScheme = themeDoc.getElementsByTagNameNS(XML_NS.a, "clrScheme")[0];
      if (clrScheme) {
        const map = {};
        for (const child of Array.from(clrScheme.children)) {
          const srgb = child.getElementsByTagNameNS(XML_NS.a, "srgbClr")[0];
          const sys  = child.getElementsByTagNameNS(XML_NS.a, "sysClr")[0];
          map[child.localName] = srgb ? srgb.getAttribute("val") : (sys ? sys.getAttribute("lastClr") : null);
        }
        // Note: Excel swaps the first two theme slots (lt1/dk1) vs. the raw clrScheme order.
        ["lt1","dk1","lt2","dk2","accent1","accent2","accent3","accent4","accent5","accent6","hlink","folHlink"]
          .forEach(name => this.themeColors.push(map[name] || null));
      }
    }

    const stDoc = await parseXmlZip(this.zip, "xl/styles.xml");
    if (stDoc) {
      const fillsEl = firstChildEl(stDoc.documentElement, XML_NS.ss, "fills");
      if (fillsEl) for (const fillEl of childEls(fillsEl, XML_NS.ss, "fill")) {
        const pf = firstChildEl(fillEl, XML_NS.ss, "patternFill");
        let color = null;
        if (pf) {
          const patternType = pf.getAttribute("patternType");
          if (patternType && patternType !== "none") {
            const fg = firstChildEl(pf, XML_NS.ss, "fgColor");
            const bg = firstChildEl(pf, XML_NS.ss, "bgColor");
            color = this._resolveColor(fg) || (patternType === "solid" ? this._resolveColor(bg) : null);
          }
        }
        this.fills.push(color);
      }
      const cellXfs = firstChildEl(stDoc.documentElement, XML_NS.ss, "cellXfs");
      if (cellXfs) for (const xf of childEls(cellXfs, XML_NS.ss, "xf")) {
        this.styles.push({
          numFmtId: parseInt(xf.getAttribute("numFmtId") || "0", 10),
          applyNumFmt: xf.getAttribute("applyNumberFormat") === "1",
          align: (firstChildEl(xf, XML_NS.ss, "alignment") || {}).getAttribute?.("horizontal") || null,
          fillId: parseInt(xf.getAttribute("fillId") || "0", 10),
        });
      }
    }
    const wb = await parseXmlZip(this.zip, "xl/workbook.xml");
    const wbRels = await parseXmlZip(this.zip, "xl/_rels/workbook.xml.rels");
    if (wbRels) for (const rel of childEls(wbRels.documentElement, XML_NS.pkg, "Relationship"))
      this.rels[rel.getAttribute("Id")] = rel.getAttribute("Target");
    if (wb) {
      const sheetsEl = firstChildEl(wb.documentElement, XML_NS.ss, "sheets");
      if (sheetsEl) for (const sh of childEls(sheetsEl, XML_NS.ss, "sheet")) {
        const name = sh.getAttribute("name");
        const rId  = sh.getAttributeNS(XML_NS.r, "id");
        const path = this.rels[rId];
        if (path) {
          const full = path.startsWith("xl/") ? path : "xl/" + path.replace(/^\/+/, "");
          this.sheets.push({ name, path: full });
        }
      }
    }
  }
  _sharedString(i) { const n = parseInt(i,10); return isNaN(n) ? "" : (this.sharedStrings[n] || ""); }
  _cellRefToCol(ref) { let c = 0; for (let i = 0; i < ref.length; i++) { const k = ref.charCodeAt(i); if (k >= 65 && k <= 90) c = c*26 + (k-64); else break; } return c - 1; }
  _parseCellRef(ref) {
    const m = ref.match(/^([A-Za-z]+)(\d+)$/);
    if (!m) return null;
    return { row: parseInt(m[2], 10) - 1, col: this._cellRefToCol(m[1].toUpperCase()) };
  }
  _formatCell(cell, style) {
    const t = cell.getAttribute("t") || "n";
    const vEl = firstChildEl(cell, XML_NS.ss, "v");
    let raw = "";
    if (t === "s") raw = vEl ? this._sharedString(vEl.textContent) : "";
    else if (t === "inlineStr") raw = allDescendants(firstChildEl(cell, XML_NS.ss, "is") || cell, XML_NS.ss, "t").map(x => x.textContent).join("");
    else raw = vEl ? vEl.textContent : "";
    if (t === "b") raw = raw === "1" ? "TRUE" : "FALSE";
    if (t === "n" && style && style.applyNumFmt) {
      const n = Number(raw);
      if (!isNaN(n)) {
        const id = style.numFmtId;
        if (id === 9 || id === 10) raw = (n*100).toFixed(0) + "%";
        else if (id === 2) raw = n.toFixed(2);
        else if (id === 3) raw = n.toFixed(0);
        else if (id >= 14 && id <= 22) raw = new Date(Date.UTC(1899,11,30) + n*86400000).toISOString().slice(0,10);
      }
    }
    return { text: raw, type: t };
  }
  async _renderSheet(path) {
    const doc = await parseXmlZip(this.zip, path);
    if (!doc) throw new Error("Sheet not found: " + path);
    const dataEl = firstChildEl(doc.documentElement, XML_NS.ss, "sheetData");
    if (!dataEl) return "<table></table>";
    const rows = childEls(dataEl, XML_NS.ss, "row");
    const maxCol = rows.reduce((m, r) => {
      for (const c of childEls(r, XML_NS.ss, "c")) { const r0 = c.getAttribute("r"); if (r0) m = Math.max(m, this._cellRefToCol(r0)); }
      return m;
    }, 0);

    // Merged-cell ranges: map "row,col" (top-left) -> {rowSpan,colSpan}, and a set of covered cells to skip.
    const mergeStarts = {};
    const covered = new Set();
    const mergeEl = firstChildEl(doc.documentElement, XML_NS.ss, "mergeCells");
    if (mergeEl) {
      for (const m of childEls(mergeEl, XML_NS.ss, "mergeCell")) {
        const ref = m.getAttribute("ref") || "";
        const [startRef, endRef] = ref.split(":");
        if (!startRef || !endRef) continue;
        const start = this._parseCellRef(startRef), end = this._parseCellRef(endRef);
        if (!start || !end) continue;
        mergeStarts[`${start.row},${start.col}`] = { rowSpan: end.row - start.row + 1, colSpan: end.col - start.col + 1 };
        for (let r = start.row; r <= end.row; r++)
          for (let c = start.col; c <= end.col; c++)
            if (!(r === start.row && c === start.col)) covered.add(`${r},${c}`);
      }
    }

    const letters = [];
    for (let i = 0; i <= maxCol; i++) { let s = "", n = i; do { s = String.fromCharCode(65 + (n%26)) + s; n = Math.floor(n/26) - 1; } while (n >= 0); letters.push(s); }
    const html = ["<table><thead><tr><th></th>"];
    for (const L of letters) html.push(`<th>${L}</th>`);
    html.push("</tr></thead><tbody>");
    let nextRow = 0;
    rows.forEach((rowEl) => {
      const rAttr = parseInt(rowEl.getAttribute("r") || "", 10);
      const rowIdx = !isNaN(rAttr) ? rAttr - 1 : nextRow;
      nextRow = rowIdx + 1;
      html.push("<tr>");
      html.push(`<td class="rowhead">${rowIdx + 1}</td>`);
      const cells = {};
      for (const c of childEls(rowEl, XML_NS.ss, "c")) cells[this._cellRefToCol(c.getAttribute("r") || "")] = c;
      for (let i = 0; i <= maxCol; i++) {
        const key = `${rowIdx},${i}`;
        if (covered.has(key)) continue; // covered by a merge from another cell — skip entirely
        const cell = cells[i];
        const span = mergeStarts[key];
        const spanAttrs = span ? `${span.rowSpan > 1 ? ` rowspan="${span.rowSpan}"` : ""}${span.colSpan > 1 ? ` colspan="${span.colSpan}"` : ""}` : "";
        if (!cell) { html.push(`<td${spanAttrs}></td>`); continue; }
        const sIdx = parseInt(cell.getAttribute("s") || "0", 10);
        const style = this.styles[sIdx];
        const { text, type } = this._formatCell(cell, style);
        let cls = type === "n" ? "num" : type === "b" ? "bool" : "";
        const styleParts = [];
        if (style && style.align) styleParts.push(`text-align:${style.align}`);
        const fillColor = style ? this.fills[style.fillId] : null;
        if (fillColor) styleParts.push(`background-color:${fillColor}`);
        const sa = styleParts.length ? ` style="${styleParts.join(";")}"` : "";
        html.push(`<td class="${cls}"${sa}${spanAttrs}>${escapeHtml(text)}</td>`);
      }
      html.push("</tr>");
    });
    html.push("</tbody></table>");
    return html.join("");
  }
  async render() {
    if (!this.sheets.length) throw new Error("No sheets found in workbook.");
    const tabs = this.sheets.map((s, i) => `<button data-idx="${i}"${i === 0 ? ' class="active"' : ""}>${escapeHtml(s.name)}</button>`).join("");
    const firstHtml = await this._renderSheet(this.sheets[0].path);
    return `<div id="xlsx-wrap"><div id="xlsx-tabs">${tabs}</div><div id="xlsx-sheet">${firstHtml}</div></div>`;
  }
  async getSheetHtml(idx) { return this._renderSheet(this.sheets[idx].path); }
}

/* ======================================================================
 *  3.  PDF renderer (lazy page rendering)
 * ====================================================================== */
const PdfRenderer = {
  workerReady: false,
  init() {
    if (this.workerReady || !window.pdfjsLib) return;
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    this.workerReady = true;
  },
  async render(file, host, onProgress) {
    this.init();
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const targetCssWidth = Math.min(900, Math.max(600, host.clientWidth - 40));
    const dpr = window.devicePixelRatio || 1;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const el = document.createElement("div");
      el.className = "pdf-page"; el.dataset.page = i;
      el.style.width = targetCssWidth + "px"; el.style.minHeight = "400px";
      el.innerHTML = `<div class="pdf-placeholder">Page ${i}</div>`;
      host.appendChild(el); pages.push(el);
    }
    let rendered = 0;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.rendered === "1") return;
        el.dataset.rendered = "1"; observer.unobserve(el);
        const pageNum = parseInt(el.dataset.page, 10);
        try {
          const page = await pdf.getPage(pageNum);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: targetCssWidth / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = "100%";
          const ctx = canvas.getContext("2d");
          const transform = dpr !== 1 ? [dpr,0,0,dpr,0,0] : null;
          await page.render({ canvasContext: ctx, viewport, transform }).promise;
          el.innerHTML = "";
          el.appendChild(canvas);
          const num = document.createElement("div"); num.className = "page-num";
          num.textContent = `${pageNum} / ${pdf.numPages}`; el.appendChild(num);
          rendered++;
          if (onProgress) onProgress(`Rendered ${rendered}/${pdf.numPages}`);
        } catch { el.innerHTML = `<div class="pdf-placeholder">Error rendering page ${pageNum}</div>`; }
      });
    }, { rootMargin: "300px 0px" });
    pages.forEach(el => observer.observe(el));
    return { numPages: pdf.numPages };
  },
};

/* ======================================================================
 *  4.  FORMAT REGISTRY
 *  ----------------------------------------------------------------------
 *  To add a new format: append one object with
 *    { id, label, extensions, mimeTypes?, libs?, moduleUrl?, render }
 *  Nothing else in the file needs to change.
 * ====================================================================== */

const FORMAT_REGISTRY = [

  /* ---------------- PDF ---------------- */
  {
    id: "pdf", label: "PDF Document",
    extensions: ["pdf"], mimeTypes: ["application/pdf"],
    async render(file, host, ctx) {
      const { numPages } = await PdfRenderer.render(file, host, ctx.setStatus);
      return { title: file.name, status: `${numPages} page${numPages===1?"":"s"}` };
    },
  },

  /* ---------------- DOCX ---------------- */
  {
    id: "docx", label: "Word Document",
    extensions: ["docx", "docm", "dotx", "dotm"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    async render(file, host, ctx) {
      const renderer = await DocxRenderer.fromFile(file);
      const { blocks, title } = await renderer.render();
      ctx.setStatus("Paginating…");
      const pages = paginateDocxBlocks(blocks);
      renderDocxPages(host, pages);
      return { title: title || file.name, status: `${pages.length} page${pages.length===1?"":"s"}` };
    },
  },

  /* ---------------- XLSX (modern) ---------------- */
  {
    id: "xlsx", label: "Excel Workbook",
    extensions: ["xlsx", "xlsm", "xltx", "xltm"],
    mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    async render(file, host, ctx) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const renderer = new XlsxRenderer(zip);
      await renderer.load();
      host.innerHTML = await renderer.render();
      ctx.onXlsxReady(renderer);
      return { title: file.name, status: `${renderer.sheets.length} sheet${renderer.sheets.length===1?"":"s"}` };
    },
  },

  /* ---------------- Legacy .doc (binary Word 97-2003) ---------------- */
  {
    id: "doc", label: "Legacy Word Document",
    extensions: ["doc", "dot"],
    mimeTypes: ["application/msword"],
    moduleUrl: "https://cdn.jsdelivr.net/npm/@file-viewer/doc@3.0.2/+esm",
    async render(file, host) {
      const mod = await loadModule(this.moduleUrl);
      const parsed = mod.parseMsDoc(await file.arrayBuffer());
      const rendered = mod.renderMsDoc(parsed);
      host.innerHTML =
        `<div class="legacy-doc-wrap"><style>${rendered.css}</style>` +
        `<div class="msdoc-root">${rendered.html}</div></div>`;
      return { title: file.name, status: "Loaded (legacy .doc)" };
    },
  },

  /* ---------------- Legacy .xls (binary Excel BIFF) ---------------- */
  {
    id: "xls", label: "Legacy Excel Workbook",
    extensions: ["xls"], mimeTypes: ["application/vnd.ms-excel"],
    libs: ["https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"],
    async render(file, host) {
      await loadScript(this.libs[0]);
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellStyles: true });
      const names = wb.SheetNames;
      const tabs = names.map((n, i) => `<button data-idx="${i}"${i===0?' class="active"':""}>${escapeHtml(n)}</button>`).join("");
      const firstHtml = XLSX.utils.sheet_to_html(wb.Sheets[names[0]]);
      host.innerHTML = `<div id="xlsx-wrap"><div id="xlsx-tabs">${tabs}</div><div id="xlsx-sheet">${firstHtml}</div></div>`;
      // Wire up tab switching for this workbook
      const tabsEl = $("#xlsx-tabs", host);
      tabsEl.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        $$("#xlsx-tabs button", host).forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        $("#xlsx-sheet", host).innerHTML = XLSX.utils.sheet_to_html(wb.Sheets[names[+b.dataset.idx]]);
      });
      return { title: file.name, status: `${names.length} sheet${names.length===1?"":"s"} (legacy .xls)` };
    },
  },

  /* ---------------- CSV / TSV ---------------- */
  {
    id: "csv", label: "CSV / TSV",
    extensions: ["csv", "tsv", "tab"],
    mimeTypes: ["text/csv", "text/tab-separated-values"],
    libs: ["https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"],
    async render(file, host) {
      await loadScript(this.libs[0]);
      const result = await new Promise((resolve, reject) => {
        Papa.parse(file, { complete: resolve, error: reject, skipEmptyLines: "greedy" });
      });
      const rows = result.data;
      if (!rows.length) throw new Error("CSV file is empty.");
      const headers = rows[0];
      const body = rows.slice(1);
      const html = [
        `<div class="csv-wrap"><table><thead><tr>`,
        ...headers.map(h => `<th>${escapeHtml(h)}</th>`),
        `</tr></thead><tbody>`,
        ...body.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`),
        `</tbody></table></div>`,
      ].join("");
      host.innerHTML = html;
      return { title: file.name, status: `${body.length} row${body.length===1?"":"s"} × ${headers.length} columns` };
    },
  },

  /* ---------------- RTF ---------------- */
  {
    id: "rtf", label: "Rich Text Format",
    extensions: ["rtf"], mimeTypes: ["application/rtf", "text/rtf"],
    libs: ["https://cdnjs.cloudflare.com/ajax/libs/rtf.js/0.1.0/rtf.min.js"],
    async render(file, host) {
      await loadScript(this.libs[0]);
      const doc = new RTFJS.Document(await file.arrayBuffer());
      const elements = await doc.render();
      const wrap = document.createElement("div");
      wrap.className = "page";
      elements.forEach(el => wrap.appendChild(el));
      host.innerHTML = "";
      host.appendChild(wrap);
      return { title: file.name, status: "Loaded (RTF)" };
    },
  },

  /* ---------------- ODF family (odt / ods / odp / odg / fodt / fods …) ---------------- */
  {
    id: "odf", label: "OpenDocument",
    extensions: ["odt", "ods", "odp", "odg", "fodt", "fods", "fodp", "fodg"],
    mimeTypes: ["application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet"],
    libs: ["https://cdn.jsdelivr.net/npm/webodf@0.5.10/index.min.js"],
    async render(file, host) {
      await loadScript(this.libs[0]);
      if (!window.odf || !odf.OdfCanvas) throw new Error("WebODF failed to initialise.");
      host.innerHTML = `<div id="odf-host"></div>`;
      const canvas = new odf.OdfCanvas($("#odf-host", host));
      const url = URL.createObjectURL(file);
      try {
        await new Promise((resolve, reject) => {
          canvas.load(url);
          // WebODF fires 'statereadychange' when done
          const t = setTimeout(() => resolve(), 8000); // safety net
          canvas.addListener?.("statereadychange", () => { clearTimeout(t); resolve(); });
        });
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      return { title: file.name, status: "Loaded (ODF)" };
    },
  },

  /* ---------------- Plain text ---------------- */
  {
    id: "txt", label: "Plain Text",
    extensions: ["txt", "log", "ini", "cfg", "conf", "yaml", "yml"],
    mimeTypes: ["text/plain"],
    async render(file, host) {
      const text = await file.text();
      host.innerHTML = `<pre class="plain-pre">${escapeHtml(text)}</pre>`;
      return { title: file.name, status: `${text.length.toLocaleString()} chars` };
    },
  },

  /* ---------------- JSON ---------------- */
  {
    id: "json", label: "JSON",
    extensions: ["json", "geojson"],
    mimeTypes: ["application/json"],
    async render(file, host) {
      const raw = await file.text();
      let pretty = raw;
      try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* keep raw */ }
      host.innerHTML = `<pre class="plain-pre">${escapeHtml(pretty)}</pre>`;
      return { title: file.name, status: "Loaded (JSON)" };
    },
  },

  /* ---------------- Markdown ---------------- */
  {
    id: "md", label: "Markdown",
    extensions: ["md", "markdown", "mdown"],
    mimeTypes: ["text/markdown"],
    libs: ["https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"],
    async render(file, host) {
      await loadScript(this.libs[0]);
      const text = await file.text();
      const html = (window.marked && marked.parse) ? marked.parse(text) : `<pre>${escapeHtml(text)}</pre>`;
      host.innerHTML = `<div class="page">${html}</div>`;
      return { title: file.name, status: "Loaded (Markdown)" };
    },
  },

  /* ---------------- Images ---------------- */
  {
    id: "image", label: "Image",
    // Covers everything modern browsers can decode natively, plus a few (tiff/heic/heif) that
    // some browsers (e.g. Safari) support and others don't — those fall back gracefully below.
    extensions: ["png","jpg","jpeg","jfif","pjpeg","pjp","gif","webp","bmp","svg","svgz","ico","avif","apng","tif","tiff","heic","heif"],
    mimeTypes: ["image/*"],
    async render(file, host) {
      const url = URL.createObjectURL(file);
      host.innerHTML = `
        <div class="page" style="padding:24px;text-align:center">
          <img src="${url}" alt="" id="imgPreview">
          <div id="imgFallback" style="display:none;color:#888;font-family:system-ui,sans-serif;padding:32px 0;">
            <p style="margin:0 0 12px;">This browser can't display <strong>${escapeHtml(file.name)}</strong> inline.</p>
            <a href="${url}" download="${escapeAttr(file.name)}" style="color:var(--accent);text-decoration:underline;">Download the file</a> to view it in another app.
          </div>
        </div>`;
      const img = host.querySelector("#imgPreview");
      const fallback = host.querySelector("#imgFallback");
      return new Promise(resolve => {
        img.onload = () => resolve({ title: file.name, status: `Image · ${img.naturalWidth}×${img.naturalHeight}` });
        img.onerror = () => {
          img.style.display = "none";
          fallback.style.display = "block";
          resolve({ title: file.name, status: "Preview unavailable — use download link" });
        };
      });
    },
  },

  /* ---------------- HTML source view (safe) ---------------- */
  {
    id: "html", label: "HTML Source",
    extensions: ["html", "htm", "xhtml"],
    mimeTypes: ["text/html"],
    async render(file, host) {
      const text = await file.text();
      host.innerHTML = `<pre class="plain-pre">${escapeHtml(text)}</pre>`;
      return { title: file.name, status: "Source view (HTML)" };
    },
  },
];

/* ======================================================================
 *  5.  Viewer orchestrator
 * ====================================================================== */
const Viewer = {
  host:       $("#viewer"),
  dropzone:   $("#dropzone"),
  errorEl:    $("#error"),
  statusEl:   $("#status"),
  fileMeta:   $("#fileMeta"),
  fileNameEl: $("#fileName"),
  fileTypeEl: $("#fileType"),
  printBtn:   $("#printBtn"),
  saveBtn:    $("#saveBtn"),
  reloadBtn:  $("#reloadBtn"),
  filePicker: $("#filePicker"),
  overlay:    $("#loading-overlay"),
  loadingTxt: $("#loadingText"),
  currentFile: null,

  init() {
    this.filePicker.addEventListener("change", e => {
      const f = e.target.files[0];
      if (f) this.open(f);
      e.target.value = "";
    });
    this.printBtn.addEventListener("click", () => window.print());
    this.saveBtn.addEventListener("click", () => this.save());
    this.reloadBtn.addEventListener("click", () => this.reset());

    ["dragenter","dragover"].forEach(ev =>
      document.addEventListener(ev, e => { e.preventDefault(); this.dropzone.classList.add("dragover"); }));
    ["dragleave","drop"].forEach(ev =>
      document.addEventListener(ev, e => {
        e.preventDefault();
        if (ev === "drop") { const f = e.dataTransfer.files[0]; if (f) this.open(f); }
        if (ev === "dragleave" || ev === "drop") this.dropzone.classList.remove("dragover");
      }));

    // XLSX tab delegation (covers both the modern renderer and legacy handler)
    this.host.addEventListener("click", async (e) => {
      const btn = e.target.closest("#xlsx-tabs button");
      if (!btn) return;
      if (this._xlsxRenderer) {
        const idx = parseInt(btn.dataset.idx, 10);
        $$("#xlsx-tabs button", this.host).forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        $("#xlsx-sheet", this.host).innerHTML = await this._xlsxRenderer.getSheetHtml(idx);
      }
    });
  },

  showError(msg) { this.errorEl.textContent = msg; this.errorEl.style.display = "block"; },
  clearError()   { this.errorEl.style.display = "none"; this.errorEl.textContent = ""; },
  showOverlay(t) { this.loadingTxt.textContent = t || "Loading…"; this.overlay.classList.add("show"); },
  hideOverlay()  { this.overlay.classList.remove("show"); },

  reset() {
    this.host.innerHTML = "";
    this.host.classList.remove("active");
    this.dropzone.style.display = "block";
    this.fileMeta.style.display = "none";
    this.printBtn.disabled = true;
    this.saveBtn.disabled = true;
    this.statusEl.textContent = "";
    this._xlsxRenderer = null;
    this.currentFile = null;
    this.clearError();
    document.title = "Universal Document Viewer";
  },

  save() {
    if (!this.currentFile) return;
    const url = URL.createObjectURL(this.currentFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.currentFile.name || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  detectHandler(file) {
    const name = (file.name || "").toLowerCase();
    const ext  = name.includes(".") ? name.split(".").pop() : "";
    const mime = (file.type || "").toLowerCase();

    // 1) exact extension match
    for (const h of FORMAT_REGISTRY) {
      if (h.extensions && h.extensions.includes(ext)) return h;
    }
    // 2) MIME match (supports "image/*" wildcards)
    for (const h of FORMAT_REGISTRY) {
      if (!h.mimeTypes) continue;
      for (const m of h.mimeTypes) {
        if (m.endsWith("/*")) { if (mime.startsWith(m.slice(0, -1))) return h; }
        else if (m === mime) return h;
      }
    }
    // 3) fallback: try to sniff plain text
    return null;
  },

  async open(file) {
    this.clearError();
    const handler = this.detectHandler(file);
    if (!handler) {
      this.showError(
        `Unsupported file type: ${file.name}\n\n` +
        `Supported: ${FORMAT_REGISTRY.flatMap(h => h.extensions || []).join(", ")}`
      );
      return;
    }

    this.fileNameEl.textContent = file.name;
    this.fileTypeEl.textContent = handler.id.toUpperCase();
    this.fileMeta.style.display = "flex";
    this.dropzone.style.display = "none";
    this.host.innerHTML = "";
    this.host.classList.add("active");
    this.printBtn.disabled = true;
    this.currentFile = file;
    this.saveBtn.disabled = false;
    this._xlsxRenderer = null;

    const ctx = {
      setStatus: s => { this.statusEl.textContent = s; },
      onXlsxReady: r => { this._xlsxRenderer = r; },
    };

    try {
      this.showOverlay(`Loading ${handler.label}…`);
      const result = await handler.render(file, this.host, ctx) || {};
      document.title = result.title || file.name;
      this.statusEl.textContent = result.status || "Loaded";
      this.printBtn.disabled = false;
    } catch (err) {
      console.error(err);
      this.showError(err.message || String(err));
      this.statusEl.textContent = "Error";
      this.host.innerHTML = "";
      this.host.classList.remove("active");
      this.dropzone.style.display = "block";
      this.saveBtn.disabled = true;
      this.currentFile = null;
    } finally {
      this.hideOverlay();
    }
  },
};

Viewer.init();