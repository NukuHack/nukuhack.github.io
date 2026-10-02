// ─────────────────────────────────────────────────────────────────────────
//  Markdown → DOCX
//
//  Uses `marked` (CDN) to tokenise the markdown and `JSZip` (CDN) to pack
//  up a minimal but valid OOXML document. Everything is emitted with direct
//  run/paragraph formatting, so no styles.xml is required.
//
//  Supported: headings, paragraphs, bold/italic/strike/inline-code,
//  links, bullet & ordered lists (nested), fenced code blocks (with
//  optional syntax highlighting), blockquotes, GFM tables, horizontal
//  rules, line breaks, and inline images (from data: URLs).
// ─────────────────────────────────────────────────────────────────────────

import {
  isDataUrl,
  dataUrlMime,
  dataUrlToBytes,
  getImageDimensions,
  extFromMime,
} from './image.js';

const CDN = {
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  marked: 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js',
};

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

export async function ensureDeps() {
  const jobs = [];
  if (!window.JSZip) jobs.push(loadScript(CDN.jszip));
  if (!window.marked) jobs.push(loadScript(CDN.marked));
  if (jobs.length) await Promise.all(jobs);
  if (!window.JSZip) throw new Error('JSZip could not be loaded');
  if (!window.marked) throw new Error('marked could not be loaded');
}


/* ───────────────────────── Prism loading ──────────────────────────────── */

const PRISM_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';

const PRISM_LANG_ALIASES = {
  js: 'javascript',
  py: 'python',
  cs: 'csharp',
  'c++': 'cpp',
  'c#': 'csharp',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  rb: 'ruby',
  md: 'markdown',
};

const _prismLangs = new Map();

export async function ensurePrism(languages = []) {
  if (!window.Prism) {
    await loadScript(`${PRISM_BASE}/prism.min.js`);
  }

  const jobs = [];
  const seen = new Set();
  for (const raw of languages) {
    if (!raw) continue;
    const key = String(raw).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const target = PRISM_LANG_ALIASES[key] || key;
    if (!target) continue;
    if (window.Prism.languages && window.Prism.languages[target]) continue;

    if (!_prismLangs.has(target)) {
      _prismLangs.set(
        target,
        loadScript(`${PRISM_BASE}/components/prism-${target}.min.js`).catch(
          () => null
        )
      );
    }
    jobs.push(_prismLangs.get(target));
  }

  if (jobs.length) await Promise.all(jobs);
}

export function detectLanguagesInMarkdown(md) {
  const out = new Set();
  const re = /```([a-zA-Z0-9_+#.-]+)/g;
  let m;
  while ((m = re.exec(md || ''))) out.add(m[1].toLowerCase());
  return [...out];
}

/* ─────────────────── Read computed colors from the DOM ────────────────── */

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return null;
  const m = String(rgb).match(
    /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/
  );
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  const h = (n) => parseInt(n, 10).toString(16).padStart(2, '0').toUpperCase();
  return h(m[1]) + h(m[2]) + h(m[3]);
}

function firstVisibleBackground(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const hex = rgbToHex(window.getComputedStyle(node).backgroundColor);
    if (hex) return hex;
    node = node.parentElement;
  }
  return null;
}

export function tokenizeRenderedCode(code, lang) {
  if (!code) return null;

  const host = document.createElement('div');
  host.className = 'prism-theme';
  host.style.position = 'absolute';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.pointerEvents = 'none';

  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.className = lang ? `language-${lang}` : '';
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  host.appendChild(pre);
  document.body.appendChild(host);

  try {
    if (window.Prism && lang && window.Prism.languages[lang]) {
      window.Prism.highlightElement(codeEl);
    }

    const bg = firstVisibleBackground(codeEl) || '1E1E1E';
    const fallbackColor = rgbToHex(window.getComputedStyle(codeEl).color) || 'D4D4D4';

    const lines = [[]];
    const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      if (!text) continue;

      const cs = window.getComputedStyle(node.parentElement || codeEl);
      const fmt = {
        color: rgbToHex(cs.color) || fallbackColor,
        bold: parseInt(cs.fontWeight, 10) >= 600,
        italic: cs.fontStyle === 'italic',
        underline: cs.textDecorationLine?.includes('underline') || false,
      };

      const parts = text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([]);
        if (parts[i]) lines[lines.length - 1].push({ text: parts[i], ...fmt });
      }
    }

    return { bg, lines };
  } finally {
    document.body.removeChild(host);
  }
}

/* ─────────────────────────── XML helpers ──────────────────────────────── */

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function run(text, opts = {}) {
  if (text === '' || text == null) return '';
  const rPr = [];
  if (opts.bold)      rPr.push('<w:b/>');
  if (opts.italics)   rPr.push('<w:i/>');
  if (opts.strike)    rPr.push('<w:strike/>');
  if (opts.underline) rPr.push('<w:u w:val="single"/>');
  if (opts.color)     rPr.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.font)      rPr.push(`<w:rFonts w:ascii="${opts.font}" w:hAnsi="${opts.font}" w:cs="${opts.font}"/>`);
  if (opts.size)      rPr.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
  if (opts.shading)   rPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`);

  const rPrXml = rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : '';
  const segments = String(text).split('\n');
  const body = segments
    .map((seg, i) => (i > 0 ? '<w:br/>' : '') + `<w:t xml:space="preserve">${esc(seg)}</w:t>`)
    .join('');
  return `<w:r>${rPrXml}${body}</w:r>`;
}

