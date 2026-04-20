const body = document.querySelector("body");

/**
 * Detect depth from root by checking if pathname contains /pages/.
 * Works for both  /index.html  and  /pages/foo.html
 */
const _pathParts = window.location.pathname.split('/').filter(Boolean);
const _inPagesFolder = _pathParts.includes('pages');
const _depth = _inPagesFolder ? 1 : 0;

/** Prefix to reach the site root from wherever we are */
const ROOT = _depth > 0 ? '../'.repeat(_depth) : './';

/** Resolve any root-relative path (e.g. "assets/img.png") to an absolute URL */
function asset(relativePath) {
    const clean = relativePath.replace(/^\.?\//, '');
    return ROOT + clean;
}

/** Navigate to any named page, or to root if no name given */
function ChangePage(name) {
    if (!name || name === 'index') {
        window.location.href = ROOT + 'index.html';
        return;
    }
    window.location.href = ROOT + 'pages/' + name + '.html';
}

// ─── CURRENT PAGE METADATA ───────────────────────────────────────────────────

const _filename = window.location.pathname.split('/').pop();        // "foo.html" or ""
const currentUrl = (_filename.replace(/\.html?$/, '') || 'index'); // "foo" or "index"

const PageHelper = (url) =>
    url === 'index' ? 'Main' : url.slice(0, 1).toUpperCase() + url.slice(1);

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────

let PrefersDark = true;
let isPhone = false;

function SaveToLocalStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error('Error saving to localStorage:', e); }
}

function GetFromLocalStorage(key) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? JSON.parse(value) : undefined;
    } catch (e) { console.error('Error reading localStorage:', e); }
}

// ─── INJECT SHARED HTML ──────────────────────────────────────────────────────

function LoadBasicContent() {
    const navContent = `
<nav class="navbar" id="navbar">
    <div class="navbar_in">
        <p class="navbar_head link" onclick="ChangePage()">${PageHelper(currentUrl)} Page</p>
        <button type="button" class="navbar_toggle" id="navbarToggle" onclick="ToggleNavbar()">
            <img id="menu_image" src="${asset('assets/menu_bars.png')}" alt="Menu" />
        </button>
        <div class="navbar_items" id="navbarDropdown">
            <ul class="navbar_ul">
                <li class="navbar_li">
                    <p class="navbar_item link" onclick="ChangePage('index')">Main Webpage</p>
                </li>
                <li class="navbar_li">
                    <p class="navbar_item link" onclick="ChangePage('code')">Actual Code</p>
                </li>
                <li class="navbar_li dropdown">
                    <p class="navbar_item">Animations</p>
                    <ul class="dropdown_menu">
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('animation')">Animation Page</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('dice')">Dice Page</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('test3d')">3D Test Page</p></li>
                    </ul>
                </li>
                <li class="navbar_li dropdown">
                    <p class="navbar_item">Random Things</p>
                    <ul class="dropdown_menu">
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('extra')">Extra</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('links')">Links</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('urltable')">UrlTable</p></li>
                    </ul>
                </li>
                <li class="navbar_li dropdown">
                    <p class="navbar_item">Small Apps</p>
                    <ul class="dropdown_menu">
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('video')">Video</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('markdown')">Markdown</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('weather')">Weather</p></li>
                        <li class="dropdown_li"><p class="dropdown_item link" onclick="ChangePage('subnet')">Subnet</p></li>
                    </ul>
                </li>
            </ul>
        </div>
        <div class="darkmode-slider">
            <label class="switch">
                <input type="checkbox" id="darkModeToggle" onchange="ToggleDarkMode()">
                <span class="slider"></span>
            </label>
        </div>
    </div>
</nav>
<div id="navbarHelp">.</div>`;

    const modalContent = `<div id="modal" class="modal"></div>`;

    const footerContent = `
<div id="footerHelp">.</div>
<footer id="footer">
    <div class="footer_in">
        <div class="footer_in_in">
            <h5>Stupid webpage</h5>
            <h6>Made by NukuHack ©2024</h6>
        </div>
    </div>
</footer>`;

    body.insertAdjacentHTML('afterbegin', navContent);
    body.insertAdjacentHTML('beforeend', modalContent);
    body.insertAdjacentHTML('beforeend', footerContent);

    // Safety-net fallback (asset() should already be correct)
    document.getElementById('menu_image').onerror = function () {
        this.onerror = null;
        this.src = asset('assets/menu_bars.png');
    };

    // Hover-open dropdowns
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const menu = dropdown.querySelector('.dropdown_menu');
        dropdown.addEventListener('mouseenter', () => {
            dropdowns.forEach(d => {
                if (d !== dropdown) d.querySelector('.dropdown_menu')?.classList.remove('show');
            });
            menu.classList.add('show');
        });
        menu.addEventListener('mouseenter', () => menu.classList.add('show'));
        menu.addEventListener('mouseleave', () => menu.classList.remove('show'));
    });
}

