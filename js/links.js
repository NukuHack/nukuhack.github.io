const list = document.getElementById("list");

const linkHelper = [
    {
        "id": 0,
        "title": "Youtube:",
        "content": "Youtube",
        "link": "https://www.youtube.com",
        "extra":"The main page of Youtube",
    },
    {
        "id": 1,
        "title": "Facebook:",
        "content": "Facebook",
        "link": "https://www.facebook.com",
        "extra":"The main page of Facebook",
    },
    {
        "id": 2,
        "title": "Wikipedia:",
        "content": "Wikipedia",
        "link": "https://www.wikipedia.com",
        "extra":"The main page of Wikipedia",
    },
]

linkHelper.forEach(({id, title, content, link="#",extra}, index) => {
    let link_single = "";
    link_single += `
        <div class="list_item">
            <p class="list_title">
                ${title}
            </p>
            <div class="list_content">
                <a class="link" href="${link}" target="_blank"><span class="link_content">${content}</span></a>
            </div>
            <div class="list_extra">
                ${extra}
            </div>
        </div>
    `;
    list.insertAdjacentHTML("beforeend", link_single);
});
