const codeOutput = document.getElementById('codes');
const modalBox = document.getElementById('modal');
const pageDiv = document.getElementById('code_page');
const searchStuff = document.getElementById('search_stuff');
const languageDropdown = document.getElementById('dropdown_language');
const languageDropdownButton = document.getElementById('dropdown_language_button');
const searchNoResult = document.getElementById('search_no_result');
const searchTitle = document.getElementById('search_title');
const True = false;
const langHelp = {
    "csharp": "C#",
    "javascript": "JavaScript",
    "python": "Python",
    "css": "CSS",
};

let Data; // the main data storage ... yeah
let SelectedLanguage = "all";
let SelectedByLanguage = [];
let SearchedDescription = "all";
let SearchedByDescription = [];
let codeLangTypes = [];
let Index = {}; // Inverted index

// just the json fetch
function FetchData(from) {
    fetch(from)
        .then((res) => {
            if (!res.ok) {
                throw new Error
                (`HTTP error status: ${res.status}`);
            }
            return res.json();
        })
        .then((Re_Help) => {
            Data = Re_Help.data;
            //console.log(Data);
            Start_Everything();
        })
        .catch((error) => {
            console.error('Json load error:', error)
        });
}

FetchData('./json/data.json');

function Start_Everything() {
    DisplayData();
    Data.forEach(({lang}) => {
        if (!codeLangTypes.includes(lang))
            codeLangTypes.push(lang);
    });
    DropDownLanguage();

    Data.forEach(({id, keywords}) => {
        keywords.forEach(keyword => {
            if (!Index[keyword]) Index[keyword] = [];
            Index[keyword].push(id);
        });
    });
}

//console.log("I love bread");

function GenerateCodeHTML({id, lang, desc, code}, help = undefined) {
    const len = CountB_in_A(code, "\n");
    const wid = LongestSubstring(code, "\n");
    const Leng = len * 18 + 40;

    let CodeHelp = "";

    if (!help) {
        CodeHelp += `<div class="code" id="code_${id}">`;
    } else {
        CodeHelp += `<div class="code_page" id="code_${id}_page">`;
    }
    CodeHelp += `<div class="code_lang" id="lang_${id}">`;
    CodeHelp += `Language: ${langHelp[lang] || lang.slice(0, 1).toUpperCase() + lang.slice(1)}`;
    CodeHelp += `</div>`;

    CodeHelp += `<div class="code_desc" id="desc_${id}">`;
    CodeHelp += `Description: ${desc}`;
    CodeHelp += `</div>`;


    if (!help) {
        CodeHelp += `<input type="button" class="code_resize" id="code_resize_${id}" 
            value="More about the code!" onClick="CodePageOpen(${id})">`;
        CodeHelp += `<p class="code_buttons">`;
        CodeHelp += `<input type="button" class="code_readonly" id="code_readonly_${id}" onclick="ChangeReadonly(${id})" value="Change from readonly">`;
        CodeHelp += `<input type="button" class="code_reset" id="code_reset_${id}" onclick="CodeReset(${id})" value="Reset the code">`;
        CodeHelp += `</p>`;

        CodeHelp += `<div class="code_help" id="code_help_${id}">`;

        // Add the HTML structure for code display
        CodeHelp +=
            `<pre class="line-numbers code_out" id="code_out_${id}" style="height: ${Leng}px"><code class="language-${lang} code_code" id="code_code_${id}">${code}</code></pre>`;

    } else {
        CodeHelp += `<input type="button" class="code_resize" id="code_resize_${id}_page" 
            value="Close this page" onClick="CodePageClose(${id})">`;
        CodeHelp += `<p class="code_buttons_page">`;
        CodeHelp += `<input type="button" class="code_readonly" id="code_readonly_${id}_page" onclick="ChangeReadonly(${id},'yeah')" value="Change from readonly">`;
        CodeHelp += `<input type="button" class="code_reset" id="code_reset_${id}_page" onclick="CodeReset(${id},'yeah')" value="Reset the code">`;
        CodeHelp += `</p>`;

        CodeHelp += `<div class="code_help_page" id="code_help_${id}_page">`;

        CodeHelp +=
            `<pre class="line-numbers code_out" style="height: ${Leng}px"><code class="language-${lang} code_code" id="code_code_${id}_page">${code}</code></pre>`;

    }

    CodeHelp += `</div>`;
    CodeHelp += `<button onclick="CopyCode(${id})" class="code_copy">Copy Code</button>`;
    CodeHelp += `</div>`;


    return CodeHelp;
}

//TODO : limit the display to like 20 things (or less) and only ever show that much
// (and probably a next page stuff so new stuff and al ot more ...)


