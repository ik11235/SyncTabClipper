export namespace model {
  /**
   * 一度に保存したタブと保存時刻をまとめて持つ要素
   */
  interface Block {
    indexNum: number; // chrome.storageに保存する際に使用するためのindex
    createdAt: Date;
    tabs: Tab[];
    /**
     * ユーザーが付けたブロックの名前。
     * 名前を付けていないブロック（旧スキーマで保存されたデータを含む）と
     * 名前を消したブロックはundefinedになり、一覧ではタブ数を表示する
     */
    title?: string;
    /**
     * ブロックの編集をロックしているか。
     * ロック中は削除・編集の導線を止め、リンクを開いてもタブを消さない。
     * ロックしていないブロック（旧スキーマで保存されたデータを含む）は
     * undefinedになる
     */
    locked?: boolean;
    /**
     * ブロックにスター（お気に入り）を付けているか。
     * 付けたブロックは一覧の先頭へ寄せ、リボンで目立たせる。
     * 付けていないブロック（旧スキーマで保存されたデータを含む）は
     * undefinedになる
     */
    starred?: boolean;
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
    /**
     * この拡張機能が知らないスキーマ版数のデータだったか。
     * 壊れたデータではなく新しいバージョンで保存された正常なデータでありうるため、
     * trueのときは削除前に警告する（全同期端末から実データが消えるため）
     */
    unsupported: boolean;
    /**
     * 保存データは読めるはずなのに、解凍器を用意できなかったか。
     * v1/v2のzlibは必要なときだけ読み込むため(#237)、その読み込みに
     * 失敗するとここがtrueになる。データ自体は無事なので、
     * 壊れたデータと違い削除前に警告する
     */
    unreadable?: boolean;
  }

  /**
   * storageから読み込んだ一覧の要素。復元できたBlockか、できなかったBrokenBlock
   */
  type BlockEntry = Block | BrokenBlock;
}
