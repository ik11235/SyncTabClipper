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
})