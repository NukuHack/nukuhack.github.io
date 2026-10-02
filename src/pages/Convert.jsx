import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/markdown.css';
import '../styles/convert.css';
import {
  convertMarkdownToDocx,
  ensureDeps,
  ensurePrism,
  detectLanguagesInMarkdown,
  tokenizeRenderedCode,
} from '../lib/md2docx.js';
import { extractDocumentToHtml, wrapHtmlPage } from '../lib/docToHtml.js';
import { useModal } from '../context/ModalContext.jsx';
import {
  readClipboardImageFromEvent,
  blobToDataUrl,
  getImageDimensions,
} from '../lib/image.js';

const SAMPLE = `# Hello, world

This is a **bold** word, an *italic* one, a ~~struck-through~~ one, and some \`inline code\`.

## Lists

- First item
- Second item
  - Nested one
  - Nested two

1. One
2. Two
3. Three

## Code

\`\`\`js
function greet(name) {
  const greeting = "Hello, " + name + "!";
  console.log(greeting);
  return greeting;
}
\`\`\`

\`\`\`python
def add(a, b):
    return a + b
\`\`\`

## Table

| Name | Role  | Score |
| ---- | :---: | ----: |
| Ada  | Math  |    99 |
| Alan | Code  |    95 |

> A wise quote, once said.

[Learn more](https://example.com)

---

Done.
`;

const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
const TURNDOWN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js';

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

