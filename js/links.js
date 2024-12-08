const links = document.getElementById("links");

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
        <div class="link">
            <p class="link_title">
                ${title}
            </p>
            <div class="link_content">
                <a class="link_link" href="${link}" target="_blank">${content}</a>
            </div>
            <div class="link_extra">
                ${extra}
            </div>
        </div>
    `;
    links.insertAdjacentHTML("beforeend", link_single);
});
