/* ─── DOM ─── */
const addressInput = document.getElementById('addressInput');
const modeBadge    = document.getElementById('modeBadge');
const goBtn        = document.getElementById('goBtn');
const backBtn      = document.getElementById('backBtn');
const fwdBtn       = document.getElementById('fwdBtn');
const reloadBtn    = document.getElementById('reloadBtn');
const overlay      = document.getElementById('overlay');
const overlayMsg   = document.getElementById('overlayMsg');
const viewer       = document.getElementById('viewer');
const sourceCode   = document.getElementById('sourceCode');
const renderedPane = document.getElementById('renderedPane');
const sourcePane   = document.getElementById('sourcePane');
const searchPane   = document.getElementById('searchPane');
const searchStatus = document.getElementById('searchStatus');
const searchMsg    = document.getElementById('searchMsg');
const searchSpin   = document.getElementById('searchSpin');
const searchResults= document.getElementById('searchResults');
const searchPlaceholder = document.getElementById('searchPlaceholder');
const sbDot        = document.getElementById('sbDot');
const sbMsg        = document.getElementById('sbMsg');
const sbTime       = document.getElementById('sbTime');
const tabs         = document.querySelectorAll('.tab');

/* ─── STATE ─── */
let currentMode = 'start';   // 'page' | 'search' | 'start'
let currentSrcUrl  = '';
let pageSource  = '';
let activeTab   = 'rendered';
let navHistory  = [];   // renamed from 'history' to avoid shadowing window.history
let histIdx     = -1;
let loadAbort   = null;
// Token set whenever WE trigger an iframe load (via src= or srcdoc=).
// The load event consumes it; while it is set, load events are ours — not user navigation.
// We use a counter token instead of the URL so that srcdoc loads (which report about:srcdoc)
// are still correctly recognised as programmatic and never leak into history.
let pendingIframeToken = 0;   // incremented on each programmatic load
let ourIframeToken     = 0;   // the token value the next load event should match

/* ─── HELPERS ─── */
function isUrl(val) {
  const v = val.trim();
  if (/^https?:\/\//i.test(v)) return true;
  if (/^[a-z0-9-]+(\.[a-z]{2,})(\/|$)/i.test(v) && !v.includes(' ')) return true;
  return false;
}

function normalizeUrl(val) {
  const v = val.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v;
}

function setStatus(msg, state='ok') {
  sbMsg.textContent = msg;
  sbDot.className = 'dot' + (state==='loading' ? ' loading' : state==='error' ? ' error' : '');
}

function showOverlay(msg) {
  overlayMsg.textContent = msg || 'Loading…';
  overlay.classList.remove('off');
}
function hideOverlay() { overlay.classList.add('off'); }

function switchPane(pane) {
  renderedPane.classList.remove('visible');
  sourcePane.classList.remove('visible');
  searchPane.classList.remove('visible');
  pane.classList.add('visible');
}

function updateTabHighlight() {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
}

function updateNavButtons() {
  backBtn.disabled = histIdx <= 0;
  fwdBtn.disabled  = histIdx >= navHistory.length - 1;
}

function pushHistory(url) {
  navHistory = navHistory.slice(0, histIdx + 1);
  navHistory.push(url);
  histIdx = navHistory.length - 1;
  updateNavButtons();
}

/* ─── ADDRESS BAR LIVE UPDATE ─── */
addressInput.addEventListener('input', () => {
  const v = addressInput.value.trim();
  if (!v) {
    modeBadge.textContent = 'URL';
    modeBadge.className = 'mode-badge';
    return;
  }
  if (isUrl(v)) {
    modeBadge.textContent = 'URL';
    modeBadge.className = 'mode-badge url-mode';
  } else {
    modeBadge.textContent = 'SEARCH';
    modeBadge.className = 'mode-badge srch-mode';
  }
});

addressInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleGo();
});
goBtn.addEventListener('click', handleGo);

/* ─── MAIN DISPATCH ─── */
function handleGo() {
  const val = addressInput.value.trim();
  if (!val) return;
  if (isUrl(val)) {
    const url = normalizeUrl(val);
    loadPage(url);
  } else {
    runSearch(val);
  }
}