export default function Convert() {
  const { openModal } = useModal();

  // Which of the two tools this page is currently showing.
  const [mode, setMode] = useState('md2docx'); // 'md2docx' | 'doc2html'

  /* ── md → docx state (unchanged) ── */
  const [md, setMd] = useState(SAMPLE);
  const [filename, setFilename] = useState('converted');
  const [busy, setBusy] = useState(false);
  const [depsReady, setDepsReady] = useState(false);
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── doc → html state (new) ── */
  const [htmlOutput, setHtmlOutput] = useState('');
  const [htmlTitle, setHtmlTitle] = useState('document');
  const [docBusy, setDocBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      ensureDeps(),
      ensurePrism(['javascript', 'python', 'bash', 'json', 'markup', 'css']),
    ])
      .then(() => !cancelled && setDepsReady(true))
      .catch((err) => {
        console.error(err);
        if (!cancelled) openModal('Failed to load libraries', err.message || String(err));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewHtml = useMemo(() => {
    if (!depsReady || !window.marked) {
      return '<p class="convert_preview_hint">Loading preview…</p>';
    }
    try {
      return window.marked.parse(md || '', { gfm: true, breaks: false });
    } catch (e) {
      return `<p class="convert_preview_error">Preview error: ${e.message}</p>`;
    }
  }, [md, depsReady]);

  useEffect(() => {
    if (!depsReady || !previewRef.current) return;
    const langs = detectLanguagesInMarkdown(md);
    ensurePrism(langs).then(() => {
      if (!previewRef.current || !window.Prism) return;
      previewRef.current.querySelectorAll('pre code').forEach((el) => {
        if (el.dataset.highlighted === '1') return;
        window.Prism.highlightElement(el);
        el.dataset.highlighted = '1';
      });
    });
  }, [previewHtml, md, depsReady]);

  async function handleConvert() {
    setBusy(true);
    try {
      await ensurePrism(detectLanguagesInMarkdown(md));
      const blob = await convertMarkdownToDocx(md, { highlight: tokenizeRenderedCode });
      const safeName = (filename || 'converted').replace(/\.docx$/i, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      openModal('Converted', `Downloaded ${safeName}.docx`);
    } catch (err) {
      console.error(err);
      openModal('Conversion failed', err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;

    const isDocx =
      /\.docx$/i.test(f.name) ||
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!isDocx) {
      const reader = new FileReader();
      reader.onload = () => {
        setMd(String(reader.result ?? ''));
        const base = (f.name || 'converted').replace(/\.[^.]+$/, '');
        setFilename(base);
      };
      reader.readAsText(f);
      return;
    }

    try {
      await ensureDeps();
      const zip = await window.JSZip.loadAsync(await f.arrayBuffer());
      const part = zip.file('word/source_markdown.md');

      if (part) {
        const mdText = await part.async('string');
        setMd(mdText);
        setFilename((f.name || 'converted').replace(/\.docx$/i, ''));
        return;
      }

      openModal(
        'Foreign DOCX — lossy import',
        "This file wasn't saved by this tool, so its exact original Markdown isn't embedded. " +
          "It'll be converted approximately: headings, lists, tables, links and images may differ, " +
          'and syntax-highlighting will be lost.'
      );

      await Promise.all([loadScript(MAMMOTH_URL), loadScript(TURNDOWN_URL)]);

      const arrayBuffer = await f.arrayBuffer();
      const { value: html } = await window.mammoth.convertToHtml({ arrayBuffer });

      const td = new window.TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
      });
      td.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);

      setMd(td.turndown(html));
      setFilename((f.name || 'converted').replace(/\.docx$/i, ''));
    } catch (err) {
      console.error(err);
      openModal('Failed to read DOCX', err.message || String(err));
    }
  }

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = md.slice(0, start) + '  ' + md.slice(end);
    setMd(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  }

  function handlePaste(e) {
    const file = readClipboardImageFromEvent(e);
    if (!file) return;
    e.preventDefault();

    const el = textareaRef.current || e.target;
    const insertStart = el?.selectionStart ?? md.length;
    const insertEnd = el?.selectionEnd ?? insertStart;

    blobToDataUrl(file)
      .then(async (dataUrl) => {
        const dims = await getImageDimensions(dataUrl).catch(() => null);
        const alt = dims ? `pasted-${dims.width}x${dims.height}` : 'pasted-image';
        const snippet = `![${alt}](${dataUrl})`;
        const value = md.slice(0, insertStart) + snippet + md.slice(insertEnd);
        setMd(value);
        const nextPos = insertStart + snippet.length;
        requestAnimationFrame(() => {
          const t = textareaRef.current;
          if (!t) return;
          t.focus();
          t.selectionStart = t.selectionEnd = nextPos;
        });
      })
      .catch((err) => {
        console.error(err);
        openModal('Paste failed', err.message || String(err));
      });
  }

  function loadSample() {
    setMd(SAMPLE);
    setFilename('converted');
  }

  /* ── doc → html handlers (new) ────────────────────────────────────────── */

  async function handleDocHtmlFile(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;

    setDocBusy(true);
    try {
      await ensureDeps(); // guarantees window.JSZip for docx/odt
      const { html, kind } = await extractDocumentToHtml(f);
      setHtmlOutput(html);
      setHtmlTitle((f.name || 'document').replace(/\.[^.]+$/, ''));
      openModal(
        'Document imported',
        `Extracted ${String(kind).toUpperCase()} content — ${html.length.toLocaleString()} characters of HTML.`
      );
    } catch (err) {
      console.error(err);
      openModal('Failed to import document', err.message || String(err));
    } finally {
      setDocBusy(false);
    }
  }

  function handleDownloadHtml() {
    if (!htmlOutput.trim()) return;
    const page = wrapHtmlPage(htmlOutput, htmlTitle || 'Document');
    const blob = new Blob([page], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(htmlTitle || 'document').replace(/\.html?$/i, '')}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    openModal('Downloaded', `Saved ${a.download}`);
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="convert_page">
      <div className="convert_header">
        <h1>{mode === 'md2docx' ? 'Markdown → DOCX' : 'Document → HTML'}</h1>
        {mode === 'md2docx' ? (
          <p>
            Paste or drop Markdown on the left, preview it on the right, then
            download it as a real Word document. Syntax highlighting, links,
            tables, lists, blockquotes and inline formatting all carry over.
            Pasting an image from your clipboard inserts it inline.
          </p>
        ) : (
          <p>
            Load a <code>.docx</code>, <code>.odt</code>, <code>.html</code>{' '}
            or text file. Its structure (headings, paragraphs, list items) is
            extracted into editable HTML on the left and rendered live on the
            right, then downloaded as a standalone, self-styled page.
            Ported from <code>doc_to_txt.py</code>.
          </p>
        )}

        <div
          style={{ display: 'flex', gap: '8px', marginTop: '12px' }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'md2docx'}
            className={`convert_btn${mode === 'md2docx' ? ' convert_btn_primary' : ''}`}
            onClick={() => setMode('md2docx')}
          >
            Markdown → DOCX
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'doc2html'}
            className={`convert_btn${mode === 'doc2html' ? ' convert_btn_primary' : ''}`}
            onClick={() => setMode('doc2html')}
          >
            Document → HTML
          </button>
        </div>
      </div>

      {mode === 'md2docx' ? (
        <>
          <div className="convert_toolbar">
            <label className="convert_btn" htmlFor="convertFilePicker">
              📂 Load file
            </label>
            <input
              id="convertFilePicker"
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.mdown,.docx,text/markdown,text/plain,
                      application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <button type="button" className="convert_btn" onClick={loadSample}>
              ✨ Sample
            </button>

            <div className="convert_spacer" />

            <input
              type="text"
              className="convert_filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="file name"
              aria-label="Output file name"
            />
            <span className="convert_ext">.docx</span>
            <button
              type="button"
              className="convert_btn convert_btn_primary"
              onClick={handleConvert}
              disabled={busy || !md.trim()}
            >
              {busy ? 'Converting…' : '⬇️ Convert & download'}
            </button>
          </div>

          <div className="convert_grid">
            <div className="convert_pane">
              <div className="convert_pane_head">
                <span>Markdown</span>
                <span className="convert_pane_meta">{md.length} chars</span>
              </div>
              <textarea
                ref={textareaRef}
                className="convert_textarea"
                value={md}
                onChange={(e) => setMd(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>

            <div className="convert_pane">
              <div className="convert_pane_head">
                <span>Preview</span>
                <span className="convert_pane_meta">approximate</span>
              </div>
              <div className="convert_preview">
                <div
                  ref={previewRef}
                  className="page md-render convert_preview_inner prism-theme"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          </div>

          <p className="convert_note">
            Syntax highlighting is copied from the preview verbatim. Pasting an
            image from the clipboard inserts it as a data URL and embeds it in
            the DOCX. External http(s) images are not fetched — their alt text
            is written instead. All processing happens locally in your browser.
          </p>
        </>
      ) : (
        <>
          <div className="convert_toolbar">
            <label className="convert_btn" htmlFor="docHtmlPicker">
              📂 Load document
            </label>
            <input
              id="docHtmlPicker"
              type="file"
              accept=".docx,.docm,.dotx,.dotm,.odt,.fodt,.html,.htm,.xhtml,.md,.markdown,.mdown,.csv,.tsv,.tab,.json,.txt,.log,.rst,.yaml,.yml,.ini,.cfg,.conf"
              onChange={handleDocHtmlFile}
              style={{ display: 'none' }}
              disabled={docBusy}
            />

            <div className="convert_spacer" />

            <input
              type="text"
              className="convert_filename"
              value={htmlTitle}
              onChange={(e) => setHtmlTitle(e.target.value)}
              placeholder="page title"
              aria-label="Output page title"
            />
            <span className="convert_ext">.html</span>
            <button
              type="button"
              className="convert_btn convert_btn_primary"
              onClick={handleDownloadHtml}
              disabled={!htmlOutput.trim()}
            >
              {docBusy ? 'Reading…' : '⬇️ Download HTML'}
            </button>
          </div>

          <div className="convert_grid">
            <div className="convert_pane">
              <div className="convert_pane_head">
                <span>HTML source</span>
                <span className="convert_pane_meta">{htmlOutput.length} chars</span>
              </div>
              <textarea
                className="convert_textarea"
                value={htmlOutput}
                onChange={(e) => setHtmlOutput(e.target.value)}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={
                  'Load a .docx / .odt / .md / .html / .csv / .json / .txt file.\n\n' +
                  'Headings, bold/italic/underline/strike, colours, highlights,\n' +
                  'alignment, ordered + unordered lists, tables, links and embedded\n' +
                  'images are all preserved as real HTML. Edit freely — the preview\n' +
                  'updates live.'
                }
              />
            </div>

            <div className="convert_pane">
              <div className="convert_pane_head">
                <span>Preview</span>
                <span className="convert_pane_meta">live</span>
              </div>
              <div className="convert_preview">
                <div
                  className="page convert_preview_inner"
                  dangerouslySetInnerHTML={{
                    __html:
                      htmlOutput ||
                      '<p class="convert_preview_hint">Load a document to see the preview…</p>',
                  }}
                />
              </div>
            </div>
          </div>

          <p className="convert_note">
            DOCX is rendered by the same OOXML walker used by the Document viewer
            (<code>DocxRenderer</code>), so runs keep their <code>color</code>,
            <code>highlight</code>, <code>shading</code>, bold/italic/underline/
            strike, and paragraphs keep their <code>jc</code> alignment, indents,
            and numbering — including real <code>&lt;ol&gt;</code> /
            <code>&lt;ul&gt;</code> and <code>&lt;table&gt;</code> with spans.
            ODT goes through a real XML walker (styles + list styles + tables).
            Markdown is rendered by <code>marked</code> (GFM), CSV becomes a
            <code>&lt;table&gt;</code>, JSON is pretty-printed, and everything
            downloads as a self-contained, styled page. No scripts, no uploads.
          </p>
        </>
      )}
    </div>
  );
}

