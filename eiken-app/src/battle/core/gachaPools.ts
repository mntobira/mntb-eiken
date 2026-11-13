/**
 * 英検版のガチャ2種（保存済みプールID 'kyotsu' / 'niji' は互換性のため維持）：
 *   ・kyotsu（「英検 とびらコレクション」）… 5級・4級・3級・準2級の冊子＆学習プリント＋着せ替え装飾
 *   ・niji  （「英検 がんばる自習室」）    … 準2級プラス・2級・準1級の冊子＆学習プリント＋自習室の装飾・お供・ステージ
 *
 * このファイルは ITEMS を import しない（growthItems → ここ の循環を避けるため、ID だけ持つ）。
 */
import { NIJI_MOCK_PRINTS } from '../../data/nijiMockPrints';
import { KOBE_MOCK_PRINTS } from '../../data/kobeMockPrints';
import { OSAKA_MOCK_PRINTS } from '../../data/osakaMockPrints';
import { RITSU_MOCK_PRINTS } from '../../data/ritsuMockPrints';
import { HOKUDAI_MOCK_PRINTS } from '../../data/hokudaiMockPrints';
import { TOHOKU_MOCK_PRINTS } from '../../data/tohokuMockPrints';
import { HIROSAKI_MOCK_PRINTS } from '../../data/hirosakiMockPrints';
import { IWATE_MOCK_PRINTS } from '../../data/iwateMockPrints';
import { AKITA_MOCK_PRINTS } from '../../data/akitaMockPrints';
import { YAMAGATA_MOCK_PRINTS } from '../../data/yamagataMockPrints';
import { FUKUSHIMA_MOCK_PRINTS } from '../../data/fukushimaMockPrints';
import { UTSUNOMIYA_MOCK_PRINTS } from '../../data/utsunomiyaMockPrints';
import { GUNMA_MOCK_PRINTS } from '../../data/gunmaMockPrints';

export type GachaPoolId = 'kyotsu' | 'niji';

export interface GachaPoolDef {
  id: GachaPoolId;
  /** バナーの見出し */
  title: string;
  /** 切替タブの短い名前 */
  short: string;
  /** LR の中身（提供割合・ピックアップの説明に使う） */
  lrName: string;
  lrNote: string;
  /** UR の目玉に優先する科目 */
  preferSubjects: readonly string[];
}

/** 保存済みプールIDは維持し、基礎〜中級（5級〜準2級）と上位級（準2級プラス〜準1級）の2シリーズに整理する。 */
export const GACHA_POOLS: readonly GachaPoolDef[] = [
  {
    id: 'kyotsu',
    title: '英検 とびらコレクション',
    short: 'とびらコレクション',
    lrName: '英検 5級〜準2級の冊子・学習プリント＆着せ替え',
    lrNote: '5級〜準2級の筆記・リーディング第1〜15回（UR 60冊）、重点語ノート①②・大問1スピード演習・ライティング実戦・解法ガイド（SR 18冊）、および着せ替え装飾を収録。同じ選択問題はアプリの大問別演習で無料で解けます。',
    preferSubjects: ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2'],
  },
  {
    id: 'niji',
    title: '英検 がんばる自習室',
    short: 'がんばる自習室',
    lrName: '英検 準2級プラス〜準1級の冊子・学習プリント＆自習室装備',
    lrNote: '準2級プラス〜準1級のリーディング第1〜15回（UR 45冊）、重点語ノート①②・大問1スピード演習・ライティング実戦・解法ガイド（SR 15冊）、および自習室テーマの限定装備・お供・背景を収録。同じ選択問題はアプリの大問別演習で無料で解けます。',
    preferSubjects: ['eiken_pre2plus', 'eiken_2', 'eiken_pre1'],
  },
];

export const DEFAULT_GACHA_POOL: GachaPoolId = 'kyotsu';

export function gachaPoolOf(id: GachaPoolId): GachaPoolDef {
  return GACHA_POOLS.find((p) => p.id === id) ?? GACHA_POOLS[0];
}

/** がんばる自習室ガチャ専用の限定装飾（とびらコレクションからは出ない） */
export const NIJI_NEW_ITEM_IDS: readonly string[] = [
  'hat_hachimaki_red', 'hat_hachimaki_navy', 'hat_hachimaki_gold',
  'aura_pencil', 'aura_pencil_gold',
  'wall_campus', 'wall_sheet', 'wall_nightdesk', 'wall_dawn',
  'frame_niji_ink', 'frame_niji_sakura', 'frame_niji_midnight',
  // 英検上位級・自習室向けの追加限定装飾
  'hat_eiken_scholar_beret', 'hat_eiken_pass_crown',
  'glasses_eiken_reader', 'glasses_eiken_gold',
  'cheek_eiken_focus',
  'aura_eiken_english', 'aura_eiken_pass_stars',
  'frame_eiken_navy', 'frame_eiken_royal',
  'comp_eiken_study_owl',
];