/* ─── LOAD PAGE ─── */

// Public CORS proxy — wraps any URL so fetch() can read the response body.
// Without this, fetch() fails for ~99% of real sites (no CORS headers),
// forcing us to use viewer.src= which makes link tracking impossible.
function proxyUrl(url) {
  return 'https://corsproxy.io/?' + encodeURIComponent(url);
}

async function loadPage(url, addToHistory=true) {
  if (loadAbort) loadAbort.abort();
  loadAbort = new AbortController();
  const sig = loadAbort.signal;

  currentSrcUrl = url;
  addressInput.value = url;
  modeBadge.textContent = 'URL';
  modeBadge.className = 'mode-badge url-mode';

  if (addToHistory) pushHistory(url);

  if (currentMode !== 'page') {
    activeTab = 'rendered';
    updateTabHighlight();
  }
  currentMode = 'page';

  showOverlay('Loading ' + url + '…');
  setStatus('Loading…', 'loading');
  const t0 = Date.now();

  ourIframeToken = ++pendingIframeToken;

  try {
    // Try direct fetch first (works for CORS-friendly sites, avoids proxy overhead).
    // Fall back to proxy fetch so we get the HTML source for srcdoc injection.
    let src = '';
    let fetchedViaProxy = false;

    // 1. Direct fetch (no proxy)
    try {
      const res = await fetch(url, { signal: sig });
      if (res.ok) src = await res.text();
    } catch { /* CORS or network error — try proxy */ }

    // 2. Proxy fetch
    if (!src) {
      try {
        const res = await fetch(proxyUrl(url), { signal: sig });
        if (res.ok) { src = await res.text(); fetchedViaProxy = true; }
      } catch { /* proxy also failed — fall back to src= */ }
    }

    pageSource = src;

    if (src) {
      // We have the HTML — inject base tag + nav-reporter and load via srcdoc.
      // This gives us full link-click interception regardless of origin.
      const injected = src.replace(/<head(\s[^>]*)?>/i,
        m => m + `<base href="${url}">` + NAV_REPORTER);
      viewer.removeAttribute('src');
      viewer.srcdoc = injected;
    } else {
      // Both fetches failed (network down, very strict CSP, etc.).
      // Load via src= — page will display but link navigation won't be trackable.
      viewer.removeAttribute('srcdoc');
      viewer.src = url;
    }

    sourceCode.textContent = src
      ? (fetchedViaProxy ? '(fetched via CORS proxy)\n\n' : '') + src
      : '(Source unavailable)';

    hideOverlay();
    setStatus('Loaded: ' + url);
    sbTime.textContent = (Date.now() - t0) + ' ms';

    if (activeTab === 'source') switchPane(sourcePane);
    else switchPane(renderedPane);

  } catch (err) {
    if (err.name === 'AbortError') return;
    ourIframeToken = 0;
    hideOverlay();
    setStatus('Error loading page', 'error');
    showErrorPane('Could not load page', err.message);
  }
}

/* ─── NAV-REPORTER SCRIPT ────────────────────────────────────────────────────
   Injected into every page we load via srcdoc.
   Intercepts ALL link clicks: prevents the iframe from navigating itself
   (which would lose the reporter on the next page) and postMessages the URL
   to the parent, which calls loadPage() — so every page is always loaded by
   us with the reporter re-injected.
   ────────────────────────────────────────────────────────────────────────── */
const NAV_REPORTER = `
<script>
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'nav-click', url: href }, '*');
  }, true);
})();
<\/script>`;

// When the reporter fires, we own the navigation — call loadPage ourselves.
// This ensures every page is always loaded by us with the reporter re-injected.
window.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'nav-click') return;
  if (e.source !== viewer.contentWindow) return;
  loadPage(e.data.url);
});

