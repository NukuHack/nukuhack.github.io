

const body = document.querySelector("body");

body.insertAdjacentHTML('afterbegin',`
    <div id="modal" class="modal" style="display: none;">
        
    </div>
`);

function LoadBasicConetent() {


    let navContent = `
        <nav class="navbar" id="navbar">
            <div class="navbar_in">
                <p class="navbar_link" onclick="ChangePage()">Current Webpage</p>
                <button type="button" class="navbar_toggle" id="navbarToggle">
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




LoadBasicConetent();





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






let url = window.location.href;
url = url.slice(url.lastIndexOf("/") + 1);
// only needed if you use it with an editor like webstorm (like me)
if (url.indexOf("?") != -1) url = url.slice(0, url.indexOf("?"));

console.log("current page url: ",url);


function ChangePage(url){
    let urlHelp = window.location.href;
    if(url)
        window.location.href=`${url}.html`;
    else
        if(urlHelp.indexOf('#')==-1)
            window.location.href+='#';
        else
            window.location.href=window.location.href;
}

