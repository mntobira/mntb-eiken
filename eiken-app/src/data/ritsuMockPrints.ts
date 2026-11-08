/**
 * LR（レジェンドレア）：立命館大学 全学統一方式（文系）英語 対策 予想問題（白黒・A4・マーク式）。
 *   3回分 × 「問題（マーク式解答用紙つき）」「解答・解説（全訳つき）」の6種。各回 大問 I〜V・120点（独自配点）。
 *   英文・設問はすべて書き下ろしのオリジナル。登場する人物・団体・場所は架空。
 *   立命館大学の過去問・公式問題ではなく、大学とは関係がない（表紙と奥付に明記。tests/ritsuMockPrints.test.ts が確かめる）。
 *
 * PDF は scripts/gacha-prints/ritsu_mock/render.py で作る。pages / kb は実物の値を写す（テストが照合する）。
 * 各回の問題・解答解説を1冊に連結し、1アイテムで提供する。
 */
import type { GachaPrintDef } from './gachaPrints.generated';

export const RITSU_MOCK_PRINTS: readonly GachaPrintDef[] = [];
