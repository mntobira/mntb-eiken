/**
 * LR（レジェンドレア）：大阪大学 前期日程 外国語（英語）対策の書き下ろし予想問題。
 * 各回を問題・解答解説の順に連結した1冊にし、ガチャ・マイPDFでも1アイテムとして扱う。
 * PDF は scripts/gacha-prints/osaka_mock/render.py で問題・解答を生成後、pdfunite で連結する。
 */
import type { GachaPrintDef } from './gachaPrints.generated';

export const OSAKA_MOCK_PRINTS: readonly GachaPrintDef[] = [];
