const body = document.querySelector("body");
const Url = window.location.href;
let isPhone = false;
let PrefersDark = true;
const urlImportant = Url.slice(Url.lastIndexOf('/')+1);
const currentUrl = urlImportant.slice(0,urlImportant.indexOf("."));
if (currentUrl==="") window.location.href="index.html";
const PageHelper = ((url)=>{
    if (url!=="index") return url.slice(0,1).toUpperCase() + url.slice(1);
    else return "Main";
});

/*
let url = window.location.href;
url = url.slice(url.lastIndexOf("/") + 1);
// only needed if you use it with an editor like webstorm (like me)
if (url.indexOf("?") != -1) url = url.slice(0, url.indexOf("?"));

console.log("current page url: ", url);
console.log("basic url: ", window.location.href);
*/
function LoadBasicContent() {
    let navContent = `
        <nav class="navbar" id="navbar">
            <div class="navbar_in">
                <p class="navbar_link" onclick="ChangePage()">${PageHelper(currentUrl)} Page</p>
                <button type="button" class="navbar_toggle" id="navbarToggle" onclick="ToggleNavbar()">
                    <img id="menu_image" src="./assets/menu_bars.png" alt="Menu" />
                </button>
                <div class="navbar_items" id="navbarDropdown">
                    <ul class="navbar_ul">
                        <li class="navbar_li">
                            <p class="navbar_item" onclick="ChangePage('index')">Main Webpage</p>
                        </li>
                        <li class="navbar_li">
                            <p class="navbar_item" onclick="ChangePage('code')">Actual Code</p>
                        </li>
                        <li class="navbar_li dropdown">
                            <p class="navbar_item">Animations</p>
                            <ul class="dropdown_menu">
                                <li><p class="dropdown_item" onclick="ChangePage('animation')">Animation Page</p></li>
                                <li><p class="dropdown_item" onclick="ChangePage('dice')">Dice Page</p></li>
                                <li><p class="dropdown_item" onclick="ChangePage('test3d')">3D Test Page</p></li>
                            </ul>
                        </li>
                        <li class="navbar_li dropdown">
                            <p class="navbar_item">Random Things</p>
                            <ul class="dropdown_menu">
                                <li><p class="dropdown_item" onclick="ChangePage('extra')">Extra</p></li>
                                <li><p class="dropdown_item" onclick="ChangePage('links')">Links</p></li>
                            </ul>
                        </li>
                        <li class="navbar_li dropdown">
                            <p class="navbar_item">Small Apps</p>
                            <ul class="dropdown_menu">
                                <li><p class="dropdown_item" onclick="ChangePage('weather')">Weather</p></li>
                                <li><p class="dropdown_item" onclick="ChangePage('video')">Video</p></li>
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

        <div id="navbarHelp">
            .
        </div>
    `;

    let modalContent = `
        <div id="modal" class="modal">
        </div>
    `;

    let footerContent = `
        <div id="footerHelp">
            .
        </div>
        <footer id="footer">
            <div class="footer_in">
                <div class="footer_in_in">
                    <h5>Stupid webpage</h5>
                    <h6>Made by NukuHack ©2024</h6>
                </div>
            </div>
        </footer>
    `;

    body.insertAdjacentHTML("afterbegin", navContent);
    body.insertAdjacentHTML("beforeend", modalContent);
    body.insertAdjacentHTML("beforeend", footerContent);

    document.getElementById("menu_image").onerror = function () {
        this.src = '../assets/menu_bars.png';
    };

    // Add hover functionality for dropdowns
    const dropdowns = document.querySelectorAll('.dropdown');

    dropdowns.forEach(dropdown => {
        const dropdownMenu = dropdown.querySelector('.dropdown_menu');

        // Show dropdown on mouseenter
        dropdown.addEventListener('mouseenter', () => {
            // Hide all other dropdown menus
            dropdowns.forEach(otherDropdown => {
                if (otherDropdown !== dropdown) {
                    const otherDropdownMenu = otherDropdown.querySelector('.dropdown_menu');
                    if (otherDropdownMenu) {
                        otherDropdownMenu.classList.remove('show');
                    }
                }
            });

            // Show the current dropdown menu
            dropdownMenu.classList.add('show');
        });

        // Prevent dropdown from closing when interacting with it
        dropdownMenu.addEventListener('mouseenter', () => {
            dropdownMenu.classList.add('show');
        });

        dropdownMenu.addEventListener('mouseleave', () => {
            dropdownMenu.classList.remove('show');
        });
    });
}

LoadBasicContent();

const navItems = document.getElementById("navbarDropdown");
const navToggle = document.getElementById("navbarToggle");

// Toggle Navbar
function ToggleNavbar() {
    navItems.classList.toggle('show');
}

