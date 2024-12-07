
const links = document.getElementById("links");

const linkHelper = [
    {
        "id":0,
        "title":"Youtube:",
        "content":"Youtube",
        "link": "https://www.youtube.com",
        "extra":"link_youtube",
    },
    {
        "id":1,
        "title":"Facebook:",
        "content":"Facebook",
        "link": "https://www.facebook.com",
        "extra":"link_facebook",
    },
    {
        "id":2,
        "title":"Wikipedia:",
        "content":"Wikipedia",
        "link": "https://www.wikipediacom",
        "extra":"link_wikipedia",
    },
]

linkHelper.forEach(({id,title,content,link,extra=""},index) => {
    let link_single = "";
    link_single += `
        <li class="links_li">
            <div class="link"${extra!==""?` id="${extra}"`:""}>
                <p class="link_title">${title}</p>
                <a class="link_link" href="${link}" target="_blank">${content}</a>
            </div>
        </li>
    `;
    links.insertAdjacentHTML("beforeend", link_single);
});
