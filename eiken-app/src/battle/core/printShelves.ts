import type { GachaPrintDef } from '../../data/gachaPrints.generated';

/**
 * PDF の棚（英検版向けに種類別・級帯別に整理）。
 *   ショップの「PDF」・マイPDF・ガチャの「提供割合 › コレクション › 学習プリント」で共通利用し、
 *   138冊すべてのPDF景品を種類ごとに一目で絞り込めるようにする。
 */
export type PrintShelfId =
  | 'eiken_written_basic'
  | 'eiken_written_upper'
  | 'eiken_wordbook'
  | 'eiken_drill'
  | 'eiken_writing'
  | 'eiken_guide'
  | 'kyotsu'
  | 'hokkaido_tohoku'
  | 'kanto_chubu'
  | 'kinki'
  | 'chugoku_shikoku'
  | 'kyushu_okinawa'
  | 'book'
  | 'english'
  | 'chemistry'
  | 'math'
  | 'joho'
  | 'science'
  | 'trend'
  | 'other';

/** 並び順：英検の冊子（基礎級・上位級）→ 単語ノート → 短文スピード演習 → ライティング → 解法ガイド */
export const PRINT_SHELVES: readonly { id: PrintShelfId; label: string }[] = [
  { id: 'eiken_written_basic', label: '冊子 5級〜準2級' },
  { id: 'eiken_written_upper', label: '冊子 準2プラス〜準1級' },
  { id: 'eiken_wordbook', label: '重点語・例文ノート' },
  { id: 'eiken_drill', label: '大問1 スピード演習' },
  { id: 'eiken_writing', label: 'ライティング実戦' },
  { id: 'eiken_guide', label: '解法・時間配分ガイド' },
  { id: 'kyotsu', label: '共通テスト予想' },
  { id: 'hokkaido_tohoku', label: '2次 北海道・東北' },
  { id: 'kanto_chubu', label: '2次 関東・中部' },
  { id: 'kinki', label: '2次 近畿' },
  { id: 'chugoku_shikoku', label: '2次 中国・四国' },
  { id: 'kyushu_okinawa', label: '2次 九州・沖縄' },
  { id: 'book', label: '完全版の本' },
  { id: 'english', label: '英検その他' },
  { id: 'chemistry', label: '化学' },
  { id: 'math', label: '数学' },
  { id: 'joho', label: '情報' },
  { id: 'science', label: '生物・理科' },
  { id: 'trend', label: '出題傾向' },
  { id: 'other', label: 'その他' },
];

/** 大学（PDF の id に入っている名前）→ 地方 */
export const UNIV_REGION: Readonly<Record<string, PrintShelfId>> = {
  hokudai: 'hokkaido_tohoku', tohoku: 'hokkaido_tohoku', hirosaki: 'hokkaido_tohoku', iwate: 'hokkaido_tohoku', akita: 'hokkaido_tohoku',
  yamagata: 'hokkaido_tohoku', fukushima: 'hokkaido_tohoku',
  utsunomiya: 'kanto_chubu', ibaraki: 'kanto_chubu', gunmaj: 'kanto_chubu', gakugei: 'kanto_chubu', tufs: 'kanto_chubu', nagoya: 'kanto_chubu', shizuoka: 'kanto_chubu',
  kanazawa: 'kanto_chubu', toyama: 'kanto_chubu', toyamamed: 'kanto_chubu', fukuie: 'kanto_chubu', fukuim: 'kanto_chubu',
  fukuig: 'kanto_chubu', fpu: 'kanto_chubu',
  gifu: 'kanto_chubu', mie: 'kanto_chubu', nit: 'kanto_chubu', ncu: 'kanto_chubu', apua: 'kanto_chubu', apub: 'kanto_chubu',
  aue: 'kanto_chubu',
  gunma: 'kanto_chubu',
  omua: 'kinki', omub: 'kinki', wakayama: 'kinki', wakayamamed: 'kinki', kobe: 'kinki', osaka: 'kinki', ritsu: 'kinki',
  okayama: 'chugoku_shikoku', hiroshima: 'chugoku_shikoku', tottori: 'chugoku_shikoku', yamaguchi: 'chugoku_shikoku', onomichi: 'chugoku_shikoku', shimaneh: 'chugoku_shikoku', shimanem: 'chugoku_shikoku', kankyo: 'chugoku_shikoku',
  kagawa: 'chugoku_shikoku', tokushima: 'chugoku_shikoku', ehimeh: 'chugoku_shikoku', ehimee: 'chugoku_shikoku', ehimem: 'chugoku_shikoku',
  kochij: 'chugoku_shikoku', kochik: 'chugoku_shikoku', kochie: 'chugoku_shikoku', kochim: 'chugoku_shikoku',
  kyushu: 'kyushu_okinawa', saga: 'kyushu_okinawa', kumamoto: 'kyushu_okinawa', ryukyu: 'kyushu_okinawa', fwu: 'kyushu_okinawa',
  oitae: 'kyushu_okinawa', oitak: 'kyushu_okinawa', oitam: 'kyushu_okinawa',
  nagasakid: 'kyushu_okinawa', nagasakic: 'kyushu_okinawa',
  kagoa: 'kyushu_okinawa', kagob: 'kyushu_okinawa',
  miyae: 'kyushu_okinawa', miyam: 'kyushu_okinawa', miyat: 'kyushu_okinawa',
};

/** 大学別の予想問題なら、その大学の名前（id の一部）。それ以外は null */
export function univOfPrint(id: string): string | null {
  const m = /^print_lr_niji_([a-z]+)_en_\d+$/.exec(id) ?? /^print_lr_([a-z]+)_(?:[qa]_)?\d+$/.exec(id);
  return m && m[1] !== 'kyotsu' ? m[1] : null;
}

export function printShelfOf(p: GachaPrintDef): PrintShelfId {
  if (p.subject.startsWith('eiken_')) {
    if (p.id.includes('_written_')) {
      return ['eiken_pre2plus', 'eiken_2', 'eiken_pre1'].includes(p.subject)
        ? 'eiken_written_upper'
        : 'eiken_written_basic';
    }
    if (p.id.startsWith('print_eiken_wordbook')) return 'eiken_wordbook';
    if (p.id.startsWith('print_eiken_drill_')) return 'eiken_drill';
    if (p.id.startsWith('print_eiken_writing_')) return 'eiken_writing';
    if (p.id.startsWith('print_eiken_guide_') || p.category === '出題傾向') return 'eiken_guide';
    return 'english';
  }
  if (p.id.startsWith('print_lr_kyotsu')) return 'kyotsu';
  const univ = univOfPrint(p.id);
  if (univ) return UNIV_REGION[univ] ?? 'other';
  if (p.category === '完全版') return 'book';
  if (p.category === '出題傾向') return 'trend';
  if (p.subject.startsWith('english')) return 'english';
  if (p.subject.startsWith('chemistry')) return 'chemistry';
  if (p.subject === 'math') return 'math';
  if (p.subject === 'joho') return 'joho';
  if (p.subject === 'biology_basic' || p.subject === 'rika') return 'science';
  return 'other';
}
