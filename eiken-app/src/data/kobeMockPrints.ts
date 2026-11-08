/**
 * LR（レジェンドレア）：神戸大学 前期日程 外国語（英語）対策 予想問題（白黒・A4）。
 *   3回分 × 「問題（解答用紙つき）」「解答・解説（採点基準・全訳つき）」の6種。各回 大問 I〜IV・125点。
 *   英文・設問・図表はすべて書き下ろしのオリジナル（IV の図表のデータは架空）。
 *   神戸大学の過去問・公式問題ではなく、大学とは関係がない（表紙と奥付に明記。tests/kobeMockPrints.test.ts が確かめる）。
 *
 * PDF は scripts/gacha-prints/kobe_mock/render.py で作る。pages / kb は実物の値を写す（テストが照合する）。
 * 各回の問題・解答解説を1冊に連結し、1アイテムで提供する。
 */
import type { GachaPrintDef } from './gachaPrints.generated';

export const KOBE_MOCK_PRINTS: readonly GachaPrintDef[] = [];