LoadBasicContent();

// ─── NAVBAR TOGGLE ────────────────────────────────────────────────────────────

const navItems  = document.getElementById('navbarDropdown');
const navToggle = document.getElementById('navbarToggle');
const modalBox  = document.getElementById('modal');

function ToggleNavbar() {
    navItems.classList.toggle('show');
}

document.addEventListener('click', (event) => {
    if (!navToggle.contains(event.target) && !navItems.contains(event.target)) {
        navItems.classList.remove('show');
        document.querySelectorAll('.dropdown_menu').forEach(m => m.classList.remove('show'));
    }
});

// ─── MODAL ────────────────────────────────────────────────────────────────────

function ModalOpen(title, text = 'Unexpected error occurred!', error) {
    modalBox.innerHTML = `
        <div class="modal-content" id="modal_content">
            <h4 class="modal_title">${title}</h4>
            <p class="modal_text">${text}</p>
            ${error ? `<p class="modal-error">${error}</p>` : ''}
            <div class="modal-footer">
                <button onclick="ModalClose()" class="modal-button">Ok</button>
            </div>
        </div>`;

    const content = document.getElementById('modal_content');
    setTimeout(() => {
        function outsideClick(e) {
            if (!content.contains(e.target)) {
                ModalClose();
                document.removeEventListener('click', outsideClick);
            }
            e.stopPropagation();
        }
        document.addEventListener('click', outsideClick);
    }, 1000);

    modalBox.style.display = 'block';
}

function ModalClose() {
    modalBox.style.display = 'none';
}

// ─── DARK MODE ────────────────────────────────────────────────────────────────

function DarkModeLoad() {
    PrefersDark = GetFromLocalStorage('PrefersDark');
    if (PrefersDark === undefined) {
        PrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
        SaveToLocalStorage('PrefersDark', PrefersDark);
    }
    if (!PrefersDark) {
        DarkReader.disable();
        document.getElementById('darkModeToggle').checked = false;
    } else {
        DarkReader.enable();
        document.getElementById('darkModeToggle').checked = true;
    }
}

DarkModeLoad();

function ToggleDarkMode() {
    if (DarkReader.isEnabled()) {
        DarkReader.disable();
        PrefersDark = false;
    } else {
        DarkReader.enable();
        PrefersDark = true;
    }
    SaveToLocalStorage('PrefersDark', PrefersDark);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function RemoveCss(item, type = 'display') {
    const css = item.style.cssText;
    const idx = css.indexOf(type);
    if (idx === -1) return;
    const end = css.indexOf(';', idx);
    item.style.cssText = css.slice(0, idx) + (end !== -1 ? css.slice(end + 1) : '');
}

function HideHtmlElement(id, time) {
    const el = document.getElementById(id);
    if (!el) return;
    const hide = () => el.style.cssText += 'display: none !important;';
    time ? setTimeout(hide, time) : hide();
}

function ScrollToTop()    { window.scrollTo({ top: 0,     behavior: 'smooth' }); }
function ScrollToBottom() { window.scrollTo({ top: 10000, behavior: 'smooth' }); }

// ─── DEVICE DETECTION ─────────────────────────────────────────────────────────

(() => {
    const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
    const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent);
    isPhone = isSmallScreen && isMobileUA;
    console.log(isPhone ? 'Mobile device detected.' : 'Desktop device detected.');
})();