function paragraph(runsXml, opts = {}) {
  const pPr = [];

  const indentLeft = (opts.indent || 0) + (opts.blockquote || 0) * 360;
  const indBits = [];
  if (indentLeft) indBits.push(`w:left="${indentLeft}"`);
  if (opts.hanging) indBits.push(`w:hanging="${opts.hanging}"`);
  if (indBits.length) pPr.push(`<w:ind ${indBits.join(' ')}/>`);

  if (opts.numId != null) {
    pPr.push(
      `<w:numPr><w:ilvl w:val="${opts.ilvl || 0}"/><w:numId w:val="${opts.numId}"/></w:numPr>`
    );
  }

  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);

  pPr.push(`<w:spacing ${opts.spacing || 'w:after="160"'}/>`);

  if (opts.shading) {
    pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`);
  }

  if (opts.blockquote) {
    pPr.push(
      '<w:pBdr><w:left w:val="single" w:sz="18" w:space="10" w:color="CCCCCC"/></w:pBdr>'
    );
  }

  if (opts.keepNext) pPr.push('<w:keepNext/>');

  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runsXml || ''}</w:p>`;
}

function hyperlinkXml(href, innerRuns, ctx) {
  const id = `rIdLink${ctx.links.length + 1}`;
  ctx.links.push({ id, href });
  return `<w:hyperlink r:id="${id}">${innerRuns}</w:hyperlink>`;
}

/* ─────────────────────────── images ───────────────────────────────────── */

const EMU_PER_PX = 9525;              // 96 dpi → EMU
const MAX_IMAGE_W_EMU = 5486400;      // ~6 inches, fits A4 portrait nicely

