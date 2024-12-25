const CodeOutput = document.getElementById('codes');
const Modal = document.getElementById('modal');
const Page = document.getElementById('code_page');
const Dropdowns = document.getElementById('dropdowns');
const True = false;
let Data; // the main data storage ... yeah

const langHelp = {
    "csharp": "C#",
    "javascript": "JavaScript",
    "python": "Python",
    "css": "CSS",
};


// just the json fetch
function fetchData() {
    fetch('./json/data.json')
        .then((res) => {
            if (!res.ok) {
                throw new Error
                (`HTTP error status: ${res.status}`);
            }
            return res.json();
        })
        .then((amabatukam) => {
            Data = amabatukam.data;
            //console.log(Data);
            Start_Everything();
        })
        .catch((error) => {
            console.error('Json load error:', error)
        });
}

fetchData();

function Start_Everything() {
    DisplayAllData();
    DropDownLanguage();
}

//console.log("I love bread");

const generateCodeHTML = ({id, lang, desc, code},help) => {
    if(!help){
        let len = CountB_in_A(code, "\n");
        let wid = LongestSubstring(code, "\n");

        let CodeHelp = "";
        CodeHelp += `<div class="code" id="code_${id}">`;

        CodeHelp += `<div class="code_lang" id="lang_${id}">`;
        CodeHelp += `Language: ${langHelp[lang] || lang.slice(0, 1).toUpperCase() + lang.slice(1)}`;
        CodeHelp += `</div>`;

        CodeHelp += `<div class="code_desc" id="desc_${id}">`;
        CodeHelp += `Description: ${desc}`;
        CodeHelp += `</div>`;

        CodeHelp += `<input type="button" class="code_resize" id="code_resize_${id}" 
            value="More about the code!" onClick="CodePageOpen(${id})">`;
        CodeHelp += `<p class="code_buttons">`;
        CodeHelp += `<input type="button" class="code_readonly" id="code_readonly_${id}" onclick="ChangeReadonly(${id})" value="Change from readonly">`;
        CodeHelp += `<input type="button" class="code_reset" id="code_reset_${id}" onclick="CodeReset(${id})" value="Reset the code">`;
        CodeHelp += `</p>`;

        CodeHelp += `<div class="code_help" id="code_help_${id}">`;

        // Add the HTML structure for code display
        CodeHelp +=
            `<pre class="line-numbers code_out" id="code_out_${id}" style="height: ${len * 20 + len / 2}px"><code class="language-${lang} code_code" id="code_code_${id}">${code}</code></pre>`;

        CodeHelp += `</div>`;

        CodeHelp += `<button onclick="CopyCode(${id})" class="code_copy">Copy Code</button>`;

        CodeHelp += `</div>`;

        return CodeHelp;
    }
    else{
        let len = CountB_in_A(code, "\n");
        let wid = LongestSubstring(code, "\n");

        let CodeHelp = "";
        CodeHelp += `<div class="code_page" id="code_${id}_page">`;

        CodeHelp += `<div class="code_lang_page" id="lang_${id}_page">`;
        CodeHelp += `Language: ${langHelp[lang] || lang.slice(0, 1).toUpperCase() + lang.slice(1)}`;
        CodeHelp += `</div>`;

        CodeHelp += `<div class="code_desc_page" id="desc_${id}_page">`;
        CodeHelp += `Description: ${desc}`;
        CodeHelp += `</div>`;

        CodeHelp += `<input type="button" class="code_resize_page" id="code_resize_${id}_page" 
            value="Close this page." onClick="CodePageClose(${id})">`;
        CodeHelp += `<p class="code_buttons_page">`;
        CodeHelp += `<input type="button" class="code_readonly_page" id="code_readonly_${id}_page" onclick="ChangeReadonly(${id},'yeah')" value="Change from readonly">`;
        CodeHelp += `<input type="button" class="code_reset_page" id="code_reset_${id}_page" onclick="CodeReset(${id},'yeah')" value="Reset the code">`;
        CodeHelp += `</p>`;

        CodeHelp += `<div class="code_help_page" id="code_help_${id}_page">`;

        // Add the HTML structure for code display
        CodeHelp +=
            `<pre class="line-numbers code_out_page" id="code_out_${id}_page" style="height: ${len * 20 + len / 2}px"><code class="language-${lang} code_code_page" id="code_code_${id}_page">${code}</code></pre>`;

        CodeHelp += `</div>`;

        CodeHelp += `<button onclick="CopyCode(${id},'yeah')" class="code_copy_page">Copy Code</button>`;

        CodeHelp += `</div>`;

        return CodeHelp;
    }
};



