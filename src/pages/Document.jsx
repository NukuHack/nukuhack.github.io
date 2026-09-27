import { useEffect, useRef, useState } from 'react';
import '../styles/document.css';
import { FORMAT_REGISTRY } from '../lib/documentViewer.js';
import { useModal } from '../context/ModalContext.jsx';

function detectHandler(file) {
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const mime = (file.type || '').toLowerCase();

  for (const h of FORMAT_REGISTRY) {
    if (h.extensions && h.extensions.includes(ext)) return h;
  }
  for (const h of FORMAT_REGISTRY) {
    if (!h.mimeTypes) continue;
    for (const m of h.mimeTypes) {
      if (m.endsWith('/*')) {
        if (mime.startsWith(m.slice(0, -1))) return h;
      } else if (m === mime) {
        return h;
      }
    }
  }
  return null;
}

export default function Document() {
  const { openModal } = useModal();
  const hostRef = useRef(null);
  const filePickerRef = useRef(null);
  const currentFileRef = useRef(null);
  const xlsxRendererRef = useRef(null);

  const [dropzoneVisible, setDropzoneVisible] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [viewerActive, setViewerActive] = useState(false);
  const [fileMetaVisible, setFileMetaVisible] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileTypeLabel, setFileTypeLabel] = useState('');
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState(null);
  const [saveDisabled, setSaveDisabled] = useState(true);
  const [overlay, setOverlay] = useState({ show: false, text: 'Loading…' });

  // Live edit/preview split (only ever enabled for handler.textBased formats,
  // e.g. Markdown, plain text, JSON, CSV, HTML source).
  const [activeHandler, setActiveHandler] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');

  // Whole-page drag & drop, exactly like the original (listens on `document`,
  // not just the dropzone, so dropping anywhere on the page works).
  useEffect(() => {
    function onDragOver(e) {
      e.preventDefault();
      setDragOver(true);
    }
    function onDragLeave(e) {
      e.preventDefault();
      setDragOver(false);
    }
    function onDrop(e) {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) openFile(f);
    }

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      document.title = 'Stupid Webpage';
    };
  }, []);

  function resetViewer() {
    if (hostRef.current) {
      hostRef.current.innerHTML = '';
      hostRef.current.onclick = null;
    }
    setViewerActive(false);
    setDropzoneVisible(true);
    setFileMetaVisible(false);
    setSaveDisabled(true);
    setStatusText('');
    setErrorText(null);
    xlsxRendererRef.current = null;
    currentFileRef.current = null;
    // Reset always closes the editor — there's nothing left to edit.
    setEditMode(false);
    setEditText('');
    setActiveHandler(null);
    document.title = 'Universal Document Viewer';
  }

  function saveFile() {
    const file = currentFileRef.current;
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function openFile(file) {
    setErrorText(null);
    const handler = detectHandler(file);
    if (!handler) {
      setErrorText(
        `Unsupported file type: ${file.name}\n\n` +
          `Supported: ${FORMAT_REGISTRY.flatMap((h) => h.extensions || []).join(', ')}`
      );
      return;
    }

    setFileName(file.name);
    setFileTypeLabel(handler.id.toUpperCase());
    setFileMetaVisible(true);
    setDropzoneVisible(false);
    if (hostRef.current) hostRef.current.innerHTML = '';
    setViewerActive(true);
    currentFileRef.current = file;
    setSaveDisabled(false);
    xlsxRendererRef.current = null;
    setActiveHandler(handler);

    // Opening a new document: if it isn't text-based, the editor (if open)
    // no longer applies to anything and closes. If it IS text-based and the
    // editor was already open, keep it open and load the new file's text in
    // so editing continues seamlessly on the new document.
    if (!handler.textBased) {
      setEditMode(false);
      setEditText('');
    } else if (editMode) {
      try {
        setEditText(await file.text());
      } catch {
        setEditText('');
      }
    }

    const ctx = {
      setStatus: (s) => setStatusText(s),
      onXlsxReady: (r) => {
        xlsxRendererRef.current = r;
      },
    };

    try {
      setOverlay({ show: true, text: `Loading ${handler.label}…` });
      const result = (await handler.render(file, hostRef.current, ctx)) || {};
      document.title = result.title || file.name;
      setStatusText(result.status || 'Loaded');
    } catch (err) {
      console.error(err);
      setErrorText(err.message || String(err));
      setStatusText('Error');
      if (hostRef.current) hostRef.current.innerHTML = '';
      setViewerActive(false);
      setDropzoneVisible(true);
      setSaveDisabled(true);
      currentFileRef.current = null;
    } finally {
      setOverlay((prev) => ({ ...prev, show: false }));
    }
  }

  // Reads the clipboard as text, opens it as a (virtual) .md file, and jumps
  // straight into the editor — the paste-and-preview workflow the old
  // standalone Markdown page offered, now built on the same viewer/editor
  // as every other format instead of a separate page.
  async function pasteFromClipboard() {
    if (!navigator.clipboard?.readText) {
      openModal('Clipboard unavailable', "This browser won't let the page read the clipboard. Try Ctrl/Cmd+V into a .md file and opening that instead.");
      return;
    }
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      openModal('Clipboard permission denied', err?.message || 'Could not read the clipboard. Your browser may need permission granted first.');
      return;
    }
    if (!text) {
      openModal('Clipboard is empty', 'There was no text on the clipboard to paste.');
      return;
    }
    const file = new File([text], 'clipboard.md', { type: 'text/markdown' });
    await openFile(file);
    // openFile only auto-opens the editor if it was already open; force it
    // open here since the whole point of pasting is to edit immediately.
    setEditText(text);
    setEditMode(true);
  }

  // ─── Live edit/preview ────────────────────────────────────────────────
  async function toggleEditMode() {
    if (editMode) {
      closeEditMode();
      return;
    }
    if (!activeHandler?.textBased || !currentFileRef.current) return;
    try {
      const text = await currentFileRef.current.text();
      setEditText(text);
      setEditMode(true);
    } catch (err) {
      openModalError(err);
    }
  }

  function closeEditMode() {
    setEditMode(false);
  }

  function openModalError(err) {
    console.error(err);
    setErrorText(err?.message || String(err));
  }

  // Re-render the preview from the edited text whenever it changes (debounced
  // so we don't re-parse on every keystroke), and keep the underlying file in
  // sync so Save exports the edited content.
  useEffect(() => {
    if (!editMode || !activeHandler || !currentFileRef.current) return;
    const t = setTimeout(async () => {
      const baseFile = currentFileRef.current;
      const updated = new File([editText], baseFile.name, { type: baseFile.type });
      currentFileRef.current = updated;
      setSaveDisabled(false);
      if (!hostRef.current) return;
      hostRef.current.innerHTML = '';
      try {
        const result = (await activeHandler.render(updated, hostRef.current, {
          setStatus: setStatusText,
          onXlsxReady: () => {},
        })) || {};
        setStatusText(result.status || 'Updated');
        setErrorText(null);
      } catch (err) {
        setErrorText(err.message || String(err));
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editText, editMode, activeHandler]);

  // Tab-switching delegation for the *modern* XLSX renderer (the legacy .xls
  // handler wires its own listener directly on its own markup, same as the
  // original file).
  async function handleHostClick(e) {
    const btn = e.target.closest('#xlsx-tabs button');
    if (!btn || !xlsxRendererRef.current) return;
    const idx = parseInt(btn.dataset.idx, 10);
    hostRef.current.querySelectorAll('#xlsx-tabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const sheetEl = hostRef.current.querySelector('#xlsx-sheet');
    if (sheetEl) sheetEl.innerHTML = await xlsxRendererRef.current.getSheetHtml(idx);
  }

  function handleFilePickerChange(e) {
    const f = e.target.files[0];
    if (f) openFile(f);
    e.target.value = '';
  }

  return (
    <>
      <div id="toolbar">
        <div className="toolbar-inner">
          <div className="brand">
            📄 <span>Viewer</span>
          </div>
          <label className="btn" htmlFor="filePicker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Open file
          </label>
          <input type="file" id="filePicker" ref={filePickerRef} onChange={handleFilePickerChange} />
          <button id="pasteBtn" title="Paste clipboard text as a new document and start editing it" onClick={pasteFromClipboard}>
            📋 Paste as text
          </button>
          <button id="saveBtn" disabled={saveDisabled} title="Save file to disk" onClick={saveFile}>
            💾 Save
          </button>
          <button id="reloadBtn" title="Reset" onClick={resetViewer}>
            ↺ Reset
          </button>
          <button
            id="editBtn"
            className={editMode ? 'active' : ''}
            disabled={!activeHandler?.textBased}
            title={
              activeHandler?.textBased
                ? editMode
                  ? 'Close the editor'
                  : 'Edit this document'
                : 'Editing is only available for text-based documents (Markdown, TXT, JSON, CSV, HTML)'
            }
            onClick={toggleEditMode}
          >
            {editMode ? '✕ Close edit' : '✏️ Edit'}
          </button>
          <div className="spacer" />
          <div id="fileMeta" style={{ display: fileMetaVisible ? 'flex' : 'none' }}>
            <span className="badge" id="fileType">
              {fileTypeLabel || '—'}
            </span>
            <span id="fileName">{fileName}</span>
          </div>
          <div id="status">{statusText}</div>
        </div>
      </div>

      <div id="dropzone" className={dragOver ? 'dragover' : ''} style={{ display: dropzoneVisible ? 'block' : 'none' }}>
        <h2>📄 Drop a document to preview it</h2>
        <p>
          Or click <strong>Open file</strong> above to browse your computer.
        </p>
        <p className="formats">
          <code>PDF</code> <code>DOCX</code> <code>DOC</code> <code>XLSX</code> <code>XLS</code> <code>CSV</code>{' '}
          <code>RTF</code> <code>ODT</code> <code>ODS</code> <code>ODP</code> <code>TXT</code> <code>JSON</code>{' '}
          <code>MD</code> <code>PNG</code> <code>JPG</code> <code>WEBP</code> <code>GIF</code> <code>BMP</code>{' '}
          <code>SVG</code> <code>AVIF</code> <code>HEIC</code> …
          <br />
          <small>All processing happens in your browser. Nothing is uploaded.</small>
        </p>
      </div>

      <div id="error" style={{ display: errorText ? 'block' : 'none' }}>
        {errorText}
      </div>

      <div id="viewerArea" className={editMode ? 'edit-mode' : ''}>
        {editMode && (
          <div id="editorPane">
            <div className="editor-head">
              <span>✏️ Editing — {fileName}</span>
              <button className="editor-close" onClick={closeEditMode} title="Close editor">
                ✕ Close
              </button>
            </div>
            <textarea
              id="editorText"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        )}
        <div id="viewer" className={viewerActive ? 'active' : ''} ref={hostRef} onClick={handleHostClick} />
      </div>

      <div id="loading-overlay" className={overlay.show ? 'show' : ''}>
        <div className="box">
          <div className="spinner" />
          <div id="loadingText">{overlay.text}</div>
        </div>
      </div>
    </>
  );
}
