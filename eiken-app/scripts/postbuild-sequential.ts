/**
 * 第3工程（順次チャンク注入＋esbuild 1ファイルずつ順番ミニファイ＆構文検証）：
 * Vite/Rollup プロセス終了後に、生成された `dist/assets/*.js` を1ファイルずつ順番に開き、
 * 1) プレースホルダを第1工程のシリアライズ済み実データへ差し替え
 * 2) esbuild（省メモリC/Go製）で1チャンクずつ順番にミニファイして本番配信サイズを最小化する。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transformSync } from 'esbuild';

const CACHE_DIR = resolve(process.cwd(), '.vite-seq-cache');
const ASSETS_DIR = resolve(process.cwd(), 'dist/assets');
const MARKER_RE = /"__MANATOBI_SEQ_DATA__:([a-z0-9-]+):([A-Z0-9_]+)__"/g;

let replacedTotal = 0;
let minifiedCount = 0;

for (const fname of readdirSync(ASSETS_DIR).sort()) {
  if (!fname.endsWith('.js')) continue;
  const fullPath = resolve(ASSETS_DIR, fname);
  let code = readFileSync(fullPath, 'utf-8');

  if (code.includes('__MANATOBI_SEQ_DATA__:')) {
    code = code.replace(MARKER_RE, (_, key: string, expName: string) => {
      replacedTotal++;
      const rawJson = readFileSync(resolve(CACHE_DIR, `${key}__${expName}.json`), 'utf-8');
      return `JSON.parse(${JSON.stringify(rawJson)})`;
    });
    console.log(`[seq-step3] Injected serialized data into ${fname}`);
  }

  const minified = transformSync(code, {
    loader: 'js',
    minify: true,
    target: 'es2022',
    legalComments: 'none',
  });
  writeFileSync(fullPath, minified.code);
  minifiedCount++;
}

if (replacedTotal === 0) {
  throw new Error('No sequential placeholders were found in dist/assets/*.js');
}
console.log(`[seq-step3] Injected ${replacedTotal} dataset(s) and minified ${minifiedCount} JS chunks sequentially.`);