function DisplayData() {
    codeOutput.innerHTML = '';
    const filteredData =
        Data.filter(({id, lang, desc, code}) => {
            const matchesLang = SelectedLanguage === 'all' || SelectedByLanguage.includes(id);
            const matchesDesc = SearchedDescription === 'all' || SearchedByDescription.includes(id);
            return matchesLang && matchesDesc && code !== 'none';
        }).map(({id}) => id);
    if (filteredData.length > 0) {
        searchNoResult.style.display = "none";
        Data.forEach(({id, lang, desc, code}) => {
            if (filteredData.includes(id)) {
                const CodeHTML = GenerateCodeHTML({id, lang, desc, code});
                //const CodeHTML = id+"<br>"; //just replacing it to make it quicker
                codeOutput.insertAdjacentHTML('beforeend', CodeHTML);
                Prism.highlightElement(document.getElementById(`code_code_${id}`));
            }
        });
    } else {
        searchNoResult.style.display = "block";
    }

}

function DataById(id) {
    // Find the specific data by the id
    const dataItem = Data.find(item => item.id === id);

    // If the item exists and its code is not "none"
    if (dataItem && dataItem.code !== "none") {
        // Generate the HTML for this piece of data
        const CodeHTML = GenerateCodeHTML(dataItem, "page");
        pageDiv.insertAdjacentHTML("afterbegin", CodeHTML);
        Prism.highlightElement(document.getElementById(`code_code_${id}_page`));
        return "no error";
    } else {
        ModalOpen("something error");
        return null;
    }
}


function DropDownLanguage() {
    // Iterate over the data to generate the HTML
    languageDropdownButton.innerText = "Select a language";
    codeLangTypes.forEach((lang) => {
        let DropdownHelp =
            `<button class="dropdown-item" onClick="SelectByLanguage('${lang}')">${langHelp[lang]}</button>`;
        languageDropdown.insertAdjacentHTML("beforeend", DropdownHelp);
    });
}


function SelectByLanguage(language) {
    SelectedLanguage = language;
    //console.log(language)
    codeOutput.innerHTML = "";
    if (language !== "all") {
        SelectedByLanguage = Data.filter(({lang}) => lang === language).map(({id}) => id);
        languageDropdownButton.innerHTML = "Selected language: " + langHelp[SelectedLanguage];
        //console.log(Selected);
    } else {
        SelectedByLanguage = [];
        languageDropdownButton.innerText = "Select a language";
    }

    DisplayData();
}



let InputTimer;
searchTitle.addEventListener("input", function () {
    clearTimeout(InputTimer);
    let searchHelp=this.value.toLowerCase().trim();
    InputTimer = setTimeout(() => {
        SearchDescription(searchHelp);
    }, 500);
});
searchTitle.addEventListener("change", function () {
    clearTimeout(InputTimer);
    let searchHelp=this.value.toLowerCase().trim();
        SearchDescription(searchHelp);
});


function SearchDescription(query) {
    //console.log(query);
    const SearchTerms = query.split(/\s+/).filter(term => term.length > 1);
    //console.log(SearchTerms);
    if (SearchTerms.length < 1) {
        SearchedDescription = "all";
        DisplayData();
        return;
    }

    SearchedDescription = query;
    // Split by spaces into an array of words
    // decided to add a filter too, so if we want the user not to be able to input a single letter then we can do that too
    //console.log("SearchTerms", SearchTerms);

    // This will hold the final result (IDs that match all search terms)
    let Results = [];

    // Go through each search term and collect records containing any of the terms
    SearchTerms.forEach(term => {
        if (Index[term]) {
            // Exact match found in the Index
            termResults = Index[term];
        } else {
            // If no exact match, look for partial matches
            termResults = Object.keys(Index)
                .filter(key => key.includes(term) || term.includes(key)) // Reverse partial match
                .flatMap(key => Index[key]); // Combine IDs from all matching keys
        }

        // If Results is empty, we initialize it with the first term's results
        if (Results.length === 0) {
            Results = [...termResults];
        } else {
            // If Results is not empty, filter out IDs that don't contain the current term
            Results = Results.filter(id => termResults.includes(id));
        }
    });
    //console.log(Results);
    SearchedByDescription=Results;

    /*
    // Ensure that results show only records that match *all* search terms
    // Additionally, implement partial matching for keywords
    SearchedByDescription = Results.filter(id => {
        const recordKeywords = Data.find(item => item.id === id).keywords;
        console.log(recordKeywords);
        return SearchTerms.every(term => {
            return recordKeywords.some(keyword => keyword.includes(term)); // Partial match
        });
    });
    */
    DisplayData();
}


function CopyCode(id, helper) {
    const TextToCopy = document.getElementById(`code_code_${helper ? id + "_page" : id}`).innerText;
    CopyText(TextToCopy);
}

