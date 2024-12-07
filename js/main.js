

const body = document.querySelector("body");

function LoadNavbar() {


    let navContent = `
<nav class="navbar" id="navbar">
    <div class="navbar_in">
        <a class="navbar_link" href="#">Current Webpage</a>
        <button type="button" class="navbar_toggle" id="navbarToggle">
            <img src="./assets/menu_bars.png" alt="Menu" />
        </button>
        <div class="navbar_items" id="navbarDropdown">
            <ul class="navbar_ul">
                <li class="navbar_li">
                    <a class="navbar_item" href="./index.html">Main Webpage</a>
                </li>
                <li class="navbar_li">
                    <a class="navbar_item" href="./code.html">Actual Code</a>
                </li>
            </ul>
        </div>
    </div>
</nav>

    
    <div id="navbarHelp">
        .
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
                <h6>Made by NukuHack</h6>
            </div>
        </div>
    </footer>
    `;

    body.insertAdjacentHTML("afterbegin",navContent);
    body.insertAdjacentHTML("beforeend",footerContent);
}

LoadNavbar();


const toggle = document.getElementById("navbarToggle");
const items = document.getElementById("navbarDropdown");
items.style.display = "none";

// for the header
document.addEventListener("DOMContentLoaded", function () {

    toggle.addEventListener("click", function () {
        if (items.style.display === "block")
            items.style.display = "none";
        else
            items.style.display = "block";

    });
});