function DisplayAllData(Selected) {
    CodeOutput.innerHTML="";
    Data.forEach(({ id, lang, desc, code }) => {
        if ((!Selected||Selected?.includes(id)) && code !== "none") {
            let codeHTML = generateCodeHTML({ id, lang, desc, code });
            CodeOutput.insertAdjacentHTML('beforeend', codeHTML);
            Prism.highlightElement(document.getElementById(`code_code_${id}`));
        }
    });

}

function DataById(id) {
    // Find the specific data by the id
    const dataItem = Data.find(item => item.id === id);

    // If the item exists and its code is not "none"
    if (dataItem && dataItem.code !== "none") {
        // Generate the HTML for this piece of data
        let codeHTML = generateCodeHTML(dataItem,"page");
        Page.innerHTML = codeHTML;
        Prism.highlightElement(document.getElementById(`code_code_${id}_page`));
        return "no error";
    } else {
        console.log("something error");
        return null;
    }
}


function DropDownLanguage() {
    let dropdown_language = document.getElementById('dropdown_language');

    let dropdown_language_options = Data.map(({lang, code}) => {
        return code !== "none" ? lang : null;
    }).filter(lang => lang !== null);
    //console.log(dropdown_language_options);

    // Iterate over the data to generate the HTML
    dropdown_language_options.forEach((lang) => {
        let dropdownHelp =
            `<button class="dropdown-item" onClick="selectStuff('${lang}')">${langHelp[lang]}</button>`;
        dropdown_language.insertAdjacentHTML("beforeend", dropdownHelp);
    });
}


function selectStuff(language) {
    //console.log(language)
    CodeOutput.innerHTML = "";
    if (language !== "all") {
        let dataToDisplay = Data.filter(({lang}) => lang === language);
        let Selected = dataToDisplay.map(({id}) => id);
        //console.log(Selected);
        DisplayAllData(Selected);
    } else
        DisplayAllData();
}


function CopyCode(id,helper) {
    // Check if the Clipboard API is available
    if (navigator.clipboard) {
        // Get the text to copy
        let textToCopy = document.getElementById(`code_code_${helper?id+"_page":id}`).innerText;
        //console.log(`code_code_${helper?id+"_page":id}`);
        if (!textToCopy) {
            modalOpen('Copy Error', 'Failed to copy:', "text to copy is null")
        } else {
            // Write the text to the clipboard
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    // Display a message if the text was copied successfully
                    modalOpen('Copy Success', 'Code copied to clipboard!');
                })
                .catch((error) => {
                    // Display an error message if there is an issue copying the text
                    modalOpen('Copy Error', 'Failed to copy:', error);
                });
        }
    } else {
        // If the Clipboard API is not available, display an error message
        modalOpen('Browser Error', 'Failed to copy:', 'Your browser does not support the Clipboard API.\nOr the web hosting server.');
    }
}


function ChangeReadonly(id, helper) {
    let readonlyButton = document.getElementById(`code_readonly_${helper?id+"_page":id}`);
    let toChange = document.getElementById(`code_code_${helper?id+"_page":id}`);
    let helpChange = document.getElementById(`code_help_${helper?id+"_page":id}`);
    console.log(`code_code_${helper?id+"_page":id}`);
    if (toChange.contentEditable !== "true") {
        toChange.contentEditable = "true";
        readonlyButton.value = "Change to Readonly";
        //toChange.style.backgroundColor = "dodgerblue";
        helpChange.style.cursor = "text";
    } else {
        toChange.contentEditable = "false";
        readonlyButton.value = "Change from Readonly";
        //RemoveCss(toChange, 'background-color');
        RemoveCss(helpChange, 'cursor');
    }

}

