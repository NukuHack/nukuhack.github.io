const list = document.getElementById("list");

const listHelper = [
    {
        "id": 0,
        "title": "Last Update :",
        "content": "This page has been updated : 2024.12.10 18:20",
        "extra": "But it is still maintained currently",
    },
    {
        "id": 1,
        "title": "idk :",
        "content": "idk idk",
        "extra": "yeah",
    },
]

listHelper.forEach(({id, title, content, extra}, index) => {
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
