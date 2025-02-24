// DOM Elements
const codeOutput = document.getElementById('codes');
const modalBox = document.getElementById('modal');
const codePageDiv = document.getElementById('code_page');
const searchInput = document.getElementById('search_stuff');
const languageDropdown = document.getElementById('dropdown_language');
const languageDropdownButton = document.getElementById('dropdown_language_button');
const noResultsMessage = document.getElementById('search_no_result');
const searchTitleElement = document.getElementById('search_title');
const dropdownContent = document.getElementsByClassName('dropdown-content')[0];
const dropdownLangButton = document.getElementById("dropdown_language_button");

// Constants
const languageMapping = {
    csharp: "C#",
    javascript: "JavaScript",
    python: "Python",
    css: "CSS",
};

let data; // Main data storage
let selectedLanguage = "all";
let filteredByLanguage = [];
let searchedDescription = "all";
let filteredByDescription = [];
let supportedLanguages = [];
let invertedIndex = {}; // Inverted index for search

// Fetch JSON data
function fetchData(source) {
    fetch(source)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error status: ${response.status}`);
            }
            return response.json();
        })
        .then((jsonData) => {
            data = jsonData.data;
            initializeApplication();
        })
        .catch((error) => {
            console.error('JSON load error:', error);
        });
}

fetchData('./json/data.json');

// Initialize application
function initializeApplication() {
    displayData();
    extractSupportedLanguages();
    populateLanguageDropdown();

    buildInvertedIndex();
}

// Display data based on filters
function displayData() {
    codeOutput.innerHTML = '';
    const filteredData = data.filter(({ id, code }) => {
        const matchesLanguage = selectedLanguage === 'all' || filteredByLanguage.includes(id);
        const matchesDescription = searchedDescription === 'all' || filteredByDescription.includes(id);
        return matchesLanguage && matchesDescription && code !== 'none';
    });

    if (filteredData.length > 0) {
        noResultsMessage.style.display = "none";
        filteredData.forEach(({ id, lang, desc, code }) => {
            const codeHTML = generateCodeSnippet({ id, lang, desc, code });
            codeOutput.insertAdjacentHTML('beforeend', codeHTML);
            Prism.highlightElement(document.getElementById(`code_code_${id}`));
        });
    } else {
        noResultsMessage.style.display = "block";
    }
}

// Extract unique languages from data
function extractSupportedLanguages() {
    data.forEach(({ lang }) => {
        if (!supportedLanguages.includes(lang)) {
            supportedLanguages.push(lang);
        }
    });
}

// Populate language dropdown
function populateLanguageDropdown() {
    languageDropdownButton.innerText = "Select a language";
    supportedLanguages.forEach((lang) => {
        const dropdownItem = `
            <div class="dropdown-item" onclick="filterByLanguage('${lang}')">${languageMapping[lang] || capitalize(lang)}</div>
        `;
        languageDropdown.insertAdjacentHTML("beforeend", dropdownItem);
    });
}

// Capitalize first letter of a string
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Filter data by selected language
function filterByLanguage(language) {
    selectedLanguage = language;
    if (language !== "all") {
        filteredByLanguage = data.filter(({ lang }) => lang === language).map(({ id }) => id);
        languageDropdownButton.innerHTML = `Selected language: ${languageMapping[selectedLanguage]}`;
    } else {
        filteredByLanguage = [];
        languageDropdownButton.innerText = "Select a language";
    }
    displayData();
}

// Build inverted index for keyword-based search
function buildInvertedIndex() {
    data.forEach(({ id, keywords }) => {
        keywords.forEach((keyword) => {
            if (!invertedIndex[keyword]) {
                invertedIndex[keyword] = [];
            }
            invertedIndex[keyword].push(id);
        });
    });
}

// Search descriptions
function searchDescriptions(query) {
    const searchTerms = query.split(/\s+/).filter(term => term.length > 1);

    if (searchTerms.length < 1) {
        searchedDescription = "all";
        displayData();
        return;
    }

    searchedDescription = query;
    let results = [];

    searchTerms.forEach((term) => {
        const termResults = invertedIndex[term]
            ? invertedIndex[term]
            : Object.keys(invertedIndex)
                .filter(key => key.includes(term) || term.includes(key))
                .flatMap(key => invertedIndex[key]);

        if (results.length === 0) {
            results = [...termResults];
        } else {
            results = results.filter(id => termResults.includes(id));
        }
    });

    filteredByDescription = results;
    displayData();
}

// Handle input changes in search bar
let searchTimeout;
searchTitleElement.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    const query = this.value.toLowerCase().trim();
    searchTimeout = setTimeout(() => {
        searchDescriptions(query);
    }, 500);
});

// Generate HTML for a single code snippet (without help page)
function generateCodeSnippet({ id, lang, desc, code }) {
    const lines = code.split("\n").length;
    // TODO : make this actually change the width of the code ...
    //const width = Math.max(...code.split("\n").map(line => line.length));
    const leng = lines * 20;

    let CodeHTML = `<div class="code" id="code_${id}">`;
    CodeHTML += `<div class="code_lang" id="lang_${id}">`;
    CodeHTML += `Language: ${languageMapping[lang] || capitalize(lang)}`;
    CodeHTML += `</div>`;
    CodeHTML += `<div class="code_desc" id="desc_${id}">`;
    CodeHTML += `Description: ${desc}`;
    CodeHTML += `</div>`;

    CodeHTML += `<input type="button" class="code_resize" id="code_resize_${id}" 
        value="More about the code!" onClick="openCodePage(${id})">`;
    CodeHTML += `<p class="code_buttons">`;
    CodeHTML += `<input type="button" class="code_readonly" id="code_readonly_${id}" onclick="toggleEditable(${id})" value="Toggle Editable">`;
    CodeHTML += `<input type="button" class="code_reset" id="code_reset_${id}" onclick="resetCode(${id})" value="Reset the code">`;
    CodeHTML += `</p>`;
    CodeHTML += `<div class="code_help" id="code_help_${id}">`;
    CodeHTML +=
        `<pre class="line-numbers code_out" id="code_out_${id}" style="height: ${leng}px"><code class="language-${lang} code_code" id="code_code_${id}">${code}</code></pre>`;
    CodeHTML += `</div>`;
    CodeHTML += `<button onclick="copyCode(${id})" class="code_copy">Copy Code</button>`;
    CodeHTML += `</div>`;

    return CodeHTML;
}

// Generate HTML for a single code snippet (with help page)
function generateCodeHelpPage({ id, lang, desc, code }) {
    const lines = code.split("\n").length;
    // same to-do
    //const width = Math.max(...code.split("\n").map(line => line.length));
    const leng = lines * 20;

    let CodeHTML = `<div class="code_page" id="code_${id}_page">`;
    CodeHTML += `<div class="code_lang" id="lang_${id}">`;
    CodeHTML += `Language: ${languageMapping[lang] || capitalize(lang)}`;
    CodeHTML += `</div>`;
    CodeHTML += `<div class="code_desc" id="desc_${id}">`;
    CodeHTML += `Description: ${desc}`;
    CodeHTML += `</div>`;

    CodeHTML += `<input type="button" class="code_resize" id="code_resize_${id}_page" 
        value="Close this page" onClick="closeCodePage()">`;
    CodeHTML += `<p class="code_buttons_page">`;
    CodeHTML += `<input type="button" class="code_readonly" id="code_readonly_${id}_page" onclick="toggleEditable('${id}'+'_page')" value="Toggle Editable">`;
    CodeHTML += `<input type="button" class="code_reset" id="code_reset_${id}_page" onclick="resetCode('${id}'+'_page')" value="Reset the code">`;
    CodeHTML += `</p>`;
    CodeHTML += `<div class="code_help_page" id="code_help_${id}_page">`;
    CodeHTML +=
        `<pre class="line-numbers code_out" style="height: ${leng}px"><code class="language-${lang} code_code" id="code_code_${id}_page">${code}</code></pre>`;
    CodeHTML += `</div>`;
    CodeHTML += `<button onclick="copyCode('${id}'+'_page')" class="code_copy">Copy Code</button>`;
    CodeHTML += `</div>`;

    return CodeHTML;
}


// Copy code to clipboard
function copyCode(id) {
    const codeElement = document.getElementById(`code_code_${id}`);
    navigator.clipboard.writeText(codeElement.textContent)
        .then(() => {
            ModalOpen('Copy Success', 'Code copied to clipboard!');
        })
        .catch((error) => {
            ModalOpen('Copy Error', `Failed to copy: ${error.message}`);
        });
}

// Toggle contenteditable attribute
function toggleEditable(id) {
    const codeElement = document.getElementById(`code_code_${id}`);
    const button = document.querySelector(`#code_${id} .code_readonly`);

    if (codeElement.contentEditable === "true") {
        codeElement.contentEditable = "false";
        button.value = "Toggle Editable";
    } else {
        codeElement.contentEditable = "true";
        button.value = "Make Read-Only";
    }
}

