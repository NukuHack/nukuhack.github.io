const CodeOutput = document.getElementById('codes');
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

            CodeHelp += `<p class="code_title">The code itself: </p>`;
            CodeHelp += `<input type="button" class="code_readonly" onclick="ChangeTextareReadonly(${id})" value="Change from readonly">`;
            CodeHelp += `<input type="button" class="code_reset" onclick="CodeReset(${id})" value="Reset the code">`;
            CodeHelp += `<br>`;
            CodeHelp += `<textarea rows="${len + 2}" cols="${wid + (lang == "c#" ? 8 : 4)}" onfocus="ClearRed(${id})" readonly class="code_code" id="code_code_${id}">`;
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
    let toCopy = document.getElementById(`code_code_${id}`).value;
    if (toCopy != "")
        navigator.clipboard.writeText(toCopy);
    else
        alert("Nothing to copy")
}

function ChangeTextareReadonly(id,helper) {
    let toChange = document.getElementById(`code_code_${id}`);
    if (!helper) {
        if (toChange.readOnly == true) {
            toChange.readOnly = false;
            toChange.style.backgroundColor = "dodgerblue";
            toChange.style.cursor = "text";
        } else {
            toChange.readOnly = true;
            toChange.style.cssText = "";
        }
    }
    else{
        toChange.readOnly = true;
        toChange.style.cssText = "";
    }

}

function CodeReset(id) {
    let toReset = document.getElementById(`code_code_${id}`);
    toReset.value = `${Data[id].code}`;
    //toReset.innerText=toReset.innerHTML;
    console.log(Data[id].code);
    ChangeTextareReadonly(id,"XD");
}

function ClearRed(id) {
    let toClear = document.getElementById(`code_code_${id}`);
    toClear.classList.remove('invalid');
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



