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

export const GACHA_PRINTS: readonly GachaPrintDef[] = [];
