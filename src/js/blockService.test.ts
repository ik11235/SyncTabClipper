/**
 * @jest-environment jsdom
 */
import {blockService} from "./blockService";
import {zlibWrapper} from "./zlib-wrapper";

let deflateSpy: jest.SpyInstance;
let inflateSpy: jest.SpyInstance;

beforeAll(() => {
  deflateSpy = jest.spyOn(zlibWrapper, 'deflate')
  inflateSpy = jest.spyOn(zlibWrapper, 'inflate')
});

afterEach(() => {
  deflateSpy.mockReset()
  inflateSpy.mockReset()
});

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

  test('deflateBlock 非圧縮時', (): void => {
    deflateSpy.mockReturnValueOnce('eNpSNXdSNTJKLkpNLElNiU8sAXJUjR0NzQwsTU3NzExMzcwtVI2cgaIliUnFEElVUydVsK7SohyoiJFRRklJQTGY6QZEqRWJuQU5qXrJ+blAXklqMdhciDmZJTmpcG1gni5MgbmLqqkLkAQAAAD//w==');

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
    expect(deflateSpy.mock.calls[0]).toEqual(["{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"}]}"])
    expect(deflateSpy).toHaveBeenCalledTimes(1)
  })

  test('deflateBlock 圧縮時', (): void => {
    deflateSpy.mockReturnValueOnce('eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w==');

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
    expect(deflateSpy.mock.calls[0]).toEqual(["{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"},{\"url\":\"http://google.com/test3\",\"title\":\"google-test33\"},{\"url\":\"http://google.com/test4\",\"title\":\"google-test44\"}]}"])
    expect(deflateSpy).toHaveBeenCalledTimes(1)
  })

  test('inflateJson 非解凍時', (): void => {
    inflateSpy.mockReturnValueOnce("{\"created_at\":1627200615501,\"tabs\":[{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome://extensions/\",\"title\":\"拡張機能\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"},{\"url\":\"chrome://newtab/\",\"title\":\"新しいタブ\"},{\"url\":\"chrome-extension://djamgplmdfdnghbcpfgpbfadipbgihbi/tabs.html\",\"title\":\"syncTabCliper\"}]}");

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
    expect(inflateSpy).toBeCalledTimes(0)
  })

  test('inflateJson 解凍', (): void => {
    inflateSpy.mockReturnValueOnce("{\"created_at\":1609556645678,\"tabs\":[{\"url\":\"https://example.com/test\",\"title\":\"title-test\"},{\"url\":\"http://google.com/test2\",\"title\":\"google-test\"},{\"url\":\"http://google.com/test3\",\"title\":\"google-test33\"},{\"url\":\"http://google.com/test4\",\"title\":\"google-test44\"}]}");

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
    expect(inflateSpy.mock.calls[0]).toEqual(['eNqkzNEKwjAMBdCvyaOiadPqo3P4G1JnmEJHxxrBz7e2cyAoA4VSetObA7YCxGZgJ3w+OkkB1G5tVlsiYzQZuwHcp6m4UyyfQBXkrdvgxwniRaSP+XlIh++u6z0vm9ClJByzW5yreJ7Wclq8CrZ+dj7aE92G0L7J+IUuxf9sNW8r9bOu53WtR53qdD8AAAD//w=='])

    expect(inflateSpy).toBeCalledTimes(1)
  })


  function convertElement(str: string): HTMLElement {
    const element = document.createElement('div')
    element.innerHTML = str

    return <HTMLElement>element.firstElementChild
  }
})
