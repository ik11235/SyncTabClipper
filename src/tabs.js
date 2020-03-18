function getDomein(str) {
    var parser = new URL(str);
    return parser.host;
}

window.onload = function () {
    chrome.storage.sync.get(['tab_data'], function (result) {
        //console.dir(result);
        var main = document.getElementById('main');
        var inner_html = '';

        var links = result.tab_data.tabs.map(function (page_data) {
            var domain = getDomein(page_data.url);
            var str = `<li><img src="http://www.google.com/s2/favicons?domain=${domain}" alt="${page_data.title}"/><a href="${page_data.url}">${page_data.title}</a></li>`;
            console.log(str);
            return str;
        }).join("\n");
        console.log(links);

        const html_text = `<ul>${links}</ul>`;
        main.insertAdjacentHTML('afterbegin', html_text);
    });
};