const links = document.getElementById("links");

const linkHelper = [
    {
        "id": 0,
        "title": "Youtube:",
        "content": "Youtube",
        "link": "https://www.youtube.com",
    },
    {
        "id": 1,
        "title": "Facebook:",
        "content": "Facebook",
        "link": "https://www.facebook.com",
    },
    {
        "id": 2,
        "title": "Wikipedia:",
        "content": "Wikipedia",
        "link": "https://www.wikipedia.com",
    },
]

linkHelper.forEach(({id, title, content, link = ""}, index) => {
    let link_single = "";
    link_single += `
        <li class="links_li">
            <div class="link">
                <p class="link_title">${title}</p>
                <a class="link_link" href="${link}" target="_blank">${content}</a>
            </div>
        </li>
    `;
    links.insertAdjacentHTML("beforeend", link_single);
});
