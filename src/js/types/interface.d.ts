export namespace model {
  /**
   * 一度に保存したタブと保存時刻をまとめて持つ要素
   */
  // eslint-disable-next-line no-unused-vars
  interface Block {
    indexNum: number; // chrome.storageに保存する際に使用するためのindex
    createdAt: Date;
    tabs: Tab[];
  }

  interface Tab {
    url: string;
    title: string;
  }
}
