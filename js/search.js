(function() {
  "use strict";

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const resultsDiv = document.getElementById('results');
  const statusText = document.getElementById('statusText');
  const loadingIndicator = document.getElementById('loadingIndicator');

  let currentController = null;

  async function performSearch() {
    const query = searchInput.value.trim();

    if (!query) {
      showError('Please enter a search term');
      return;
    }

    if (currentController) {
      currentController.abort();
    }
    currentController = new AbortController();

    loadingIndicator.classList.add('visible');
    statusText.textContent = `Searching for "${query}"...`;
    resultsDiv.innerHTML = '<div class="placeholder">🔍 Searching...</div>';

    try {
      const allResults = [];

      try {
        const wikiResults = await searchWikipedia(query);
        allResults.push(...wikiResults);
      } catch (e) {
        console.warn('Wikipedia failed:', e);
      }

      try {
        const bookResults = await searchOpenLibrary(query);
        allResults.push(...bookResults);
      } catch (e) {
        console.warn('OpenLibrary failed:', e);
      }

      try {
        const dictResults = await searchDictionary(query);
        allResults.push(...dictResults);
      } catch (e) {
        console.warn('Dictionary failed:', e);
      }

      allResults.push(...createDirectLinks(query));

      if (allResults.length === 0) {
        resultsDiv.innerHTML = '<div class="placeholder">😕 No results found.</div>';
        statusText.textContent = `No results for "${query}"`;
        return;
      }

      renderResults(allResults);
      statusText.textContent = `Found ${allResults.length} results for "${query}"`;

    } catch (error) {
      if (error.name === 'AbortError') {
        statusText.textContent = 'Search cancelled';
      } else {
        console.error('Search error:', error);
        showError('Search failed. Please try again.');
      }
    } finally {
      loadingIndicator.classList.remove('visible');
      currentController = null;
    }
  }

  async function searchWikipedia(query) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=8`;

    const response = await fetch(url, { signal: currentController.signal });
    const data = await response.json();

    return data.query.search.map(item => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      displayUrl: 'wikipedia.org',
      snippet: stripHtml(item.snippet) + '...',
      source: '📚 Wikipedia'
    }));
  }

  async function searchOpenLibrary(query) {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;

    const response = await fetch(url, { signal: currentController.signal });
    const data = await response.json();

    return data.docs.slice(0, 5).map(book => ({
      title: book.title,
      url: `https://openlibrary.org${book.key}`,
      displayUrl: 'openlibrary.org',
      snippet: book.author_name ? `By ${book.author_name.join(', ')}${book.first_publish_year ? ` · First published ${book.first_publish_year}` : ''}` : 'Book information',
      source: '📖 OpenLibrary'
    }));
  }

  async function searchDictionary(query) {

    if (query.includes(' ') || query.length > 30) return [];

    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url, { signal: currentController.signal });
      if (!response.ok) return [];

      const data = await response.json();
      const results = [];

      for (const entry of data.slice(0, 2)) {
        const meaning = entry.meanings?.[0];
        const definition = meaning?.definitions?.[0];

        if (definition) {
          results.push({
            title: `${entry.word} - ${meaning.partOfSpeech}`,
            url: `https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}`,
            displayUrl: 'wiktionary.org',
            snippet: definition.definition + (definition.example ? ` Example: "${definition.example}"` : ''),
            source: '📖 Dictionary'
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  function createDirectLinks(query) {
    return [
      {
        title: `Search "${query}" on Google`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        displayUrl: 'google.com',
        snippet: 'Click to search on Google - the world\'s largest search engine.',
        source: '🔗 Direct Search'
      },
      {
        title: `Search "${query}" on DuckDuckGo`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        displayUrl: 'duckduckgo.com',
        snippet: 'Click to search on DuckDuckGo - privacy-focused search engine.',
        source: '🔗 Direct Search'
      },
      {
        title: `Search "${query}" on Bing`,
        url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        displayUrl: 'bing.com',
        snippet: 'Click to search on Bing - Microsoft\'s search engine.',
        source: '🔗 Direct Search'
      },
      {
        title: `Search "${query}" on Brave`,
        url: `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
        displayUrl: 'search.brave.com',
        snippet: 'Click to search on Brave Search - independent and privacy-focused.',
        source: '🔗 Direct Search'
      },
      {
        title: `Search "${query}" on YouTube`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        displayUrl: 'youtube.com',
        snippet: 'Click to search for videos on YouTube.',
        source: '🎥 Video Search'
      }
    ];
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function renderResults(results) {

    const grouped = {};
    results.forEach(r => {
      const source = r.source || '🔍 Web';
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(r);
    });

    let html = '';
    for (const [source, sourceResults] of Object.entries(grouped)) {
      html += `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 14px; font-weight: bold; color: #666; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #e0e0e0;">
            ${escapeHtml(source)} (${sourceResults.length})
          </div>
      `;

      for (const r of sourceResults) {
        html += `
          <div class="result">
            <div class="result-title">
              <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a>
            </div>
            <div class="result-url">${escapeHtml(r.displayUrl)}</div>
            <div class="result-snippet">${escapeHtml(r.snippet || '')}</div>
          </div>
        `;
      }

      html += '</div>';
    }

    resultsDiv.innerHTML = html;
  }

  function showError(message) {
    statusText.textContent = 'Error occurred';
    resultsDiv.innerHTML = `<div class="error">❌ ${escapeHtml(message)}</div>`;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function clearResults() {
    if (currentController) {
      currentController.abort();
      currentController = null;
    }

    searchInput.value = '';
    statusText.textContent = '';
    loadingIndicator.classList.remove('visible');
    resultsDiv.innerHTML = '<div class="placeholder">✨ Type a search query and press Enter</div>';
    searchInput.focus();
  }

  clearBtn.addEventListener('click', clearResults);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') performSearch();
  });

  window.addEventListener('beforeunload', () => {
    if (currentController) currentController.abort();
  });

  searchInput.focus();

})();