function imageDrawingXml(relId, alt, info, ctx) {
  let cx = Math.max(1, Math.round((info.width || 400) * EMU_PER_PX));
  let cy = Math.max(1, Math.round((info.height || 300) * EMU_PER_PX));
  if (cx > MAX_IMAGE_W_EMU) {
    const ratio = MAX_IMAGE_W_EMU / cx;
    cx = MAX_IMAGE_W_EMU;
    cy = Math.round(cy * ratio);
  }

  const id = ++ctx.imageIdCounter;

  return (
    `<w:r><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${id}" name="Picture ${id}" descr="${esc(alt || '')}"/>` +
        `<wp:cNvGraphicFramePr>` +
          `<a:graphicFrameLocks noChangeAspect="1"/>` +
        `</wp:cNvGraphicFramePr>` +
        `<a:graphic>` +
          `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:pic>` +
              `<pic:nvPicPr>` +
                `<pic:cNvPr id="${id}" name="image${id}"/>` +
                `<pic:cNvPicPr/>` +
              `</pic:nvPicPr>` +
              `<pic:blipFill>` +
                `<a:blip r:embed="${relId}"/>` +
                `<a:stretch><a:fillRect/></a:stretch>` +
              `</pic:blipFill>` +
              `<pic:spPr>` +
                `<a:xfrm>` +
                  `<a:off x="0" y="0"/>` +
                  `<a:ext cx="${cx}" cy="${cy}"/>` +
                `</a:xfrm>` +
                `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
              `</pic:spPr>` +
            `</pic:pic>` +
          `</a:graphicData>` +
        `</a:graphic>` +
      `</wp:inline>` +
    `</w:drawing></w:r>`
  );
}

/* ─────────────────────────── inline tokens ────────────────────────────── */

function inlineToXml(tokens, style, ctx) {
  if (!tokens || !tokens.length) return '';
  const out = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
      case 'escape':
        if (Array.isArray(t.tokens) && t.tokens.length) {
          out.push(inlineToXml(t.tokens, style, ctx));
        } else {
          out.push(run(t.text ?? t.raw ?? '', style));
        }
        break;

      case 'strong':
        out.push(inlineToXml(t.tokens, { ...style, bold: true }, ctx));
        break;
      case 'em':
        out.push(inlineToXml(t.tokens, { ...style, italics: true }, ctx));
        break;
      case 'del':
        out.push(inlineToXml(t.tokens, { ...style, strike: true }, ctx));
        break;
      case 'codespan':
        out.push(
          run(t.text || '', {
            ...style,
            font: 'Consolas',
            shading: 'F2F2F2',
            size: style.size || 20,
          })
        );
        break;
      case 'link': {
        const inner = inlineToXml(
          t.tokens,
          { ...style, color: '0563C1', underline: true },
          ctx
        );
        out.push(hyperlinkXml(t.href || '#', inner, ctx));
        break;
      }
      case 'image': {
        const info = ctx.imageCache && ctx.imageCache.get(t.href);
        if (info) {
          const relId = `rIdImg${ctx.images.length + 1}`;
          const filename = `image${ctx.images.length + 1}.${info.ext}`;
          ctx.images.push({ id: relId, filename, bytes: info.bytes });
          out.push(imageDrawingXml(relId, t.text || '', info, ctx));
        } else {
          // No embeddable source (http(s), missing, or broken data URL) —
          // keep the alt text so nothing is silently dropped.
          out.push(
            run(`[${t.text || 'image'}]`, {
              ...style,
              italics: true,
              color: '888888',
            })
          );
        }
        break;
      }
      case 'br':
        out.push('<w:r><w:br/></w:r>');
        break;
      case 'html':
        break;
      default:
        if (t.text) out.push(run(t.text, style));
    }
  }
  return out.join('');
}

/* ─────────────────────────── block tokens ─────────────────────────────── */

function blocksToXml(tokens, ctx, blockOpts = {}) {
  let xml = '';
  for (const t of tokens) xml += blockToXml(t, ctx, blockOpts);
  return xml;
}

function blockToXml(t, ctx, blockOpts = {}) {
  switch (t.type) {
    case 'heading': {
      const sizes = { 1: 36, 2: 30, 3: 26, 4: 24, 5: 22, 6: 20 };
      const size = sizes[t.depth] || 24;
      const inline = inlineToXml(t.tokens, { bold: true, size }, ctx);
      return paragraph(inline, {
        ...blockOpts,
        spacing: 'w:before="280" w:after="120"',
        keepNext: true,
      });
    }

    case 'paragraph': {
      const inline = inlineToXml(t.tokens, {}, ctx);
      return paragraph(inline, blockOpts);
    }

    case 'code':
      return codeBlockToXml(t, blockOpts, ctx);

    case 'blockquote':
      return blocksToXml(t.tokens, ctx, {
        ...blockOpts,
        blockquote: (blockOpts.blockquote || 0) + 1,
      });

    case 'list':
      return listToXml(t, ctx, blockOpts, 0);

    case 'table':
      return tableToXml(t, ctx) + paragraph('');

    case 'hr':
      return (
        '<w:p><w:pPr>' +
        '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr>' +
        '<w:spacing w:before="160" w:after="160"/>' +
        '</w:pPr></w:p>'
      );

    case 'space':
    case 'html':
      return '';

    default:
      if (t.raw) return paragraph(run(t.raw));
      return '';
  }
}

/* ─────────────────────────── code blocks ──────────────────────────────── */

const CODE_FONT = 'Consolas';
const CODE_SIZE = '20';

function codeLinePPr({ isFirst, isLast, left, fill }) {
  const spacing = [
    `w:before="${isFirst ? 140 : 0}"`,
    `w:after="${isLast ? 140 : 0}"`,
    'w:line="240"',
    'w:lineRule="auto"',
  ].join(' ');
  return (
    `<w:pPr>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` +
    `<w:spacing ${spacing}/>` +
    `<w:ind w:left="${left}" w:right="200"/>` +
    `</w:pPr>`
  );
}

function codeBaseRPr() {
  return (
    `<w:rFonts w:ascii="${CODE_FONT}" w:hAnsi="${CODE_FONT}" w:cs="${CODE_FONT}"/>` +
    `<w:sz w:val="${CODE_SIZE}"/><w:szCs w:val="${CODE_SIZE}"/>`
  );
}

function codeBlockToXml(t, blockOpts, ctx) {
  const code = String(t.text ?? '');
  const plainLines = code.split('\n');

  const bq = blockOpts.blockquote || 0;
  const left = 200 + bq * 360;

  let highlighted = null;
  const highlight = ctx && ctx.highlight;
  if (typeof highlight === 'function' && code) {
    try {
      highlighted = highlight(code, t.lang);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[md2docx] syntax highlight failed:', err);
      highlighted = null;
    }
  }

  const hasHl =
    highlighted &&
    Array.isArray(highlighted.lines) &&
    highlighted.lines.length > 0;

  const fill = (hasHl && highlighted.bg) || 'F5F5F5';
  const totalLines = hasHl ? highlighted.lines.length : plainLines.length;

  let xml = '';
  for (let i = 0; i < totalLines; i++) {
    const isFirst = i === 0;
    const isLast = i === totalLines - 1;
    const pPr = codeLinePPr({ isFirst, isLast, left, fill });

    let runsXml;
    if (hasHl) {
      const lineRuns = highlighted.lines[i] || [];
      if (lineRuns.length) {
        runsXml = lineRuns
          .map((tok) => {
            const rPr = [codeBaseRPr()];
            if (tok.color)     rPr.push(`<w:color w:val="${tok.color}"/>`);
            if (tok.bold)      rPr.push('<w:b/>');
            if (tok.italic)    rPr.push('<w:i/>');
            if (tok.underline) rPr.push('<w:u w:val="single"/>');
            return (
              `<w:r><w:rPr>${rPr.join('')}</w:rPr>` +
              `<w:t xml:space="preserve">${esc(tok.text)}</w:t></w:r>`
            );
          })
          .join('');
      } else {
        runsXml =
          `<w:r><w:rPr>${codeBaseRPr()}</w:rPr>` +
          `<w:t xml:space="preserve"> </w:t></w:r>`;
      }
    } else {
      const text = plainLines[i] && plainLines[i].length ? plainLines[i] : ' ';
      runsXml =
        `<w:r><w:rPr>${codeBaseRPr()}</w:rPr>` +
        `<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
    }

    xml += `<w:p>${pPr}${runsXml}</w:p>`;
  }

  return xml;
}