// Reset code to original content
function resetCode(id) {
    const codeElement = document.getElementById(`code_code_${id}`);
    id = parseInt(id);
    const item = data.find(item => item.id === id);

    if (item) {
        codeElement.textContent = item.code;
        Prism.highlightElement(codeElement);
    }
}

// Open code page
function openCodePage(id) {
    const result = displaySingleCode(id);
    if (result) {
        codePageDiv.style.display = "block";
        ScrollToTop();
        document.body.style.overflow = "hidden";
    } else {
        ModalOpen('Display Error', `No data found for ID: ${id}`);
    }
}

// Close code page
function closeCodePage() {
    codePageDiv.style.display = "none";
    document.body.style.overflow = "";
}

// Display single code on a dedicated page
function displaySingleCode(id) {
    const item = data.find(item => item.id === id);
    if (item && item.code !== "none") {
        codePageDiv.innerHTML = generateCodeHelpPage(item);
        Prism.highlightElement(document.getElementById(`code_code_${id}_page`));
        return true;
    }
    return false;
}


// Toggle language dropdown
function toggleLanguageDropdown() {
    dropdownContent.classList.toggle('show');
}

document.addEventListener('click', (event) => {
    if (!dropdownLangButton.contains(event.target)) {
        dropdownContent.classList.remove('show');
    }
});

function PhoneCssHelp() {
    ModalOpen('Css stuff', 'The codes in phone version are not displayed,\nYou have to go and open the page about the code to view it.');
    HideHtmlElement('codes_helper');
}



