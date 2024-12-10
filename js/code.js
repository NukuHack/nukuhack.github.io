

const CodeOutput = document.getElementById('codes');
const Modal = document.getElementById('modal');
let Data; // the main data storage ... yeah



const lang_to_Lang = {
    "c#": "C# aka C sharp",
    "js": "Js aka JavaScript",
}

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
            DisplayData();
        })
        .catch((error) => {
            console.error('Json load error:', error)
        });
}

fetchData();

console.log("I love bread");

function DisplayData() {
    Data.forEach(({id, lang, desc, code}, index) => {
        if (code == "none") {
            //nothing happened
        } else {
            let len = CountB_in_A(code, "\n");
            //console.log(leng)
            let wid = LongestSubstring(code, "\n");
            //console.log(wid)

            let CodeHelp = "";
            CodeHelp += `<div class="code" id="code_${id}">`;

            CodeHelp += `<div class="code_lang" id="lang_${id}">`;
            CodeHelp += `Language: ${lang_to_Lang[lang]}`;
            CodeHelp += `</div>`;

            CodeHelp += `<div class="code_desc" id="desc_${id}">`;
            CodeHelp += `Description: ${desc}`;
            CodeHelp += `</div>`;

            CodeHelp += `<div class="code_help">`;

            CodeHelp += `<p class="code_title">`;
            CodeHelp += `<input type="button" class="code_reasize" id="code_resize_${id}"
                value="The code itself: " readonly onClick="CodeResizer(${id})">`;
            CodeHelp += `</p>`;
            CodeHelp += `<input type="button" class="code_readonly" onclick="ChangeTextareaReadonly(${id})" value="Change from readonly">`;
            CodeHelp += `<input type="button" class="code_reset" onclick="CodeReset(${id})" value="Reset the code">`;
            CodeHelp += `<br>`;
            CodeHelp += `<textarea rows="${len + 2}" cols="${wid + (lang == "c#" ? 8 : 4)}" readonly class="code_code" id="code_code_${id}">`;
            CodeHelp += `${code}`;
            CodeHelp += `</textarea>`;

            CodeHelp += `</div>`;

            CodeHelp += `<button onclick="CopyCode(${id})" class="code_copy">Copy Code</button>`;

            CodeHelp += `</div>`;

            CodeOutput.insertAdjacentHTML('beforeend', CodeHelp);
        }
    })
}

function CopyCode(id) {
    // Check if the Clipboard API is available
    if (navigator.clipboard) {
        // Get the text to copy
        let textToCopy = document.getElementById(`code_code_${id}`).value;
        if (!textToCopy) {
            modalOpen('Copy Error','Failed to copy:',"text to copy is null")
        }
        else{
            // Write the text to the clipboard
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    // Display a message if the text was copied successfully
                    modalOpen('Copy Success','Code copied to clipboard!')
                })
                .catch((error) => {
                    // Display an error message if there is an issue copying the text
                    modalOpen('Copy Error','Failed to copy:', error)
                });
        }
    } else {
        // If the Clipboard API is not available, display an error message
        modalOpen('Browser Error','Your browser does not support the Clipboard API.')
    }
}


function ChangeTextareaReadonly(id,helper) {
    let toChange = document.getElementById(`code_code_${id}`);
    if (!helper&&toChange.readOnly === true) {
            toChange.readOnly = false;
            toChange.style.backgroundColor = "dodgerblue";
            toChange.style.cursor = "text";
    }
    else{
        toChange.readOnly = true;
        RemoveCss(toChange,'background-color');
        RemoveCss(toChange,'cursor');
    }

}

function CodeReset(id) {
    let toReset = document.getElementById(`code_code_${id}`);
    toReset.value = `${Data[id].code}`;
    //toReset.innerText=toReset.innerHTML;
}

function CodeResizer(id) {
    let toResize = document.getElementById(`code_code_${id}`);
    if (toResize.style.fontSize==='100%')
        RemoveCss(toResize,'font-size');
    else
        toResize.style.fontSize = `100%`;
}



const CountB_in_A = ((sourceString, searchString) => {
    if (!searchString) {
        throw new Error("Search string cannot be empty");
    }

    let count = 0;
    let position = sourceString.indexOf(searchString);

    while (position !== -1) {
        count++;
        position = sourceString.indexOf(searchString, position + searchString.length);
    }

    return count;
});

const LongestSubstring = ((sourceString, searchString) => {
    if (!searchString) {
        throw new Error("Delimiter cannot be empty");
    }

    let maxLength = 0;
    let lastPosition = -1; // Tracks the position of the last occurrence of the delimiter

    for (let i = 0; i < sourceString.length; i++) {
        if (sourceString[i] === searchString) {
            if (lastPosition !== -1) {
                const currentLength = i - lastPosition - 1;
                maxLength = Math.max(maxLength, currentLength);
            }
            lastPosition = i;
        }
    }

    return maxLength;
});




function RemoveCss(item,type){
    let CssT = item.style.cssText;
    let TypePlace = CssT.indexOf(`${type}`);
    // counting the length between the start and the start of the type
    let TypeStart = CssT.slice(0,TypePlace).length;
    item.style.cssText=CssT.replace(CssT.slice(TypePlace,TypeStart+CssT.slice(TypePlace).indexOf(';')),'');
}

function modalOpen(title,text,error) {
    let modalHelp = `
        <div class="modal-content">
            <h4 class="modal_title">${title}</h4>
            <p class="modal_text">${text}</p>
            ${!error?"":`<p class="modal-error">${error}</p>`}
            <div class="modal-footer">
                <button onClick="modalClose()" class="modal-button">Ok</button>
            </div>
        </div>
    `
    Modal.innerHTML = modalHelp;
    document.getElementById('modal').style.display = "block";
}

function modalClose() {
    document.getElementById('modal').style.display = "none";
}

