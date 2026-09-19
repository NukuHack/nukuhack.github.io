// ─── URL helpers ────────────────────────────────────────────────────────────

export function isFileUrl(val) {
  return /^file:\/\/\/?/i.test(val.trim());
}

export function isUrl(val) {
  const v = val.trim();
  if (isFileUrl(v)) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (/^[a-z0-9-]+(\.[a-z]{2,})(\/|$)/i.test(v) && !v.includes(' ')) return true;
  return false;
}

export function normalizeUrl(val) {
  const v = val.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v;
}

// Public CORS proxy — wraps any URL so fetch() can read the response body.
// Without this, fetch() fails for ~99% of real sites (no CORS headers),
// forcing us to use viewer.src= which makes link tracking impossible.
export function proxyUrl(url) {
  return 'https://corsproxy.io/?' + encodeURIComponent(url);
}

export function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}

// ─── NAV-REPORTER SCRIPT ────────────────────────────────────────────────────
// Injected into every page we load via srcdoc. Intercepts ALL link clicks:
// prevents the iframe from navigating itself (which would lose the reporter
// on the next page) and postMessages the URL to the parent, which calls
// loadPage() — so every page is always loaded by us with the reporter
// re-injected.
export const NAV_REPORTER = `
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

export const NAV_REPORTER_INLINE_SOURCE = `
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

// ─── Search providers ───────────────────────────────────────────────────────

export async function searchWiki(q, sig) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=8`;
  const r = await fetch(url, { signal: sig });
  const d = await r.json();
  return d.query.search.map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    displayUrl: 'wikipedia.org',
    snippet: stripHtml(item.snippet),
    group: '📚 Wikipedia',
  }));
}

export async function searchBooks(q, sig) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`;
  const r = await fetch(url, { signal: sig });
  const d = await r.json();
  return d.docs.slice(0, 5).map((b) => ({
    title: b.title,
    url: `https://openlibrary.org${b.key}`,
    displayUrl: 'openlibrary.org',
    snippet: b.author_name
      ? `By ${b.author_name.join(', ')}${b.first_publish_year ? ` · ${b.first_publish_year}` : ''}`
      : 'Book',
    group: '📖 OpenLibrary',
  }));
}

export async function searchDict(q, sig) {
  if (q.includes(' ') || q.length > 30) return [];
  const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, { signal: sig });
  if (!r.ok) return [];
  const d = await r.json();
  return d.slice(0, 2).flatMap((e) => {
    const m = e.meanings?.[0];
    const def = m?.definitions?.[0];
    if (!def) return [];
    return [
      {
        title: `${e.word} — ${m.partOfSpeech}`,
        url: `https://en.wiktionary.org/wiki/${encodeURIComponent(e.word)}`,
        displayUrl: 'wiktionary.org',
        snippet: def.definition + (def.example ? ` · "${def.example}"` : ''),
        group: '🔠 Dictionary',
      },
    ];
  });
}

export function directLinks(q) {
  return [
    { title: `"${q}" on Google`, url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, displayUrl: 'google.com', snippet: 'Search on Google.', group: '🔗 Web Search' },
    { title: `"${q}" on DuckDuckGo`, url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, displayUrl: 'duckduckgo.com', snippet: 'Privacy-focused search.', group: '🔗 Web Search' },
    { title: `"${q}" on Bing`, url: `https://www.bing.com/search?q=${encodeURIComponent(q)}`, displayUrl: 'bing.com', snippet: "Microsoft's search.", group: '🔗 Web Search' },
    { title: `"${q}" on Brave`, url: `https://search.brave.com/search?q=${encodeURIComponent(q)}`, displayUrl: 'search.brave.com', snippet: 'Independent search.', group: '🔗 Web Search' },
    { title: `"${q}" on YouTube`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, displayUrl: 'youtube.com', snippet: 'Video search.', group: '🎥 Video' },
  ];
}
