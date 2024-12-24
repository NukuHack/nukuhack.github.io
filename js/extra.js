const list = document.getElementById("list");

const extraHelper = [
    {
        "id": 0,
        "title": "Last Update :",
        "content": "This page has been updated : 2024.12.24 21:10",
        "extra": "But it is still maintained currently",
    },
    {
        "id": 1,
        "title": "Christmas",
        "content": "Have a Very Merry Christmas",
        "extra": "have a good one - 2024.12.24",
    },
    {
        "id": 2,
        "title": "idk",
        "content": "idk idk",
        "extra": "idk",
    },
]

extraHelper.forEach(({id, title, content, extra}, index) => {
    let list_item = "";
    list_item += `
        <div class="list_item">
            <p class="list_title">
                ${title}
            </p>
            <div class="list_content">
                ${content}
            </div>
            <div class="list_extra">
                ${extra}
            </div>
        </div>
    `;
    list.insertAdjacentHTML("beforeend", list_item);
});
