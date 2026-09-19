import { useEffect, useRef, useState } from 'react';
import '../styles/navigator.css';
import {
  isFileUrl,
  isUrl,
  normalizeUrl,
  proxyUrl,
  NAV_REPORTER,
  NAV_REPORTER_INLINE_SOURCE,
  searchWiki,
  searchBooks,
  searchDict,
  directLinks,
} from '../lib/navigator.js';

export default function Navigator() {
  const iframeRef = useRef(null);
  const addressInputRef = useRef(null);

  const currentSrcUrlRef = useRef('');
  const localFilesRef = useRef({});
  const loadAbortRef = useRef(null);
  const searchAbortRef = useRef(null);
  const pendingIframeTokenRef = useRef(0);
  const ourIframeTokenRef = useRef(0);

  const [addressValue, setAddressValue] = useState('');
  const [badgeMode, setBadgeMode] = useState('url'); // 'url' | 'search'
  const [activeTab, setActiveTab] = useState('rendered'); // 'rendered' | 'source'
  const [currentMode, setCurrentMode] = useState('start'); // 'start' | 'page' | 'search'
  const [nav, setNav] = useState({ history: [], idx: -1 });
  const [overlay, setOverlay] = useState({ show: false, msg: 'Loading…' });
  const [status, setStatusState] = useState({ msg: 'Ready', state: 'ok' });
  const [sbTime, setSbTime] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [search, setSearch] = useState({ status: 'idle', msg: '', results: [] });
  const [iframeDoc, setIframeDoc] = useState({ mode: 'blank', srcdoc: '', src: '' });

  const backDisabled = nav.idx <= 0;
  const fwdDisabled = nav.idx >= nav.history.length - 1;

  const visiblePane = currentMode === 'search' ? 'search' : activeTab === 'source' ? 'source' : 'rendered';

  useEffect(() => {
    addressInputRef.current?.focus();
  }, []);

  function setStatus(msg, state = 'ok') {
    setStatusState({ msg, state });
  }

  function showOverlay(msg) {
    setOverlay({ show: true, msg: msg || 'Loading…' });
  }
  function hideOverlay() {
    setOverlay((prev) => ({ ...prev, show: false }));
  }

  function pushHistory(url) {
    setNav((prev) => {
      const history = prev.history.slice(0, prev.idx + 1);
      history.push(url);
      return { history, idx: history.length - 1 };
    });
  }

  function handleAddressChange(e) {
    const v = e.target.value;
    setAddressValue(v);
    const trimmed = v.trim();
    if (!trimmed) {
      setBadgeMode('url');
    } else {
      setBadgeMode(isUrl(trimmed) ? 'url' : 'search');
    }
  }

  function handleAddressKeyDown(e) {
    if (e.key === 'Enter') handleGo();
  }

  function handleGo() {
    const val = addressValue.trim();
    if (!val) return;
    if (isFileUrl(val)) {
      pickLocalFile();
      return;
    }
    if (isUrl(val)) {
      loadPage(normalizeUrl(val));
    } else {
      runSearch(val);
    }
  }

  // ─── Local file picker ────────────────────────────────────────────────
  // Browsers block fetch()/XHR on file:// URLs from an http(s) page, so
  // typing a real path never works. Instead "file://" opens a native
  // picker; the chosen file is read client-side and pushed through the
  // same srcdoc + NAV_REPORTER pipeline used for remote pages.

  function pickLocalFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!/\.html?$/i.test(file.name)) {
        setStatus('Only .html files are supported', 'error');
        setAddressValue('file:///');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => loadLocalFile(file.name, String(reader.result));
      reader.onerror = () => {
        setStatus('Could not read file', 'error');
        showErrorPane('Could not read file', reader.error?.message || 'Unknown error');
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function loadLocalFile(name, src, addToHistory = true) {
    const fakeUrl = 'file:///' + name;
    localFilesRef.current[fakeUrl] = src;

    currentSrcUrlRef.current = fakeUrl;
    setAddressValue(fakeUrl);
    setBadgeMode('url');

    if (addToHistory) pushHistory(fakeUrl);

    setActiveTab((prevTab) => (currentMode !== 'page' ? 'rendered' : prevTab));
    setCurrentMode('page');

    showOverlay('Loading ' + fakeUrl + '…');
    setStatus('Loading…', 'loading');
    const t0 = Date.now();

    ourIframeTokenRef.current = ++pendingIframeTokenRef.current;

    // No real origin to set a <base href> against — relative links/assets in
    // the file won't resolve, but the reporter still lets us intercept clicks.
    const injected = src.replace(/<head(\s[^>]*)?>/i, (m) => m + NAV_REPORTER);
    setIframeDoc({ mode: 'srcdoc', srcdoc: injected, src: '' });

    setSourceText(src);

    hideOverlay();
    setStatus('Loaded: ' + fakeUrl);
    setSbTime(Date.now() - t0 + ' ms');
  }

  // ─── Load page ──────────────────────────────────────────────────────────

  async function loadPage(url, addToHistory = true) {
    // file:// history entries (Back/Forward/Reload) have no real address to
    // fetch — replay the cached content from when the file was originally picked.
    if (isFileUrl(url)) {
      if (url in localFilesRef.current) {
        loadLocalFile(url.replace(/^file:\/\/\/?/i, ''), localFilesRef.current[url], addToHistory);
      } else {
        setStatus('Local file no longer available — pick it again', 'error');
        pickLocalFile();
      }
      return;
    }

    if (loadAbortRef.current) loadAbortRef.current.abort();
    loadAbortRef.current = new AbortController();
    const sig = loadAbortRef.current.signal;

    currentSrcUrlRef.current = url;
    setAddressValue(url);
    setBadgeMode('url');

    if (addToHistory) pushHistory(url);

    setActiveTab((prevTab) => (currentMode !== 'page' ? 'rendered' : prevTab));
    setCurrentMode('page');

    showOverlay('Loading ' + url + '…');
    setStatus('Loading…', 'loading');
    const t0 = Date.now();

    ourIframeTokenRef.current = ++pendingIframeTokenRef.current;

    try {
      let src = '';
      let fetchedViaProxy = false;

      // 1. Direct fetch (no proxy) — works for CORS-friendly sites.
      try {
        const res = await fetch(url, { signal: sig });
        if (res.ok) src = await res.text();
      } catch {
        /* CORS or network error — try proxy */
      }

      // 2. Proxy fetch
      if (!src) {
        try {
          const res = await fetch(proxyUrl(url), { signal: sig });
          if (res.ok) {
            src = await res.text();
            fetchedViaProxy = true;
          }
        } catch {
          /* proxy also failed — fall back to src= */
        }
      }

      if (src) {
        const injected = src.replace(/<head(\s[^>]*)?>/i, (m) => m + `<base href="${url}">` + NAV_REPORTER);
        setIframeDoc({ mode: 'srcdoc', srcdoc: injected, src: '' });
      } else {
        // Both fetches failed — load via src=; page will display but link
        // navigation won't be trackable.
        setIframeDoc({ mode: 'src', srcdoc: '', src: url });
      }

      setSourceText(src ? (fetchedViaProxy ? '(fetched via CORS proxy)\n\n' : '') + src : '(Source unavailable)');

      hideOverlay();
      setStatus('Loaded: ' + url);
      setSbTime(Date.now() - t0 + ' ms');
    } catch (err) {
      if (err.name === 'AbortError') return;
      ourIframeTokenRef.current = 0;
      hideOverlay();
      setStatus('Error loading page', 'error');
      showErrorPane('Could not load page', err.message);
    }
  }

  function showErrorPane(title, detail) {
    setActiveTab('rendered');
    const errHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0d0e11;">
      <div style="background:#1a1d24;border:1px solid #ff5a6e44;border-radius:12px;padding:32px;max-width:460px;text-align:center;font-family:sans-serif;">
        <div style="color:#ff5a6e;font-size:28px;margin-bottom:12px;">⚠</div>
        <h2 style="color:#ff5a6e;margin-bottom:10px;font-size:18px;">${escHtml(title)}</h2>
        <p style="color:#6b7080;font-size:13px;line-height:1.6;">${escHtml(detail)}</p>
      </div>
    </div>`;
    setIframeDoc({ mode: 'srcdoc', srcdoc: errHtml, src: '' });
  }

  function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ─── postMessage: nav-reporter click events from the iframe ────────────

  useEffect(() => {
    function onMessage(e) {
      if (!e.data || e.data.type !== 'nav-click') return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      loadPage(e.data.url);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function injectNavReporter() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc || doc._navReporterInjected) return;
      doc._navReporterInjected = true;
      const s = doc.createElement('script');
      s.textContent = NAV_REPORTER_INLINE_SOURCE;
      if (doc.head) doc.head.appendChild(s);
      else doc.documentElement?.appendChild(s);
    } catch {
      /* cross-origin — script was pre-injected into the HTML */
    }
  }

  function handleIframeLoad() {
    const iframe = iframeRef.current;
    if (ourIframeTokenRef.current !== 0 && ourIframeTokenRef.current === pendingIframeTokenRef.current) {
      ourIframeTokenRef.current = 0;
      injectNavReporter();
      return;
    }

    let loc = null;
    try {
      loc = iframe?.contentWindow?.location?.href ?? null;
    } catch {
      /* cross-origin */
    }
    if (!loc || loc.startsWith('about:')) {
      injectNavReporter();
      return;
    }
    currentSrcUrlRef.current = loc;
    setAddressValue(loc);
    setBadgeMode('url');
    pushHistory(loc);
    setStatus('Loaded: ' + loc);
    injectNavReporter();
  }

  // ─── Search ─────────────────────────────────────────────────────────────

  async function runSearch(query) {
    if (searchAbortRef.current) searchAbortRef.current.abort();
    searchAbortRef.current = new AbortController();
    const sig = searchAbortRef.current.signal;

    setCurrentMode('search');
    setAddressValue(query);
    setBadgeMode('search');
    setActiveTab('rendered');

    setSearch({ status: 'loading', msg: `Searching for "${query}"…`, results: [] });
    setStatus(`Searching: ${query}`, 'loading');

    const all = [];
    await Promise.allSettled([
      searchWiki(query, sig).then((r) => all.push(...r)).catch(() => {}),
      searchBooks(query, sig).then((r) => all.push(...r)).catch(() => {}),
      searchDict(query, sig).then((r) => all.push(...r)).catch(() => {}),
    ]);
    all.push(...directLinks(query));

    if (all.length === 0) {
      setSearch({ status: 'done', msg: `No results for "${query}"`, results: [] });
      setStatus('No results', 'error');
      return;
    }

    setSearch({ status: 'done', msg: `${all.length} results for "${query}"`, results: all });
    setStatus(`Found ${all.length} results for "${query}"`);
  }

  function handleResultClick(url) {
    setActiveTab('rendered');
    loadPage(url);
  }

  // ─── Tabs / back / forward / reload ─────────────────────────────────────

  function handleBack() {
    if (nav.idx <= 0) return;
    const idx = nav.idx - 1;
    setNav((prev) => ({ ...prev, idx }));
    loadPage(nav.history[idx], false);
  }

  function handleForward() {
    if (nav.idx >= nav.history.length - 1) return;
    const idx = nav.idx + 1;
    setNav((prev) => ({ ...prev, idx }));
    loadPage(nav.history[idx], false);
  }

  function handleReload() {
    if (currentMode === 'page' && currentSrcUrlRef.current) loadPage(currentSrcUrlRef.current, false);
    else if (currentMode === 'search') runSearch(addressValue.trim());
  }

  // Group search results by provider, in first-seen order (mirrors the
  // original's Object.entries(grouped) iteration order).
  const groupedResults = [];
  for (const item of search.results) {
    let group = groupedResults.find((g) => g.label === item.group);
    if (!group) {
      group = { label: item.group, items: [] };
      groupedResults.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="app">
      <div className="toolbar">
        <button className="nav-btn" id="backBtn" title="Back" disabled={backDisabled} onClick={handleBack}>
          ←
        </button>
        <button className="nav-btn" id="fwdBtn" title="Forward" disabled={fwdDisabled} onClick={handleForward}>
          →
        </button>
        <button className="nav-btn" id="reloadBtn" title="Reload" onClick={handleReload}>
          ↻
        </button>

        <div className="bar-wrap">
          <span className={`mode-badge${badgeMode === 'url' ? ' url-mode' : badgeMode === 'search' ? ' srch-mode' : ''}`}>
            {badgeMode.toUpperCase()}
          </span>
          <input
            id="addressInput"
            ref={addressInputRef}
            type="text"
            placeholder="Enter URL or search query…"
            autoComplete="off"
            spellCheck="false"
            value={addressValue}
            onChange={handleAddressChange}
            onKeyDown={handleAddressKeyDown}
          />
          <button className="go-btn" id="goBtn" title="Go" onClick={handleGo}>
            ➤
          </button>
        </div>

        <div className="tabs">
          <button className={`tab${activeTab === 'rendered' ? ' active' : ''}`} onClick={() => setActiveTab('rendered')}>
            Rendered
          </button>
          <button className={`tab${activeTab === 'source' ? ' active' : ''}`} onClick={() => setActiveTab('source')}>
            Source
          </button>
        </div>
      </div>

      <div className="content">
        <div className={`overlay${overlay.show ? '' : ' off'}`} id="overlay">
          <div className="big-spin" />
          <div className="overlay-msg">{overlay.msg}</div>
        </div>

        <div className={`pane${visiblePane === 'rendered' ? ' visible' : ''}`} id="renderedPane">
          <iframe
            id="viewer"
            ref={iframeRef}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation-by-user-activation"
            src={iframeDoc.mode === 'src' ? iframeDoc.src : undefined}
            srcDoc={iframeDoc.mode === 'srcdoc' ? iframeDoc.srcdoc : undefined}
            onLoad={handleIframeLoad}
          />
        </div>

        <div className={`pane${visiblePane === 'source' ? ' visible' : ''}`} id="sourcePane">
          <pre id="sourceCode">{sourceText}</pre>
        </div>

        <div className={`pane${visiblePane === 'search' ? ' visible' : ''}`} id="searchPane">
          {search.status === 'idle' && (
            <div className="placeholder" id="searchPlaceholder">
              <div className="icon">🔍</div>
              <div>Type a search query in the address bar and press Enter</div>
            </div>
          )}
          {search.status !== 'idle' && (
            <div className="search-status" id="searchStatus" style={{ display: 'flex' }}>
              <div className={`spin${search.status === 'loading' ? ' on' : ''}`} id="searchSpin" />
              <span id="searchMsg">{search.msg}</span>
            </div>
          )}
          <div id="searchResults">
            {groupedResults.map((group) => (
              <div className="result-group" key={group.label}>
                <div className="group-label">
                  {group.label} <span style={{ opacity: 0.5, fontWeight: 400 }}>({group.items.length})</span>
                </div>
                {group.items.map((item) => (
                  <a
                    className="result-card"
                    href="#"
                    key={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      handleResultClick(item.url);
                    }}
                  >
                    <div className="r-title">{item.title}</div>
                    <div className="r-url">{item.displayUrl}</div>
                    <div className="r-snippet">{item.snippet}</div>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="statusbar">
        <div className={`dot${status.state === 'loading' ? ' loading' : status.state === 'error' ? ' error' : ''}`} />
        <span>{status.msg}</span>
        <span>{sbTime}</span>
      </div>
    </div>
  );
}
