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
}