/* ─────────────────────────── lists ────────────────────────────────────── */

function listToXml(t, ctx, blockOpts, level) {
  let numId;
  if (t.ordered) {
    numId = ctx.nextOrderedNumId++;
    ctx.orderedNumIds.push(numId);
  } else {
    numId = 1;
  }

  let xml = '';
  for (const item of t.items) {
    xml += listItemToXml(item, numId, level, ctx, blockOpts);
  }
  return xml;
}

function listItemToXml(item, numId, level, ctx, blockOpts) {
  const children = item.tokens || [];
  let xml = '';
  let firstBlock = true;

  for (const child of children) {
    if (child.type === 'list') {
      xml += listToXml(child, ctx, blockOpts, level + 1);
    } else if (child.type === 'text') {
      const inline = child.tokens
        ? inlineToXml(child.tokens, {}, ctx)
        : run(child.text || '');
      xml += paragraph(inline, {
        ...blockOpts,
        numId: firstBlock ? numId : null,
        ilvl: level,
        spacing: 'w:after="0"',
      });
      firstBlock = false;
    } else if (child.type === 'paragraph') {
      const inline = inlineToXml(child.tokens, {}, ctx);
      xml += paragraph(inline, {
        ...blockOpts,
        numId: firstBlock ? numId : null,
        ilvl: level,
        spacing: 'w:after="0"',
      });
      firstBlock = false;
    } else {
      const inner = blockToXml(child, ctx, blockOpts);
      if (inner) xml += inner;
      firstBlock = false;
    }
  }

  if (firstBlock) {
    xml += paragraph('', {
      ...blockOpts,
      numId,
      ilvl: level,
      spacing: 'w:after="0"',
    });
  }

  return xml;
}

