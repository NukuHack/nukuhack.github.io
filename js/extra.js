const list = document.getElementById("list");

const extraHelper = [
	{
		"id": 2,
		"title": "Nav update",
		"content": "Had to update the navBar because I made too much separate pages",
		"extra": "2025.02.15. 10:41",
	},
	{
		"id": 1,
		"title": "Christmas",
		"content": "Have a Very Merry Christmas",
		"extra": "have a good one - 2024.12.24",
	},
    {
        "id": 0,
        "title": "Last Update :",
        "content": "This page has been updated : 2024.12.24 23:00",
        "extra": "But it is still maintained currently",
    }
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
