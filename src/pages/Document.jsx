import { useEffect, useRef, useState } from 'react';
import '../styles/document.css';
import { FORMAT_REGISTRY } from '../lib/documentViewer.js';

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
          <button id="saveBtn" disabled={saveDisabled} title="Save file to disk" onClick={saveFile}>
            💾 Save
          </button>
          <button id="reloadBtn" title="Reset" onClick={resetViewer}>
            ↺ Reset
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
      <div id="viewer" className={viewerActive ? 'active' : ''} ref={hostRef} onClick={handleHostClick} />

      <div id="loading-overlay" className={overlay.show ? 'show' : ''}>
        <div className="box">
          <div className="spinner" />
          <div id="loadingText">{overlay.text}</div>
        </div>
      </div>
    </>
  );
}
