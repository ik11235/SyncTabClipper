/**
 * @jest-environment jsdom
 */
import {blockService} from "./blockService";
import {zlibWrapper} from "./zlib-wrapper";

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

    test('blockToHtml 正常系', (): void => {
        let htmlstr = `
<div id="123" class="tabs uk-card-default" data-created-at="1609556645678">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">2個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="2021-01-02T03:04:05.678Z">Sat Jan 02 2021 12:04:05 GMT+0900 (Japan Standard Time)</time></p>
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

        const res = blockService.htmlToBlock(convertElement(htmlstr))
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
    })

    test('blockToHtml DOMが一段ずれている', (): void => {
        let htmlstr = `
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">2個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="2021-01-02T03:04:05.678Z">Sat Jan 02 2021 12:04:05 GMT+0900 (Japan Standard Time)</time></p>
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
    </div>`


        expect(() => {
            blockService.htmlToBlock(convertElement(htmlstr))
        }).toThrowError("data-created-at is null.");
    })


    test('blockToHtml data-urlが欠損', (): void => {
        let htmlstr = `
<div id="123" class="tabs uk-card-default" data-created-at="1609556645678">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">2個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="2021-01-02T03:04:05.678Z">Sat Jan 02 2021 12:04:05 GMT+0900 (Japan Standard Time)</time></p>
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
    <a href="https://example.com/test" class="tab_link" data-title="title-test">title-test</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>
</ul>
    </div>
 </div>`

        expect(() => {
            blockService.htmlToBlock(convertElement(htmlstr))
        }).toThrowError("data-url or data-title is null");
    })

    test('blockToHtml data-titleが欠損', (): void => {
        let htmlstr = `
<div id="123" class="tabs uk-card-default" data-created-at="1609556645678">
    <div class="uk-card-header">
        <h3 class="uk-card-title uk-margin-remove-bottom">2個のタブ</h3>
        <p class="uk-text-meta uk-margin-remove-top">作成日: <time datetime="2021-01-02T03:04:05.678Z">Sat Jan 02 2021 12:04:05 GMT+0900 (Japan Standard Time)</time></p>
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
    <a href="https://example.com/test" class="tab_link" data-url="http://google.com/test2">title-test</a>
    <span class="uk-link tab_close" uk-icon="icon: close; ratio: 0.9"></span>
</li>
</ul>
    </div>
 </div>`

        expect(() => {
            blockService.htmlToBlock(convertElement(htmlstr))
        }).toThrowError("data-url or data-title is null");
    })

    test('deflateBlock 非圧縮時', (): void => {
        const zlibSpy = jest.spyOn(zlibWrapper, 'deflate').mockReturnValueOnce('eNpSNXdSNTJKLkpNLElNiU8sAXJUjR0NzQwsTU3NzExMzcwtVI2cgaIliUnFEElVUydVsK7SohyoiJFRRklJQTGY6QZEqRWJuQU5qXrJ+blAXklqMdhciDmZJTmpcG1gni5MgbmLqqkLkAQAAAD//w==');

        const block = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
            ],
        }
        const expected = "{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"}]}"
        expect(blockService.deflateBlock(block)).toBe(expected)
        expect(zlibSpy.mock.calls[0]).toEqual(["{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"}]}"])
        expect(zlibSpy).toHaveBeenCalledTimes(1)
    })

    test('deflateBlock 圧縮時', (): void => {
        const zlibSpy = jest.spyOn(zlibWrapper, 'deflate').mockReturnValueOnce('eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==');

        const block = {
            created_at: new Date(`2021-01-02T03:04:05.678Z`),
            tabs: [
                {
                    url: "https://example.com/test",
                    title: "title-test"
                },
                {
                    url: "http://google.com/test2",
                    title: "google-test"
                },
                {
                    url: "http://google.com/test3",
                    title: "google-test33"
                },
                {
                    url: "http://google.com/test4",
                    title: "google-test44"
                }
            ],
        }
        const expected = "eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w=="
        expect(blockService.deflateBlock(block)).toBe(expected)
        expect(zlibSpy.mock.calls[0]).toEqual(["{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"},{\"url\":\"http://google.com/test3\",\"title\":\"google-test33\"},{\"url\":\"http://google.com/test4\",\"title\":\"google-test44\"}]}"])
        expect(zlibSpy).toHaveBeenCalledTimes(1)
    })

    test('inflateJson 非解凍時', (): void => {
        const zlibSpy = jest.spyOn(zlibWrapper, 'inflate').mockReturnValueOnce("{\"created_at\":1627200615501,\"tabs\":[{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome://extensions/\",\"title\":\"拡張機能\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome://newtab/\",\"title\":\"新しいタブ\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"}]}");

        const input = "{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"}]}"

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
                },
            ],
        }
        expect(blockService.inflateJson(input)).toStrictEqual(expected)
        expect(zlibSpy).toBeCalledTimes(0)
    })

    test('inflateJson 解凍', (): void => {
        const zlibSpy = jest.spyOn(zlibWrapper, 'inflate').mockReturnValueOnce("{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"},{\"url\":\"http://google.com/test3\",\"title\":\"google-test33\"},{\"url\":\"http://google.com/test4\",\"title\":\"google-test44\"}]}");

        const input = 'eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w=='

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
                },
                {
                    "title": "google-test33",
                    "url": "http://google.com/test3",
                },
                {
                    "title": "google-test44",
                    "url": "http://google.com/test4",
                },
            ],
        }
        expect(blockService.inflateJson(input)).toStrictEqual(expected)
        expect(zlibSpy.mock.calls[0]).toEqual(['eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w=='])

        expect(zlibSpy).toBeCalledTimes(1)
    })


    function convertElement(str: string): HTMLElement {
        const element = document.createElement('div')
        element.innerHTML = str

        return <HTMLElement>element.firstElementChild
    }
})