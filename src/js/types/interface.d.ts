export namespace model {
  /**
   * 一度に保存したタブと保存時刻をまとめて持つ要素
   */
  interface Block {
    indexNum: number; // chrome.storageに保存する際に使用するためのindex
    createdAt: Date;
    tabs: Tab[];
  }

  interface Tab {
    url: string;
    title: string;
  }

  /**
   * 保存データが復元できずBlockにできなかった要素
   * indexNumだけは分かるため、一覧に出して削除だけはできるようにする
   */
  interface BrokenBlock {
    indexNum: number;
    broken: true;
  }

  /**
   * storageから読み込んだ一覧の要素。復元できたBlockか、できなかったBrokenBlock
   */
  type BlockEntry = Block | BrokenBlock;
}
