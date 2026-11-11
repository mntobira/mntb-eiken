import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../src/components/gacha.css', import.meta.url)), 'utf8');

describe('ガチャ画面のモバイル横はみ出し防止', () => {
  it('バナー・ヒーロー・カルーセルを親の幅に収める', () => {
    expect(css).toContain('.mana-hub-gacha .gacha-room { box-sizing: border-box; min-width: 0;');
    expect(css).toMatch(/\.gacha-banner \{[^}]*box-sizing: border-box; width: 100%; min-width: 0;/);
    expect(css).toMatch(/\.gacha-banner-hero \{[^}]*box-sizing: border-box;[^}]*width: 100%; min-width: 0;/);
    expect(css).toContain('.gacha-carousel { box-sizing: border-box; min-width: 0; max-width: 100%; }');
  });

  it('ガチャ切替タブはリスニング版と同じく1列に保ち、狭い画面ではラベルを詰める', () => {
    expect(css).toMatch(/\.gacha-banner-head \{[^}]*flex-wrap: wrap/);
    expect(css).toContain('.gacha-pool-tabs { display: inline-flex; flex-wrap: nowrap; min-width: 0; max-width: 100%;');
    expect(css).toMatch(/@media \(max-width: 420px\) \{\s*\.gacha-banner-head \{ align-items: flex-start; \}/);
    expect(css).toContain('.gacha-pool-tabs { flex: 1 1 220px; }');
    expect(css).toContain('.gacha-banner-head > small { margin-left: auto; }');
    expect(css).toContain('.gacha-pool-tabs button { padding: 0 8px; font-size: 12px; }');
  });
});