/* ─── IFRAME load event ─── */
viewer.addEventListener('load', () => {
  // Consume our programmatic-load token — means loadPage() triggered this.
  // Address bar & history already set; just re-inject the reporter and return.
  if (ourIframeToken !== 0 && ourIframeToken === pendingIframeToken) {
    ourIframeToken = 0;
    injectNavReporter();
    return;
  }

  // No token: unexpected load (e.g. src= page navigated itself despite reporter,
  // or initial about:blank). Try to read the URL and update UI if meaningful.
  let loc = null;
  try { loc = viewer.contentWindow?.location?.href ?? null; } catch { /* cross-origin */ }
  if (!loc || loc.startsWith('about:')) {
    injectNavReporter();
    return;
  }
  currentSrcUrl = loc;
  addressInput.value = loc;
  modeBadge.textContent = 'URL';
  modeBadge.className = 'mode-badge url-mode';
  pushHistory(loc);
  setStatus('Loaded: ' + loc);
  injectNavReporter();
});

/* Inject the nav-reporter into the iframe's live document.
   For srcdoc pages (same-origin) we can do this via contentDocument.
   For cross-origin src= pages this throws — but the script was already
   injected into the HTML before we set viewer.src (see loadPage).          */
function injectNavReporter() {
  try {
    const doc = viewer.contentDocument;
    if (!doc || doc._navReporterInjected) return;
    doc._navReporterInjected = true;
    const s = doc.createElement('script');
    s.textContent = `
      (function(){
        document.addEventListener('click', function(e){
          var a = e.target.closest('a[href]');
          if (!a) return;
          var href = a.href;
          if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) return;
          window.parent.postMessage({ type: 'nav-click', url: href }, '*');
        }, true);
      })();
    `;
    doc.head?.appendChild(s) || doc.documentElement?.appendChild(s);
  } catch { /* cross-origin — script was pre-injected into the HTML */ }
}

/* ─── SHOW ERROR ─── */
function showErrorPane(title, detail) {
  switchPane(renderedPane);
  const errHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0d0e11;">
    <div style="background:#1a1d24;border:1px solid #ff5a6e44;border-radius:12px;padding:32px;max-width:460px;text-align:center;font-family:sans-serif;">
      <div style="color:#ff5a6e;font-size:28px;margin-bottom:12px;">⚠</div>
      <h2 style="color:#ff5a6e;margin-bottom:10px;font-size:18px;">${escHtml(title)}</h2>
      <p style="color:#6b7080;font-size:13px;line-height:1.6;">${escHtml(detail)}</p>
    </div>
  </div>`;
  viewer.srcdoc = errHtml;
}

/* ─── SEARCH ─── */
let searchAbort = null;

async function runSearch(query) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  currentMode = 'search';
  addressInput.value = query;
  modeBadge.textContent = 'SEARCH';
  modeBadge.className = 'mode-badge srch-mode';

  // Show search pane
  activeTab = 'rendered';
  updateTabHighlight();
  switchPane(searchPane);
  searchPlaceholder.style.display = 'none';
  searchStatus.style.display = 'flex';
  searchSpin.classList.add('on');
  searchMsg.textContent = `Searching for "${query}"…`;
  searchResults.innerHTML = '';
  setStatus(`Searching: ${query}`, 'loading');

  const all = [];
  const sig = searchAbort.signal;

  await Promise.allSettled([
    searchWiki(query, sig).then(r => all.push(...r)).catch(() => {}),
    searchBooks(query, sig).then(r => all.push(...r)).catch(() => {}),
    searchDict(query, sig).then(r => all.push(...r)).catch(() => {}),
  ]);

  all.push(...directLinks(query));

  searchSpin.classList.remove('on');

  if (all.length === 0) {
    searchMsg.textContent = `No results for "${query}"`;
    searchResults.innerHTML = '';
    setStatus('No results', 'error');
    return;
  }

  searchMsg.textContent = `${all.length} results for "${query}"`;
  setStatus(`Found ${all.length} results for "${query}"`);
  renderSearchResults(all, query);
}

async function searchWiki(q, sig) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=8`;
  const r = await fetch(url, { signal: sig });
  const d = await r.json();
  return d.query.search.map(item => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g,'_'))}`,
    displayUrl: 'wikipedia.org',
    snippet: stripHtml(item.snippet),
    group: '📚 Wikipedia'
  }));
}

async function searchBooks(q, sig) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`;
  const r = await fetch(url, { signal: sig });
  const d = await r.json();
  return d.docs.slice(0,5).map(b => ({
    title: b.title,
    url: `https://openlibrary.org${b.key}`,
    displayUrl: 'openlibrary.org',
    snippet: b.author_name ? `By ${b.author_name.join(', ')}${b.first_publish_year ? ` · ${b.first_publish_year}` : ''}` : 'Book',
    group: '📖 OpenLibrary'
  }));
}

