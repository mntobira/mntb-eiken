/**
 * 第3工程（順次チャンク注入＋esbuild 1ファイルずつ順番ミニファイ＋public静的アセット順序コピー）：
 * 1) Vite本体のOOMを防ぐため copyPublicDir: false でRollupを先に終了させる
 * 2) 生成された `dist/assets/*.js` を1ファイルずつ順番に開き、プレースホルダ差し替え＆esbuildミニファイ
 * 3) `public/` 配下の静的ファイルを `dist/` へ順番にコピーする
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { transformSync } from 'esbuild';

const ROOT = process.cwd();
const CACHE_DIR = resolve(ROOT, '.vite-seq-cache');
const DIST_DIR = resolve(ROOT, 'dist');
const ASSETS_DIR = resolve(DIST_DIR, 'assets');
const PUBLIC_DIR = resolve(ROOT, 'public');
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

function copyDirSequential(srcDir: string, dstDir: string): number {
  mkdirSync(dstDir, { recursive: true });
  let count = 0;
  for (const name of readdirSync(srcDir)) {
    const srcPath = join(srcDir, name);
    const dstPath = join(dstDir, name);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      count += copyDirSequential(srcPath, dstPath);
    } else {
      copyFileSync(srcPath, dstPath);
      count++;
    }
  }
  return count;
}

const copiedFiles = copyDirSequential(PUBLIC_DIR, DIST_DIR);
console.log(`[seq-step3] Injected ${replacedTotal} dataset(s), minified ${minifiedCount} JS chunks, and copied ${copiedFiles} public files sequentially.`);