/** 大学別の予想問題（英検版では空配列） */
export const UNIV_MOCK_PRINT_IDS: readonly string[] = [
  ...NIJI_MOCK_PRINTS, ...KOBE_MOCK_PRINTS, ...OSAKA_MOCK_PRINTS, ...RITSU_MOCK_PRINTS,
  ...HOKUDAI_MOCK_PRINTS, ...TOHOKU_MOCK_PRINTS, ...HIROSAKI_MOCK_PRINTS, ...IWATE_MOCK_PRINTS,
  ...AKITA_MOCK_PRINTS, ...YAMAGATA_MOCK_PRINTS, ...FUKUSHIMA_MOCK_PRINTS, ...UTSUNOMIYA_MOCK_PRINTS,
  ...GUNMA_MOCK_PRINTS,
].map((p) => p.id);

/** がんばる自習室ガチャだけで出るもの */
export const NIJI_ONLY_IDS: ReadonlySet<string> = new Set([...NIJI_NEW_ITEM_IDS, ...UNIV_MOCK_PRINT_IDS]);

/** がんばる自習室ガチャでも出る共通の装備（ポーズ・枠・帽子・メガネ・ほっぺ・オーラ・壁紙・ステージ・お供をバランスよく収録） */
export const NIJI_SHARED_IDS: readonly string[] = [
  // ポーズ・フレーム
  'pose_studying', 'pose_thinking', 'pose_listening', 'pose_trophy', 'pose_good',
  'frame_prism', 'frame_galaxy', 'frame_midnight', 'frame_constellation', 'frame_graph', 'frame_n_slate', 'frame_n_moss',
  // 帽子・メガネ・ほっぺ・オーラ
  'hat_graduation', 'hat_beanie_navy', 'hat_wizard', 'hat_headphones', 'hat_beret', 'hat_cap_black',
  'glasses_round', 'glasses_square', 'glasses_monocle', 'glasses_star', 'glasses_square_brown',
  'cheek_blush', 'cheek_sticker', 'cheek_star', 'cheek_sparkle_blue',
  'aura_abc', 'aura_notes', 'aura_flame', 'aura_stars', 'aura_sparkle', 'aura_snow',
  // 壁紙・ホーム背景（ステージ）
  'wall_grid', 'wall_lined', 'wall_library', 'wall_english', 'wall_chalk', 'wall_night', 'wall_blueprint', 'wall_starlit', 'wall_gold',
  'stage_library', 'stage_aurora', 'stage_starlit', 'stage_forest', 'stage_ocean', 'stage_desert',
  // お供（カギノスケ）
  'comp_key_silver', 'comp_key_mint', 'comp_key_sky', 'comp_key_night', 'comp_key_aurora',
  'comp_key_cocoa', 'comp_key_forest', 'comp_key_teal', 'comp_key_emerald', 'comp_key_galaxy',
];

const UPPER_EIKEN_GRADES = ['pre2plus', '2', 'pre1'] as const;
const BASIC_EIKEN_GRADES = ['5', '4', '3', 'pre2'] as const;

function eikenPrintGradeOf(id: string): string | null {
  if (!id.startsWith('print_eiken_')) return null;
  if (id.includes('_written_')) return id.slice('print_eiken_'.length).split('_written_')[0];
  for (const prefix of [
    'print_eiken_wordbook2_',
    'print_eiken_wordbook_',
    'print_eiken_drill_short_',
    'print_eiken_guide_',
    'print_eiken_writing_',
  ]) {
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  return null;
}

/** そのアイテムがガチャの種類 pool に入るか（ガチャで出る物かどうかの判定は呼び出し側） */
export function inGachaPool(id: string, pool: GachaPoolId): boolean {
  const eikenGrade = eikenPrintGradeOf(id);
  if (eikenGrade) {
    return pool === 'niji'
      ? (UPPER_EIKEN_GRADES as readonly string[]).includes(eikenGrade)
      : (BASIC_EIKEN_GRADES as readonly string[]).includes(eikenGrade);
  }
  if (pool === 'niji') return NIJI_ONLY_IDS.has(id) || NIJI_SHARED_IDS.includes(id);
  return !NIJI_ONLY_IDS.has(id);
}