function CopyText(text) {
    // Check if the Clipboard API is available
    if (navigator.clipboard) {
        if (!text)
            ModalOpen('Copy Error', 'Failed to copy:', "Nothing to copy");
        else {
            navigator.clipboard.writeText(text)
                .then(() => {
                    ModalOpen('Copy Success', 'Code copied to clipboard!');
                })
                .catch((error) => {
                    ModalOpen('Copy Error', 'Failed to copy:', error);
                });
        }
    } else {
        ModalOpen('Browser Error', 'Failed to copy:', 'Your browser does not support the Clipboard API.\n(Or the web hosting server)');
    }
}


function ChangeReadonly(id, helper) {
    let ReadonlyButton = document.getElementById(`code_readonly_${helper ? id + "_page" : id}`);
    let ToChange = document.getElementById(`code_code_${helper ? id + "_page" : id}`);
    let ChangeHelper = document.getElementById(`code_help_${helper ? id + "_page" : id}`);
    //console.log(`code_code_${helper?id+"_page":id}`);
    if (ToChange.contentEditable !== "true") {
        ToChange.contentEditable = "true";
        ReadonlyButton.value = "Change to Readonly";
        //toChange.style.backgroundColor = "dodgerblue";
        ChangeHelper.style.cursor = "text";
    } else {
        ToChange.contentEditable = "false";
        ReadonlyButton.value = "Change from Readonly";
        //RemoveCss(toChange, 'background-color');
        RemoveCss(ChangeHelper, 'cursor');
    }

}

function CodeReset(id, helper) {
    const ToReset = document.getElementById(`code_code_${helper ? id + "_page" : id}`);
    const ResetButton = document.getElementById(`code_reset_${helper ? id + "_page" : id}`);
    ToReset.textContent = `${Data[id].code}`;
    // if text is changed prism highlight will break, so I send it to rescan the new content
    Prism.highlightElement(ToReset);

    setTimeout(() => {
        ResetButton.value = "Resetting code..";
    }, 180);
    setTimeout(() => {
        ResetButton.value = "Resetting code...";
    }, 350);
    setTimeout((ogValue, ogOnclick) => {
        ResetButton.value = ogValue; // Reset everything after half second
        ResetButton.onclick = ogOnclick;
    }, 500, ResetButton.value, ResetButton.onclick);

    ResetButton.value = "Resetting code."; // Change the button value
    ResetButton.onclick = null;
}

function CodePageOpen(id) {
    ScrollToTop();
    const DisplayRun = DataById(id);
    if (DisplayRun) {
        //console.log("single page open");
        pageDiv.style.display = "block";
        document.body.style.overflow = 'hidden';

        const PageContent = document.getElementById(`code_${id}_page`);

        setTimeout(() => {
            document.addEventListener('click', handleOutsidePageClick);
        }, 1000)

        function handleOutsidePageClick(event) {
            if (!PageContent.contains(event.target)) {
                CodePageClose();
                document.removeEventListener('click', handleOutsidePageClick);
            }
            event.stopPropagation();
        }

        PageContent.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the click from reaching the document
        });
    } else
        ModalOpen('Display Error', `No data found for id: ${id} or there is no code for it`);

}

function CodePageClose() {
    //console.log("single page close");
    pageDiv.style.display = "none";
    document.body.style.overflow = '';
}


function OpenDropdown(dropdownContent, dropdownButton) {
    dropdownContent.classList.add('show');

    // Add an event listener to handle outside clicks
    setTimeout(() => {
        document.addEventListener('click', handleOutsideDropdownClick);
        // did you know that if you set the SetTimout to 0 (what should mean it's 0 millisecond) even then it's not instant and in This case it would work perfectly
        // ... but I set it to 10 if something is slow ...
    }, 10)

    // TODO : make the click not go "down" to the next layer
    function handleOutsideDropdownClick(event) {
        if (!dropdownContent.contains(event.target) && !dropdownButton.contains(event.target)) {
            CloseDropdown(dropdownContent);
            document.removeEventListener('click', handleOutsideDropdownClick);
        }
        event.stopPropagation();
    }
}

function CloseDropdown(dropdownContent) {
    dropdownContent.classList.remove('show');
}

function ToggleDropdown() {
    const dropdownContent = document.getElementById(`dropdown_language`);
    const dropdownButton = document.getElementById(`dropdown_language_button`);
    // Check if the dropdown is already open
    const isOpen = dropdownContent.classList.contains('show');

    if (isOpen) {
        CloseDropdown(dropdownContent);
    } else {
        OpenDropdown(dropdownContent, dropdownButton);
    }
}

function PhoneCssHelp() {
    ModalOpen('Css stuff', 'The codes in phone version are not displayed, you have to go open the page about the code to view it.');
    HideHtmlElement('codes_helper');
}



