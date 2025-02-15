const list = document.getElementById("list");

const linkHelper = [
    {
        "id": 0,
        "title": "Youtube.com",
        "content": "Youtube",
        "link": "https://www.youtube.com",
        "extra":"The main page of Youtube",
    },
    {
        "id": 1,
        "title": "Facebook.com",
        "content": "Facebook",
        "link": "https://www.facebook.com",
        "extra":"The main page of Facebook",
    },
    {
        "id": 2,
        "title": "Wikipedia.com",
        "content": "Wikipedia",
        "link": "https://www.wikipedia.com",
        "extra":"The main page of Wikipedia",
    },
    {
        "id": 3,
        "title": "ChatGPT.com",
        "content": "ChatGPT",
        "link": "https://chatgpt.com/",
        "extra":"The usual AI generator",
    },
    {
        "id": 4,
        "title": "Perchance.org",
        "content": "Perchance",
        "link": "https://perchance.org/ai-text",
        "extra":"A really fast text generator",
    },
    {
        "id": 4.3,
        "title": "DeepSeek.com",
        "content": "DeepSeek",
        "link": "https://chat.deepseek.com/",
        "extra":"Chinese Spyware but still better than ChatGPT",
    },
    {
        "id": 4.6,
        "title": "Qwen.ai",
        "content": "Qwen",
        "link": "https://chat.qwenlm.ai/",
        "extra":"The best AI generator I've ever seen",
    },
    {
        "id": 5,
        "title": "Github.com",
        "content": "Github",
        "link": "https://github.com/",
        "extra":"A nice free code sharing website",
    },
    {
        "id": 6,
        "title": "Outlook.com",
        "content": "Outlook",
        "link": "https://outlook.office365.com/mail/",
        "extra":"Email just for Microsoft",
    },
    {
        "id": 7,
        "title": "Discord.com",
        "content": "Discord",
        "link": "https://discord.com/channels/@me",
        "extra":"The best social media platform",
    },
    {
        "id": 8,
        "title": "Nukuhack.app",
        "content": "NukuHack",
        "link": "https://nukuhack.netlify.app/",
        "extra":"The current webpage's main page",
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
                <a class="link" href="${link}" target="_blank">${content}</a>
            </div>
            <div class="list_extra">
                ${extra}
            </div>
        </div>
    `;
    list.insertAdjacentHTML("beforeend", link_single);
});