function CodeReset(id,helper) {
    let toReset = document.getElementById(`code_code_${helper?id+"_page":id}`);
    let resetButton = document.getElementById(`code_reset_${helper?id+"_page":id}`);
    toReset.textContent = `${Data[id].code}`;
    // if text is changed prism highlight will break, so I send it to rescan the new content
    Prism.highlightElement(toReset);

    setTimeout(() => {
        resetButton.value = "Resetting code..";
    }, 180);
    setTimeout(() => {
        resetButton.value = "Resetting code...";
    }, 350);
    setTimeout((ogValue, ogOnclick) => {
        resetButton.value = ogValue; // Reset everything after half second
        resetButton.onclick = ogOnclick;
    }, 500, resetButton.value, resetButton.onclick);

    resetButton.value = "Resetting code."; // Change the button value
    resetButton.onclick = null;
}

function CodePageOpen(id) {
        let displayRun = DataById(id);
        if (displayRun){
            console.log("single page open");
            Page.style.display="block";
        }
        else
            modalOpen('Display Error', `No data found for id: ${id} or there is no code for it`);

}

function CodePageClose() {
    console.log("single page close");
    Page.style.display="none";
}


function openDropdown(dropdownContent) {
    dropdownContent.classList.add('show');
    dropdownContent.classList.remove('hide');
}

function closeDropdown(dropdownContent) {
    dropdownContent.classList.add('hide');
    dropdownContent.classList.remove('show');
    setTimeout(() => dropdownContent.classList.remove('hide'), 500); // Clear `hide` class after animation
}

function toggleDropdown(id) {
    let dropdownContent = document.getElementById(`${id}`);
    let dropdownButton = document.getElementById(`${id}_button`);
    // Check if the dropdown is already open
    let isOpen = dropdownContent.classList.contains('show');

    if (isOpen) {
        closeDropdown(dropdownContent);
        //console.log("close dropdown", id);
        document.removeEventListener('click', handleOutsideClick);
    } else {
        openDropdown(dropdownContent);
        //console.log("open dropdown", id);

        // Add an event listener to handle outside clicks
        document.addEventListener('click', handleOutsideClick);

        function handleOutsideClick(event) {
            if (!dropdownContent.contains(event.target) && !dropdownButton.contains(event.target)) {
                closeDropdown(dropdownContent);
                document.removeEventListener('click', handleOutsideClick);
            }
        }
    }
}

function hideHtmlElement(id,time){
    if(time)
    setTimeout(()=>{
        let element = document.getElementById(id);
        element.style.cssText+="display: none !important;";
    },time)
    else{
        let element = document.getElementById(id);
        element.style.cssText+="display: none !important;";
    }
}


const CountB_in_A = ((sourceString, searchString) => {
    if (!searchString) {
        throw new Error("Search string cannot be empty");
    }

    let searchLength = searchString.length;
    let count = 0;
    let index = 0;

    while ((index = sourceString.indexOf(searchString, index)) !== -1) {
        count++;
        index += searchLength; // Move the index forward by the length of searchString
    }

    return count;
});

const LongestSubstring = ((sourceString, deLimiter) => {
    if (!deLimiter) {
        throw new Error("Delimiter cannot be empty");
    }

    let maxLength = 0;
    let lastPosition = -1; // Tracks the position of the last occurrence of the delimiter

    for (let i = 0; i < sourceString.length; i++) {
        if (sourceString[i] === deLimiter) {
            if (lastPosition !== -1) {
                maxLength = i - lastPosition - 1 > maxLength ? i - lastPosition - 1 : maxLength;
            }
            lastPosition = i;
        }
    }

    return maxLength;
});



