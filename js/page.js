(function() {
    "use strict";

    // ============== Silence console errors ==============
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    console.error = function() {
        const msg = arguments[0] || '';
        if (typeof msg === 'string') {
            if (msg.includes('Dark Reader') || msg.includes('CORS') || msg.includes('AllOrigins') ||
                msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('cross-origin')) {
                return;
            }
        }
        originalConsoleError.apply(console, arguments);
    };
    console.warn = function() {
        const msg = arguments[0] || '';
        if (typeof msg === 'string') {
            if (msg.includes('Dark Reader') || msg.includes('sandbox') || msg.includes('cross-origin')) {
                return;
            }
        }
        originalConsoleWarn.apply(console, arguments);
    };

    // Ensure DOM is ready before accessing elements
    function ensureDom() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => main());
        } else {
            main();
        }
    }

    function main() {
        // ============== DOM Elements ==============
        const urlInput = document.getElementById('urlInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const renderedView = document.getElementById('renderedView');
        const sourceView = document.getElementById('sourceView');
        const errorView = document.getElementById('errorView');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const statusText = document.getElementById('statusText');
        const loadTime = document.getElementById('loadTime');
        const viewBtns = document.querySelectorAll('.view-btn');
        const errorBtn = document.querySelector('[data-view="error"]');

        // ============== State ==============
        let currentUrl = '';
        let currentController = null;
        let currentBlobUrl = null;
        let darkReaderEnabled = false;

        // ============== Configuration ==============
        const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

        const CONFIG = {
            PROXIES: [
                {
                    name: 'CORSProxy.io',
                    buildUrl: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
                    extraHeaders: {
                        'x-corsproxy-headers': JSON.stringify({
                            'User-Agent': BROWSER_UA,
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Cache-Control': 'no-cache'
                        })
                    }
                },
                {
                    name: 'AllOrigins',
                    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                    extraHeaders: {}
                },
                {
                    name: 'CodeTabs',
                    buildUrl: (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
                    extraHeaders: {}
                },
                {
                    name: 'ThingProxy',
                    buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
                    extraHeaders: {}
                },
                {
                    name: 'CORS Anywhere',
                    buildUrl: (url) => `https://cors-anywhere.herokuapp.com/${url}`,
                    extraHeaders: { 'x-requested-with': 'XMLHttpRequest' }
                }
            ],
            TIMEOUT: 15000, // Increased timeout
            MAX_REDIRECTS: 3,
            RACE_BATCH_SIZE: 3
        };

        // ============== Helper Functions ==============
        function escapeHtml(text) { 
            const d = document.createElement('div'); 
            d.textContent = text; 
            return d.innerHTML; 
        }

        function showLoading(show) { 
            if (loadingOverlay) loadingOverlay.classList[show ? 'remove' : 'add']('hidden'); 
        }

        // ============== Disable Dark Reader ==============
        function disableDarkReader() {
            if (window.DarkReader) {
                try {
                    if (typeof DarkReader.disable === 'function') DarkReader.disable();
                } catch(e) {}
            }
            document.querySelectorAll('meta[name="darkreader"], style[data-darkreader]').forEach(el => el.remove());
        }

        // ============== Show Error ==============
        function showError(message) {
            if (!errorView) return;
            errorView.classList.remove('hidden');
            const isHardBlocked = message.includes('bot detection') || message.includes('Cloudflare') || message.includes('headless') || message.includes('login');
            errorView.innerHTML = `
                <div style="padding:20px;background:#2a2a2a;border-radius:8px;border-left:4px solid #dc3545;">
                    <h3 style="color:#dc3545;margin-top:0;">Error Loading Page</h3>
                    <p style="color:#e0e0e0;">${escapeHtml(message)}</p>
                    <div style="margin-top:20px;padding-top:10px;border-top:1px solid #444;">
                        <p style="font-size:14px;color:#888;">${isHardBlocked ? 'Why this cannot be fixed with a proxy:' : 'Try these solutions:'}</p>
                        <ul style="color:#aaa;">
                            ${isHardBlocked
                                ? `<li>The site uses Cloudflare or similar bot detection</li>
                                   <li>It may require a logged-in session / cookies</li>
                                   <li>Only a server-side headless browser (Puppeteer/Playwright) can bypass this</li>`
                                : `<li>Check if the URL is correct</li>
                                   <li>Try a different website</li>
                                   <li>The website might block proxies</li>`}
                        </ul>
                    </div>
                </div>`;
            if (errorBtn) { 
                errorBtn.style.display = 'inline-block'; 
                errorBtn.click(); 
            }
            if (statusText) statusText.textContent = 'Error';
        }

        // ============== Detect proxy error pages ==============
        function isProxyErrorPage(html) {
            const lower = html.toLowerCase();
            return (
                (lower.includes('403 error') && lower.includes('cloudfront')) ||
                lower.includes('generated by cloudfront') ||
                (lower.includes('access denied') && lower.includes('cloudfront')) ||
                (lower.includes('request blocked') && lower.includes('cloudfront')) ||
                (lower.includes('error') && lower.includes("we can't connect to the server")) ||
                (html.length < 500 && lower.includes('error'))
            );
        }

        // ============== Fetch via Specific Proxy ==============
        async function fetchViaProxy(url, proxy, extraSignal) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

            const signals = [controller.signal];
            if (extraSignal) signals.push(extraSignal);
            if (currentController) signals.push(currentController.signal);

            // Use AbortSignal.any if available, otherwise just use the controller signal
            let signal = controller.signal;
            if (typeof AbortSignal !== 'undefined' && AbortSignal.any) {
                try {
                    signal = AbortSignal.any(signals);
                } catch(e) {
                    signal = controller.signal;
                }
            }

            try {
                const proxyUrl = proxy.buildUrl(url);
                const response = await fetch(proxyUrl, {
                    signal,
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        ...proxy.extraHeaders
                    }
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                clearTimeout(timeoutId);
                if (!html || html.length < 50) throw new Error('Empty response');

                let fetchedUrl = url;
                let currentHtml = html;

                for (let i = 0; i < CONFIG.MAX_REDIRECTS; i++) {
                    const metaRedirect = currentHtml.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["']\d+;\s*url=([^"'\s>]+)/i);
                    if (!metaRedirect) break;
                    try {
                        fetchedUrl = new URL(metaRedirect[1], fetchedUrl).href;
                        const next = await fetchViaProxy(fetchedUrl, proxy, extraSignal);
                        currentHtml = next.html;
                    } catch(e) {
                        break;
                    }
                }

                return { html: currentHtml, finalUrl: fetchedUrl };

            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }

        // Race a set of proxies — first valid one wins, others are cancelled
        function raceProxies(url, proxies) {
            return new Promise((resolve, reject) => {
                let settled = false;
                let failCount = 0;
                const errors = [];
                const controllers = [];

                if (!proxies.length) {
                    reject(new Error('No proxies available'));
                    return;
                }

                proxies.forEach((proxy, i) => {
                    const ctl = new AbortController();
                    controllers.push(ctl);

                    fetchViaProxy(url, proxy, ctl.signal).then(result => {
                        if (settled) return;
                        if (result && result.html && result.html.length > 100 && !isProxyErrorPage(result.html)) {
                            settled = true;
                            controllers.forEach((c, j) => { if (j !== i) try { c.abort(); } catch(e) {} });
                            resolve({ html: result.html, finalUrl: result.finalUrl || url, usedProxy: proxy.name });
                        } else {
                            errors.push(`${proxy.name}: returned error/empty page`);
                            if (++failCount === proxies.length) reject(new Error(errors.join('; ')));
                        }
                    }).catch(err => {
                        if (settled) return;
                        errors.push(`${proxy.name}: ${err.message}`);
                        if (++failCount === proxies.length) reject(new Error(errors.join('; ')));
                    });
                });
            });
        }

        // ============== Race proxies in batches ==============
        async function fetchWithRacing(url) {
            const proxies = CONFIG.PROXIES;
            const n = CONFIG.RACE_BATCH_SIZE;

            try {
                return await raceProxies(url, proxies.slice(0, n));
            } catch(e) { 
                // First batch failed, try remaining
            }

            if (proxies.length > n) {
                try {
                    return await raceProxies(url, proxies.slice(n));
                } catch(e) { 
                    // All proxies failed
                }
            }

            throw new Error(
                'Unable to load page through any proxy. ' +
                'This site likely uses bot detection (e.g. Cloudflare), requires login, or actively blocks all public proxies. ' +
                'A server-side headless browser (Puppeteer/Playwright) would be needed for sites like this.'
            );
        }

        // ============== Format HTML ==============
        function formatHtml(html) {
            let out = '', indent = 0, line = '', inStyle = false, inScript = false;
            const maxLen = Math.min(html.length, 500000);
            for (let i = 0; i < maxLen; i++) {
                const c = html[i];
                if (html.substring(i, i+7) === '<style>') inStyle = true;
                if (html.substring(i, i+8) === '</style>') inStyle = false;
                if (html.substring(i, i+8) === '<script>') inScript = true;
                if (html.substring(i, i+9) === '</script>') inScript = false;
                if (inStyle || inScript) { out += c; continue; }
                if (c === '<') {
                    if (line.trim()) { out += '  '.repeat(indent) + line.trim() + '\n'; line = ''; }
                    line += c;
                } else if (c === '>') {
                    line += c;
                    const closing = /^<\//.test(line);
                    const selfClose = /\/>$/.test(line);
                    const voidEl = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/i.test(line);
                    if (closing) indent = Math.max(0, indent - 1);
                    out += '  '.repeat(indent) + line.trim() + '\n';
                    line = '';
                    if (!closing && !selfClose && !voidEl) indent++;
                } else {
                    line += c;
                }
            }
            if (line.trim()) out += '  '.repeat(indent) + line.trim() + '\n';
            return out || html.substring(0, 500000);
        }

        // ============== Process Page ==============
        async function processAndDisplayPage(html, baseUrl) {
            if (!renderedView || !sourceView) return;
            
            if (currentBlobUrl) { 
                URL.revokeObjectURL(currentBlobUrl); 
                currentBlobUrl = null; 
            }

            let p = html;

            // Add base tag if not present
            if (!p.includes('<base')) {
                p = p.replace(/<head[^>]*>/, `$&\n<base href="${baseUrl}">`);
            }
            
            // Add CSP meta tag
            p = p.replace(/<head[^>]*>/, `$&\n<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">`);

            // Remove problematic scripts
            p = p.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
                if (/top\.location|parent\.location|window\.top|self !== top|darkreader|xv\.disclaimer|xv\.cats|require\(/.test(match)) return '';
                return match;
            });

            // Fix relative URLs in src attributes
            p = p.replace(/src=["']([^"']+)["']/gi, (match, src) => {
                if (src.startsWith('//')) return `src="https:${src}"`;
                if (src.startsWith('/')) { 
                    try { 
                        const origin = new URL(baseUrl).origin;
                        return `src="${origin}${src}"`; 
                    } catch(e) {} 
                }
                return match;
            });

            // Fix relative URLs in href attributes
            p = p.replace(/href=["']([^"']+)["']/gi, (match, href) => {
                if (href.startsWith('//')) return `href="https:${href}"`;
                if (href.startsWith('/')) { 
                    try { 
                        const origin = new URL(baseUrl).origin;
                        return `href="${origin}${href}"`; 
                    } catch(e) {} 
                }
                return match;
            });

            // Add jQuery if missing
            if (!p.includes('jquery') && !p.includes('jQuery')) {
                p = p.replace(/<head[^>]*>/, '$&\n<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>');
            }
            
            // Add anti-error scripts
            p = p.replace(/<head[^>]*>/, '$&\n<script>window.xv=window.xv||{};xv.disclaimer=xv.disclaimer||{display:function(){}};xv.cats=xv.cats||{init_write_stored_order:function(){}};window.require=window.require||function(){return{}};window.requirejs=window.requirejs||function(){};</script>');

            // Update source view
            sourceView.textContent = formatHtml(p);

            // Create blob and load in iframe
            const blobUrl = URL.createObjectURL(new Blob([p], { type: 'text/html' }));
            currentBlobUrl = blobUrl;
            
            // Remove sandbox for better compatibility
            renderedView.removeAttribute('sandbox');
            renderedView.src = blobUrl;
        }

        // ============== Main Load Function ==============
        async function loadPage() {
            let url = urlInput ? urlInput.value.trim() : '';
            if (!url) { 
                if (errorView) showError('Please enter a URL'); 
                return; 
            }
            if (!url.match(/^https?:\/\//i)) { 
                url = 'https://' + url; 
                if (urlInput) urlInput.value = url; 
            }

            if (currentController) currentController.abort();
            currentController = new AbortController();

            const startTime = Date.now();
            showLoading(true);
            if (loadingText) loadingText.textContent = 'Racing proxies...';
            if (statusText) statusText.textContent = `Loading...`;
            if (errorView) errorView.classList.add('hidden');

            try {
                disableDarkReader();
                const result = await fetchWithRacing(url);

                if (loadingText) loadingText.textContent = 'Processing page...';
                await processAndDisplayPage(result.html, result.finalUrl);

                const elapsed = Date.now() - startTime;
                if (loadTime) loadTime.textContent = `Loaded in ${elapsed}ms via ${result.usedProxy}`;
                if (statusText) statusText.textContent = `Loaded`;
                currentUrl = result.finalUrl;

                // Switch to rendered view
                const renderedBtn = document.querySelector('[data-view="rendered"]');
                if (renderedBtn) renderedBtn.click();

            } catch (error) {
                if (error.name !== 'AbortError') {
                    showError(`Failed to load ${url}: ${error.message}`);
                    if (loadTime) loadTime.textContent = `Failed after ${Date.now() - startTime}ms`;
                }
            } finally {
                showLoading(false);
                currentController = null;
            }
        }

        function refreshPage() { 
            if (urlInput) {
                urlInput.value = currentUrl || urlInput.value; 
            }
            loadPage(); 
        }

        // ============== View Switching ==============
        function initViewSwitching() {
            if (!viewBtns.length) return;
            viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    viewBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const view = btn.dataset.view;
                    if (renderedView) renderedView.classList.add('hidden');
                    if (sourceView) sourceView.classList.add('hidden');
                    if (errorView) errorView.classList.add('hidden');
                    if (view === 'rendered' && renderedView) renderedView.classList.remove('hidden');
                    if (view === 'source' && sourceView) sourceView.classList.remove('hidden');
                    if (view === 'error' && errorView) errorView.classList.remove('hidden');
                });
            });
        }

        // ============== Event Listeners ==============
        function initEventListeners() {
            if (refreshBtn) refreshBtn.addEventListener('click', refreshPage);
            if (urlInput) urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadPage(); });
            window.addEventListener('beforeunload', () => {
                if (currentController) currentController.abort();
                if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
            });
        }

        // ============== Initialize ==============
        function init() {
            disableDarkReader();
            initViewSwitching();
            initEventListeners();
            
            // Hide error button initially
            if (errorBtn) errorBtn.style.display = 'none';
            
            // Auto-load initial URL
            setTimeout(() => {
                loadPage();
            }, 100);
        }

        init();
    }

    ensureDom();
})();