/**
 * LR（レジェンドレア）：山形大学 前期日程 英語（人文社会科学部・医学部ほか 英語を課す学部の共通問題）対策 予想問題（白黒・A4）。
 *   3回分 × 「問題（解答用紙つき）」「解答・解説（全訳つき）」の6種。各回 200点（独自配点。第1・2回は大問Ⅰ・Ⅱ、第3回は2記事融合の大問Ⅰ）。
 *   英文・日本文・設問はすべて書き下ろしのオリジナル。登場する人物・団体・地名は架空。
 *   山形大学の過去問・公式問題ではなく、大学とは関係がない（表紙と奥付に明記。tests/yamagataMockPrints.test.ts が確かめる）。
 *
 * PDF は scripts/gacha-prints/yamagata_mock/render.py で作る。pages / kb は実物の値を写す（テストが照合する）。
 * 各回の問題・解答解説を1冊に連結し、1アイテムで提供する。
 */
import type { GachaPrintDef } from './gachaPrints.generated';

export const YAMAGATA_MOCK_PRINTS: readonly GachaPrintDef[] = [];