/* ─────────────────────────── tables ───────────────────────────────────── */

function tableToXml(t, ctx) {
  const header = Array.isArray(t.header) ? t.header : [];
  const rows = Array.isArray(t.rows) ? t.rows : [];

  const colCount = header.length || (rows[0] ? rows[0].length : 1);
  const grid = Array.from({ length: colCount }, () => '<w:gridCol/>').join('');

  const rowXml = (cells, isHeader) => {
    const tcXml = cells
      .map((cell) => {
        const style = isHeader ? { bold: true } : {};
        const inline = cell.tokens
          ? inlineToXml(cell.tokens, style, ctx)
          : run(cell.text || '', style);

        const shade = isHeader
          ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>'
          : '';

        const align =
          cell.align === 'center'
            ? 'center'
            : cell.align === 'right'
              ? 'right'
              : null;

        const p = paragraph(inline, {
          align,
          spacing: 'w:before="40" w:after="40"',
        });

        return (
          `<w:tc><w:tcPr>${shade}<w:tcW w:w="0" w:type="auto"/></w:tcPr>${p}</w:tc>`
        );
      })
      .join('');
    return `<w:tr>${tcXml}</w:tr>`;
  };

  const borders =
    '<w:tblBorders>' +
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>' +
    '</w:tblBorders>';

  const tblPr =
    `<w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}` +
    `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>` +
    `</w:tblPr>`;

  let xml = `<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>`;
  if (header.length) xml += rowXml(header, true);
  for (const row of rows) xml += rowXml(row, false);
  xml += '</w:tbl>';
  return xml;
}

/* ─────────────────────────── numbering.xml ────────────────────────────── */

function numberingLevels(kind) {
  const out = [];
  for (let i = 0; i < 9; i++) {
    const ind = 720 + i * 720;
    const indXml = `<w:pPr><w:ind w:left="${ind}" w:hanging="360"/></w:pPr>`;

    if (kind === 'bullet') {
      const cycle = i % 3;
      const bullet =
        cycle === 0
          ? { char: '\u2022', font: 'Symbol' }
          : cycle === 1
            ? { char: 'o', font: 'Courier New' }
            : { char: '\u25AA', font: 'Wingdings' };

      out.push(
        `<w:lvl w:ilvl="${i}">` +
          `<w:start w:val="1"/><w:numFmt w:val="bullet"/>` +
          `<w:lvlText w:val="${esc(bullet.char)}"/><w:lvlJc w:val="left"/>` +
          indXml +
          `<w:rPr><w:rFonts w:ascii="${bullet.font}" w:hAnsi="${bullet.font}" w:hint="default"/></w:rPr>` +
          `</w:lvl>`
      );
    } else {
      const fmts = ['decimal', 'lowerLetter', 'lowerRoman'];
      const fmt = fmts[i % 3];
      out.push(
        `<w:lvl w:ilvl="${i}">` +
          `<w:start w:val="1"/><w:numFmt w:val="${fmt}"/>` +
          `<w:lvlText w:val="%${i + 1}."/><w:lvlJc w:val="left"/>` +
          indXml +
          `</w:lvl>`
      );
    }
  }
  return out.join('');
}

function numberingXml(ctx) {
  const orderedNums = (ctx?.orderedNumIds || [])
    .map(
      (id) =>
        `<w:num w:numId="${id}">` +
          `<w:abstractNumId w:val="1"/>` +
          `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>` +
        `</w:num>`
    )
    .join('');

  return (
    XML_DECL +
    `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${numberingLevels('bullet')}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${numberingLevels('ordered')}</w:abstractNum>` +
    `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
    orderedNums +
    `</w:numbering>`
  );
}

/* ─────────────────────────── package bits ─────────────────────────────── */

function contentTypesXml() {
  return (
    XML_DECL +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="md"  ContentType="text/markdown"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Default Extension="gif" ContentType="image/gif"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
    `</Types>`
  );
}

function packageRelsXml() {
  return (
    XML_DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`
  );
}