async function searchDict(q, sig) {
  if (q.includes(' ') || q.length > 30) return [];
  const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, { signal: sig });
  if (!r.ok) return [];
  const d = await r.json();
  return d.slice(0,2).flatMap(e => {
    const m = e.meanings?.[0];
    const def = m?.definitions?.[0];
    if (!def) return [];
    return [{
      title: `${e.word} — ${m.partOfSpeech}`,
      url: `https://en.wiktionary.org/wiki/${encodeURIComponent(e.word)}`,
      displayUrl: 'wiktionary.org',
      snippet: def.definition + (def.example ? ` · "${def.example}"` : ''),
      group: '🔠 Dictionary'
    }];
  });
}

function directLinks(q) {
  return [
    { title: `"${q}" on Google`,     url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,          displayUrl:'google.com',       snippet:'Search on Google.',       group:'🔗 Web Search' },
    { title: `"${q}" on DuckDuckGo`, url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,               displayUrl:'duckduckgo.com',   snippet:'Privacy-focused search.', group:'🔗 Web Search' },
    { title: `"${q}" on Bing`,       url: `https://www.bing.com/search?q=${encodeURIComponent(q)}`,           displayUrl:'bing.com',         snippet:"Microsoft's search.",     group:'🔗 Web Search' },
    { title: `"${q}" on Brave`,      url: `https://search.brave.com/search?q=${encodeURIComponent(q)}`,      displayUrl:'search.brave.com', snippet:'Independent search.',     group:'🔗 Web Search' },
    { title: `"${q}" on YouTube`,    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, displayUrl:'youtube.com', snippet:'Video search.',           group:'🎥 Video' },
  ];
}

function renderSearchResults(results, query) {
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  });
  let html = '';
  for (const [grp, items] of Object.entries(grouped)) {
    html += `<div class="result-group">
      <div class="group-label">${escHtml(grp)} <span style="opacity:.5;font-weight:400;">(${items.length})</span></div>`;
    for (const it of items) {
      html += `<a class="result-card" href="#" data-url="${escAttr(it.url)}">
        <div class="r-title">${escHtml(it.title)}</div>
        <div class="r-url">${escHtml(it.displayUrl)}</div>
        <div class="r-snippet">${escHtml(it.snippet)}</div>
      </a>`;
    }
    html += '</div>';
  }
  searchResults.innerHTML = html;

  // Clicking a search result loads it in the browser
  searchResults.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', e => {
      e.preventDefault();
      const url = card.dataset.url;
      activeTab = 'rendered';
      updateTabHighlight();
      loadPage(url);
    });
  });
}

/* ─── TABS ─── */
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    updateTabHighlight();

    if (currentMode === 'search') {
      switchPane(searchPane);
      return;
    }

    if (activeTab === 'source') {
      switchPane(sourcePane);
    } else {
      switchPane(renderedPane);
    }
  });
});

/* ─── BACK / FORWARD ─── */
backBtn.addEventListener('click', () => {
  if (histIdx <= 0) return;
  histIdx--;
  updateNavButtons();
  const url = navHistory[histIdx];
  loadPage(url, false);
});
fwdBtn.addEventListener('click', () => {
  if (histIdx >= navHistory.length - 1) return;
  histIdx++;
  updateNavButtons();
  const url = navHistory[histIdx];
  loadPage(url, false);
});
reloadBtn.addEventListener('click', () => {
  if (currentMode === 'page' && currentSrcUrl) loadPage(currentSrcUrl, false);
  else if (currentMode === 'search') runSearch(addressInput.value.trim());
});

/* ─── UTILS ─── */
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function escAttr(s) {
  return s ? s.replace(/"/g, '&quot;') : '';
}

/* ─── INIT ─── */
addressInput.focus();