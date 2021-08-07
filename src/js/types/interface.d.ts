export namespace model {
  /**
   * 一度に保存したタブと保存時刻をまとめて持つ要素
   */
  interface Block {
    created_at: Date,
    tabs: Tab[],
  }

  interface Tab {
    url: string,
    title: string,
  }

  /**
   * Blockと引いた際のKeyを合わせて持つ要素
   * 現状のblockToHtmlの実装上Key必須なので新規に作成
   *
   * memo: 無理矢理感があるので、できれば使わない方向にしたい
   */
  interface BlockAndKey {
    IDkey: string,
    block: model.Block,
  }

}
