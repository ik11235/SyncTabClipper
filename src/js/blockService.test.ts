import {blockService} from "./blockService";

describe('blockService', (): void => {
    test('createBlock 正常系', (): void => {
        const tabs: chrome.tabs.Tab[] = [
            {
                index: 0,
                title: "title-00",
                url: "https://exapmle.com/test01",
                pinned: false,
                highlighted: false,
                windowId: 0,
                active: false,
                incognito: false,
                selected: false,
                discarded: false,
                autoDiscardable: false,
                groupId: 0,
            },
            {
                index: 1,
                title: "title-02",
                url: "https://exapmle.com/test002",
                pinned: false,
                highlighted: false,
                windowId: 0,
                active: false,
                incognito: false,
                selected: false,
                discarded: false,
                autoDiscardable: false,
                groupId: 0,
            },
        ]
        const created_at = new Date(`2021-01-02T03:04:05.678Z`)
        const res = blockService.createBlock(tabs, created_at)
        expect(res).toEqual({
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    title: "title-00",
                    url: "https://exapmle.com/test01",
                },
                {
                    title: "title-02",
                    url: "https://exapmle.com/test002",
                }
            ]
        });
    });

    test('blockToJson 正常系', (): void => {
        let block = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                }
            ],
        }

        const res = blockService.blockToJson(block)
        expect(res).toBe("{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"}]}");
    });

    test('jsonToBlock 正常系', (): void => {
        let json = "{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"}]}"

        const res = blockService.jsonToBlock(json)
        const expected = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                }
            ],
        }

        expect(res).toStrictEqual(expected);
    });

    test('tabToHtml 正常系', (): void => {
        let tab = {
            url: "https://example.com/test",
            title: "title-test"
        }
        const res = blockService.tabToHtml(tab)
        const expected = `
<li>
    <img src=\"https://www.google.com/s2/favicons?domain=example.com\" alt=\"title-test\"/>
    <a href=\"https://example.com/test\" class=\"tab_link\" data-url=\"https://example.com/test\" data-title=\"title-test\">title-test</a>
    <span class=\"uk-link tab_close\" uk-icon=\"icon: close; ratio: 0.9\"></span>
</li>`
        expect(res).toBe(expected);
    })

    test('blockToHtml 正常系', (): void => {
        let block = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                }
            ],
        }
        const res = blockService.blockToHtml(block, "123")
        const expected = `
<div id="123" class="tabs uk-card-default" data-created-at="1609556645678">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">2個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="2021-01-02T03:04:05.678Z">${block.created_at}</time></p>
        <div class="uk-grid">
            <div class="uk-width-auto"><span class="all_tab_link uk-link">すべてのリンクを開く</span></div>
            <div class="uk-width-auto"><span class="all_tab_delete uk-link">すべてのリンクを閉じる</span></div>
            <div class="uk-width-expand"></div>
        </div>
    </div>
    <div class="uk-card-body">
        <ul>
<li>
    <img src="https://www.google.com/s2/favicons?domain=example.com" alt="title-test"/>
    <a href="https://example.com/test" class="tab_link" data-url="https://example.com/test" data-title="title-test">title-test</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>

<li>
    <img src="https://www.google.com/s2/favicons?domain=google.com" alt="google-test"/>
    <a href="http://google.com/test2" class="tab_link" data-url="http://google.com/test2" data-title="google-test">google-test</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li></ul>
    </div>
</div>`

        expect(res).toBe(expected);
    })

})