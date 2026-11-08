/**
 * LR（レジェンドレア）：共通テスト 英語 予想問題（2025年度〜 新課程の形式）。
 *   リーディング（80分・100点・大問8・解答数44）とリスニング（30分・100点・大問6・37問）を各5回分。
 *   すべて書き下ろしのオリジナル問題（センターの過去問ではない）。リスニングは全スクリプト＋全訳つき（イラスト・地図入り。音声は ElevenLabs v4。表紙の QR から日本語の案内つきの通し音声を聞ける：kyotsu_assets/full/l{n}.html・F8 2026-11-04）。リーディングは図・写真入り、英文量は本番並み（約5,000〜5,400語）。
 *
 * PDF は scripts/gacha-prints/kyotsu_mock/build.py で作る。pages / kb は .tmpwork/kyotsu-mock.json の値を写す
 * （tests/kyotsuMockPrints.test.ts が実物と照合する）。
 */
import type { GachaPrintDef } from './gachaPrints.generated';

export const KYOTSU_MOCK_PRINTS: readonly GachaPrintDef[] = [];

/**
 * F5（2026-11-04）：第1回（リーディング・リスニング）は、ガチャで当てなくても全文を見られる。
 *   共通テストガチャのピックアップに固定し、「全文を見る」でアプリ内の PDF ビューで開く（戻るで元の画面へ）。
 */
export const KYOTSU_FREE_FULL_IDS: readonly string[] = ['print_lr_kyotsu_r_1', 'print_lr_kyotsu_l_1'];
export const isFreeFullPrint = (id: string): boolean => KYOTSU_FREE_FULL_IDS.includes(id);