// Close Navbar when clicking outside
function HandleDocumentClick(event) {
    if (!navToggle.contains(event.target)&&!navItems.contains(event.target)) {
        navItems.classList.remove('show');

        const dropdowns = document.querySelectorAll('.dropdown');

        dropdowns.forEach(dropdown => {
            const dropdownMenu = dropdown.querySelector('.dropdown_menu');
            // Show dropdown on mouseenter
            dropdownMenu.classList.remove('show');
        });
    }
}

document.addEventListener('click', HandleDocumentClick);




function ChangePage(url,isInFolder) {
    let UrlHelp;
    isInFolder=isInsideFolder();
    if (isInFolder) UrlHelp="../";
    else UrlHelp="";

    if (url)
        UrlHelp += `${url}.html`;
    else if (UrlHelp.indexOf('#') === -1)
        UrlHelp += '#';
    else
        UrlHelp = window.location.href;
    // here the url can only be set after the last /
    // so I don't actually need to check for anything
    console.log(UrlHelp);
    window.location.href = UrlHelp;
}
function isInsideFolder() {
    // Get the current URL
    let currentUrl = window.location.href;
    let path;
    // Extract the path part of the URL (everything after the domain)
    if (!currentUrl.includes("localhost"))
        path = new URL(currentUrl).pathname;
    else
        path = currentUrl.slice("http://localhost:63342/".length)

    // Check if the path contains more than one segment (i.e., contains a folder)
    // For example, "/resources/index" has two segments: "resources" and "index"
    console.log(path);
    let stuff = path.split('/');
    if (stuff[0].includes("localhost"))
        // for testing in localhost ... yeah ....
        return stuff.length > 4;
    else
        return stuff.length > 2;

}

function RemoveCss(item, type) {
    let CssT = item.style.cssText;
    let TypePlace = CssT.indexOf(`${type}`);
    // counting the length between the start and the start of the type
    let TypeStart = CssT.slice(0, TypePlace).length;
    item.style.cssText = CssT.replace(CssT.slice(TypePlace, TypeStart + CssT.slice(TypePlace).indexOf(';')), '');
}

function ModalOpen(title, text, error) {
    let ModalHelp = `
        <div class="modal-content" id="modal_content">
            <h4 class="modal_title">${title}</h4>
            <p class="modal_text">${text}</p>
            ${!error ? "" : `<p class="modal-error">${error}</p>`}
            <div class="modal-footer">
                <button onClick="ModalClose()" class="modal-button">Ok</button>
            </div>
        </div>
    `;
    modalBox.innerHTML = ModalHelp;


    let ModalContent = document.getElementById("modal_content");

    // Add an event listener to handle outside clicks
    setTimeout(() => {
        document.addEventListener('click', handleOutsideModalClick);
    }, 1000)

    function handleOutsideModalClick(event) {
        if (!ModalContent.contains(event.target)) {
            ModalClose();
            document.removeEventListener('click', handleOutsideModalClick);
        }
        event.stopPropagation();
    }

    modalBox.style.display = "block";
}


function ModalClose() {
    modalBox.style.display = "none";
}

function DarkModeLoad() {
    PrefersDark = GetFromLocalStorage("PrefersDark");
    if (PrefersDark===undefined){
        PrefersDark= window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        SaveToLocalStorage("PrefersDark", PrefersDark);
    }

    if (!PrefersDark) {
        DarkReader.disable();
        document.getElementById("darkModeToggle").checked = false;
    } else {
        DarkReader.enable();
        document.getElementById("darkModeToggle").checked = true;
    }
}

// Set initial Dark Mode state
DarkModeLoad();

// Dark Mode Toggle Function
function ToggleDarkMode() {
    if (DarkReader.isEnabled()) {
        DarkReader.disable()
        PrefersDark = false;
        SaveToLocalStorage("PrefersDark", PrefersDark);
    } else {
        DarkReader.enable();
        PrefersDark = true;
        SaveToLocalStorage("PrefersDark", PrefersDark);
    }
}

function SaveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function GetFromLocalStorage(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : undefined;
    } catch (error) {
        console.error('Error retrieving from localStorage:', error);
    }
}

function ScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function ScrollToBottom() {
    window.scrollTo({ top: 10000, behavior: 'smooth' });
}




function HideHtmlElement(id, time) {
    const element = document.getElementById(id);
    if (time)
        setTimeout(() => {
            element.style.cssText += "display: none !important;";
        }, time)
    else {
        element.style.cssText += "display: none !important;";
    }
}


(() => {
    const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
    const isMobileUA = /iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent);
    isPhone = isSmallScreen && isMobileUA;

    if (isPhone) {
        console.log("User is likely on a mobile device.");
    } else {
        console.log("User is not on a mobile device.");
    }
})();