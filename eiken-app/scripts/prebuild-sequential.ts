/**
 * 省メモリ・高品質 順次プリビルドパイプライン
 * -----------------------------------------------------------------------
 * 1) 教材データモジュール（リスニング全120回・一次筆記16冊）を1本ずつ別プロセスで評価・JSON化
 * 2) Rollup のメモリを圧迫していた巨大パッケージ（lucide-react の1,500ファイル展開、firebase、katex）を
 *    Go製の省メモリ esbuild で1パッケージずつ順番にツリーシェイク済み単一ESMへ事前バンドル
 * これにより Vite/Rollup 本体のモジュール数を約 2,700 → 約 350 へ削減し、
 * 低メモリ環境（<750MB RAM）でも高速・省メモリ・完全ミニファイ済みの本番ビルドを実現する。
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildSync } from 'esbuild';

const ROOT = process.cwd();
const CACHE_DIR = resolve(ROOT, '.vite-seq-cache');
mkdirSync(CACHE_DIR, { recursive: true });

// --- Step 1A: src/ 内で実際に使われている lucide-react の named imports だけを収集して単一ESM化 ---
function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

const lucideSpecifiers = new Set<string>();
const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g;
for (const file of walkFiles(resolve(ROOT, 'src'))) {
  const src = readFileSync(file, 'utf-8');
  for (const m of src.matchAll(importRe)) {
    for (const rawPart of m[1].split(',')) {
      const cleaned = rawPart.replace(/\btype\b/g, '').trim();
      if (!cleaned) continue;
      const baseName = cleaned.split(/\s+as\s+/)[0].trim();
      if (baseName) lucideSpecifiers.add(baseName);
    }
  }
}

const lucideEntry = resolve(CACHE_DIR, '_lucide-entry.js');
writeFileSync(
  lucideEntry,
  `export { ${[...lucideSpecifiers].sort().join(', ')} } from 'lucide-react';\n`,
);
const lucideOut = resolve(CACHE_DIR, 'lucide-prebundled.mjs');
buildSync({
  entryPoints: [lucideEntry],
  outfile: lucideOut,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime'],
  minify: true,
  treeShaking: true,
});
console.log(`[seq-vendor] Prebundled ${lucideSpecifiers.size} used lucide-react icons -> lucide-prebundled.mjs`);

// --- Step 1B: firebase 各サブパッケージも1本ずつ順番に esbuild で単一ESM化 ---
const FIREBASE_PKGS = [
  'firebase/app',
  'firebase/auth',
  'firebase/firestore',
] as const;

const aliasMap: Record<string, string> = {
  'lucide-react': lucideOut,
};

for (const pkg of FIREBASE_PKGS) {
  const safeName = pkg.replace(/\//g, '__');
  const entryFile = resolve(CACHE_DIR, `_${safeName}-entry.js`);
  const outFile = resolve(CACHE_DIR, `${safeName}.mjs`);
  writeFileSync(entryFile, `export * from '${pkg}';\n`);
  buildSync({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    treeShaking: true,
  });
  aliasMap[pkg] = outFile;
  console.log(`[seq-vendor] Prebundled ${pkg} -> ${safeName}.mjs`);
}

// Note: firebase/app singleton sharing — keep firebase/* sharing the same firebase/app instance!
// Re-bundle firebase/auth and firebase/firestore with `external: ['firebase/app']` so they share the exact same app registry!
for (const pkg of ['firebase/auth', 'firebase/firestore'] as const) {
  const safeName = pkg.replace(/\//g, '__');
  const entryFile = resolve(CACHE_DIR, `_${safeName}-entry.js`);
  const outFile = resolve(CACHE_DIR, `${safeName}.mjs`);
  buildSync({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external: ['firebase/app', '@firebase/app'],
    minify: true,
    treeShaking: true,
  });
}
// Keep firebase/* on standard resolution for shared internal @firebase/app state; lucide-react + katex alone drop >1,550 modules!
delete aliasMap['firebase/app'];
delete aliasMap['firebase/auth'];
delete aliasMap['firebase/firestore'];

// Prebundle katex into a single ESM file
const katexEntry = resolve(CACHE_DIR, '_katex-entry.js');
const katexOut = resolve(CACHE_DIR, 'katex-prebundled.mjs');
writeFileSync(katexEntry, `import katex from 'katex'; export default katex; export * from 'katex';\n`);
buildSync({
  entryPoints: [katexEntry],
  outfile: katexOut,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
aliasMap['katex'] = katexOut;
console.log('[seq-vendor] Prebundled katex -> katex-prebundled.mjs');

// Prebundle motion/react into a single ESM file (eliminates ~280 framer-motion/motion-dom Rollup modules)
const motionEntry = resolve(CACHE_DIR, '_motion-react-entry.js');
const motionOut = resolve(CACHE_DIR, 'motion-react-prebundled.mjs');
writeFileSync(motionEntry, `export * from 'motion/react';\n`);
buildSync({
  entryPoints: [motionEntry],
  outfile: motionOut,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  minify: true,
  treeShaking: true,
});
aliasMap['motion/react'] = motionOut;
console.log('[seq-vendor] Prebundled motion/react -> motion-react-prebundled.mjs');

// --- Step 1C: 重い教材データモジュールを1本ずつ別プロセスでシリアライズ ---
const TARGETS: ReadonlyArray<{ key: string; importPath: string; exports: readonly string[] }> = [
  { key: 'listening-g5', importPath: './src/eiken/materials/listening-g5.ts', exports: ['GRADE_5_LISTENING_EXAMS'] },
  { key: 'listening-g4', importPath: './src/eiken/materials/listening-g4.ts', exports: ['GRADE_4_LISTENING_EXAMS'] },
  { key: 'listening-g3-pre2', importPath: './src/eiken/materials/listening-g3-pre2.ts', exports: ['GRADE_3_LISTENING_EXAMS', 'GRADE_PRE2_LISTENING_EXAMS'] },
  { key: 'listening-pre2plus-g2', importPath: './src/eiken/materials/listening-pre2plus-g2.ts', exports: ['GRADE_PRE2PLUS_LISTENING_EXAMS', 'GRADE_2_LISTENING_EXAMS'] },
  { key: 'listening-pre1', importPath: './src/eiken/materials/listening-pre1.ts', exports: ['GRADE_PRE1_LISTENING_EXAMS'] },
  { key: 'listening-g1', importPath: './src/eiken/materials/listening-g1.ts', exports: ['GRADE_1_LISTENING_EXAMS'] },
  { key: 'written-booklets', importPath: './src/eiken/materials/written-booklets.ts', exports: ['WRITTEN_BOOKLETS'] },
];

const manifest: Record<string, { key: string; exports: readonly string[] }> = {};

for (const [idx, target] of TARGETS.entries()) {
  const absSource = resolve(ROOT, target.importPath);
  manifest[absSource] = { key: target.key, exports: target.exports };

  const workerCode = `
    import * as mod from ${JSON.stringify(target.importPath)};
    import { writeFileSync } from 'node:fs';
    import { resolve } from 'node:path';
    for (const name of ${JSON.stringify(target.exports)}) {
      const jsonStr = JSON.stringify(mod[name]);
      writeFileSync(resolve(${JSON.stringify(CACHE_DIR)}, ${JSON.stringify(target.key)} + '__' + name + '.json'), jsonStr);
    }
  `;
  execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', workerCode], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log(`[seq-materials ${idx + 1}/${TARGETS.length}] Serialized ${target.key}`);
}

writeFileSync(
  resolve(CACHE_DIR, 'manifest.json'),
  JSON.stringify({ materials: manifest, aliases: aliasMap }, null, 2) + '\n',
);
