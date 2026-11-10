// ★自動生成ファイル★ 手で直さない。
// 再生成: npx tsx scripts/gacha-prints/dump-data.mts .tmpwork/prints-data.json
//         node scripts/gacha-prints/build-prints.mjs .tmpwork/prints-data.json
//         python3 scripts/gacha-prints/finalize.py

export type GachaPrintCategory = '出題傾向' | '演習プリント' | '単語テスト' | '完全版';

export interface GachaPrintDef {
  /** ガチャのアイテム id（ITEMS にもこの id で入る） */
  id: string;
  label: string;
  subject: string;
  category: GachaPrintCategory;
  /** public/ からの PDF パス */
  file: string;
  /** 1ページ目のサムネイル（webp） */
  thumb: string;
  pages: number;
  kb: number;
}

export const GACHA_PRINTS: readonly GachaPrintDef[] = [
  {
    "id": "print_eiken_wordbook_5",
    "label": "英検5級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_5",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_5.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_5.webp",
    "pages": 5,
    "kb": 75
  },
  {
    "id": "print_eiken_wordbook_4",
    "label": "英検4級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_4",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_4.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_4.webp",
    "pages": 5,
    "kb": 84
  },
  {
    "id": "print_eiken_wordbook_3",
    "label": "英検3級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_3",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_3.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_3.webp",
    "pages": 5,
    "kb": 91
  },
  {
    "id": "print_eiken_wordbook_pre2",
    "label": "英検準2級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_pre2",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_pre2.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_pre2.webp",
    "pages": 5,
    "kb": 99
  },
  {
    "id": "print_eiken_wordbook_pre2plus",
    "label": "英検準2級プラス 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_pre2plus",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_pre2plus.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_pre2plus.webp",
    "pages": 5,
    "kb": 113
  },
  {
    "id": "print_eiken_wordbook_2",
    "label": "英検2級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_2",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_2.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_2.webp",
    "pages": 5,
    "kb": 109
  },
  {
    "id": "print_eiken_wordbook_pre1",
    "label": "英検準1級 重点語・例文ノート（30語・確認テスト）",
    "subject": "eiken_pre1",
    "category": "単語テスト",
    "file": "/prints/print_eiken_wordbook_pre1.pdf",
    "thumb": "/prints/thumbs/print_eiken_wordbook_pre1.webp",
    "pages": 5,
    "kb": 114
  }
];