function documentRelsXml(links, images) {
  let xml =
    XML_DECL +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`;

  for (const l of links) {
    xml +=
      `<Relationship Id="${l.id}" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" ` +
      `Target="${esc(l.href)}" TargetMode="External"/>`;
  }

  for (const img of images || []) {
    xml +=
      `<Relationship Id="${img.id}" ` +
      `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
      `Target="media/${esc(img.filename)}"/>`;
  }

  xml += `</Relationships>`;
  return xml;
}

const DOCUMENT_OPEN =
  XML_DECL +
  `<w:document ` +
  `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
  `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
  `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
  `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<w:body>`;

const SECT_PR =
  `<w:sectPr>` +
  `<w:pgSz w:w="11906" w:h="16838"/>` +
  `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>` +
  `</w:sectPr>`;

const DOCUMENT_CLOSE = `</w:body></w:document>`;

/* ─────────────────── pre-scan: walk the token tree ────────────────────── */

function* walkTokens(tokens) {
  if (!Array.isArray(tokens)) return;
  for (const t of tokens) {
    if (!t || typeof t !== 'object') continue;
    yield t;
    if (Array.isArray(t.tokens)) yield* walkTokens(t.tokens);
    if (Array.isArray(t.items)) {
      for (const it of t.items) {
        if (it && Array.isArray(it.tokens)) yield* walkTokens(it.tokens);
      }
    }
    if (Array.isArray(t.header)) yield* walkTokens(t.header);
    if (Array.isArray(t.rows)) {
      for (const row of t.rows) if (Array.isArray(row)) yield* walkTokens(row);
    }
  }
}

/**
 * Walks the lexer output and, for every image whose src is a data: URL,
 * decodes the bytes + natural dimensions. Returns a Map keyed by href.
 * http(s) images are skipped on purpose — fetching them would leak CORS
 * details and, worse, could fail silently mid-conversion.
 */
async function resolveImages(tokens) {
  const cache = new Map();
  const uniq = new Set();

  for (const t of walkTokens(tokens)) {
    if (t.type === 'image' && t.href && isDataUrl(t.href) && !uniq.has(t.href)) {
      uniq.add(t.href);
      const bytes = dataUrlToBytes(t.href);
      if (!bytes || !bytes.length) continue;
      const mime = dataUrlMime(t.href);
      const ext = extFromMime(mime);
      let dims = { width: 400, height: 300 };
      try {
        dims = await getImageDimensions(t.href);
      } catch {
        // keep fallback dims
      }
      cache.set(t.href, { bytes, mime, ext, ...dims });
    }
  }

  return cache;
}

/* ─────────────────────────── public API ───────────────────────────────── */

/**
 * Convert a Markdown string to a DOCX Blob.
 *
 * @param {string} markdown
 * @param {object} [options]
 * @param {(code: string, lang?: string) => ({ bg: string, lines: Array<Array<{ text: string, color?: string, bold?: boolean, italic?: boolean, underline?: boolean }>> } | null)} [options.highlight]
 * @returns {Promise<Blob>}
 */
export async function convertMarkdownToDocx(markdown, options = {}) {
  await ensureDeps();

  const tokens = window.marked.lexer(markdown || '', {
    gfm: true,
    breaks: false,
  });

  // One async pass to fetch metadata for every data: image before we
  // build XML — keeps the rest of the pipeline synchronous and simple.
  const imageCache = await resolveImages(tokens);

  const ctx = {
    links: [],
    orderedNumIds: [],
    nextOrderedNumId: 2,
    highlight: typeof options.highlight === 'function' ? options.highlight : null,
    imageCache,
    images: [],
    imageIdCounter: 0,
  };
  const bodyXml = blocksToXml(tokens, ctx, {});

  const documentXml = DOCUMENT_OPEN + bodyXml + SECT_PR + DOCUMENT_CLOSE;

  const zip = new window.JSZip();
  zip.file('[Content_Types].xml', contentTypesXml());
  zip.file('_rels/.rels', packageRelsXml());
  zip.file('word/document.xml', documentXml);
  zip.file('word/numbering.xml', numberingXml(ctx));
  zip.file('word/_rels/document.xml.rels', documentRelsXml(ctx.links, ctx.images));
  zip.file('word/source_markdown.md', markdown || '');

  // Image binaries — one part per embedded image.
  for (const img of ctx.images) {
    zip.file(`word/media/${img.filename}`, img.bytes);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}