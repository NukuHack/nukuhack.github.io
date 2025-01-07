const body = document.querySelector("body");


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
              <p class="navbar_link" onclick="ChangePage()">Current Webpage</p>
              <button type="button" class="navbar_toggle" id="navbarToggle" onclick="ToggleNavbar()">
                <img src="./assets/menu_bars.png" alt="Menu" />
              </button>
              <div class="navbar_items" id="navbarDropdown">
                <ul class="navbar_ul">
                  <li class="navbar_li">
                    <p class="navbar_item" onclick="ChangePage('index')">Main Webpage</p>
                  </li>
                  <li class="navbar_li">
                    <p class="navbar_item" onclick="ChangePage('code')">Actual Code</p>
                  </li>
                  <li class="navbar_li">
                    <p class="navbar_item" onclick="ChangePage('extra')">Extra Things</p>
                  </li>
                  <li class="navbar_li">
                    <p class="navbar_item" onclick="ChangePage('links')">Links & Connection</p>
                  </li>
                  <li class="navbar_li">
                    <p class="navbar_item" onclick="ChangePage('video')">Video Display</p>
                  </li>
                </ul>
              </div>
                <div class="slider-container">
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
}


LoadBasicContent();

const navItems = document.getElementById("navbarDropdown");
const navToggle = document.getElementById("navbarToggle");

function ToggleNavbar() {
    if (navItems.classList.contains('show'))
        navItems.classList.remove('show');
    else
        navItems.classList.add('show');
}

// this closes the navbar if it is not clicked but open
document.addEventListener('click', function (event) {
    if (!navToggle.contains(event.target) && !navItems.contains(event.target))
        if (navToggle.classList.contains('show'))
            ToggleNavbar();
});

function ChangePage(url) {
    let UrlHelp = window.location.href;
    if (url)
        window.location.href = `${url}.html`;
    else if (UrlHelp.indexOf('#') == -1)
        window.location.href += '#';
    else
        window.location.href = window.location.href;
    // here the url can only be set after the last /
    // so I don't actually need to check for anything
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
    let PrefersDark = GetFromLocalStorage("PrefersDark");
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
        SaveToLocalStorage("PrefersDark", false);
    } else {
        DarkReader.enable();
        SaveToLocalStorage("PrefersDark", true);
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
