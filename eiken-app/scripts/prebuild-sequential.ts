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

const aliasMap: Record<string, string> = {
  'lucide-react': lucideOut,
};

// Prebundle exact used Firebase symbols into ONE shared browser ESM (eliminates ~280 @firebase/* Rollup modules + 1.14MB common.esm.js!)
const firebaseSharedEntry = resolve(CACHE_DIR, '_firebase-shared-entry.js');
const firebaseSharedOut = resolve(CACHE_DIR, 'firebase-shared.mjs');
const fbAppSymbols = ['initializeApp', 'getApps'] as const;
const fbAuthSymbols = [
  'EmailAuthProvider',
  'FacebookAuthProvider',
  'GithubAuthProvider',
  'GoogleAuthProvider',
  'OAuthCredential',
  'OAuthProvider',
  'RecaptchaVerifier',
  'TwitterAuthProvider',
  'applyActionCode',
  'browserLocalPersistence',
  'browserPopupRedirectResolver',
  'browserSessionPersistence',
  'confirmPasswordReset',
  'connectAuthEmulator',
  'createUserWithEmailAndPassword',
  'deleteUser',
  'fetchSignInMethodsForEmail',
  'getAdditionalUserInfo',
  'getAuth',
  'getRedirectResult',
  'inMemoryPersistence',
  'indexedDBLocalPersistence',
  'initializeAuth',
  'isSignInWithEmailLink',
  'linkWithCredential',
  'linkWithPhoneNumber',
  'linkWithPopup',
  'linkWithRedirect',
  'onAuthStateChanged',
  'reload',
  'revokeAccessToken',
  'sendEmailVerification',
  'sendPasswordResetEmail',
  'sendSignInLinkToEmail',
  'setPersistence',
  'signInAnonymously',
  'signInWithCredential',
  'signInWithCustomToken',
  'signInWithEmailAndPassword',
  'signInWithEmailLink',
  'signInWithPhoneNumber',
  'signInWithPopup',
  'signInWithRedirect',
  'signOut',
  'unlink',
  'updateEmail',
  'updatePassword',
  'updateProfile',
  'verifyBeforeUpdateEmail',
] as const;
const fbFirestoreSymbols = [
  'getFirestore',
  'initializeFirestore',
  'connectFirestoreEmulator',
  'disableNetwork',
  'collection',
  'collectionGroup',
  'deleteDoc',
  'doc',
  'getDoc',
  'runTransaction',
  'serverTimestamp',
  'getDocs',
  'limit',
  'orderBy',
  'query',
  'setDoc',
  'deleteField',
  'onSnapshot',
  'updateDoc',
  'where',
  'getDocsFromServer',
  'startAfter',
  'Timestamp',
  'writeBatch',
  'addDoc',
  'documentId',
] as const;
const fbFunctionsSymbols = ['getFunctions', 'httpsCallable', 'connectFunctionsEmulator'] as const;

writeFileSync(
  firebaseSharedEntry,
  [
    `import { ${fbAppSymbols.join(', ')} } from 'firebase/app';`,
    `import { ${fbAuthSymbols.join(', ')} } from 'firebase/auth';`,
    `import { ${fbFirestoreSymbols.join(', ')} } from 'firebase/firestore';`,
    `import { ${fbFunctionsSymbols.join(', ')} } from 'firebase/functions';`,
    `export const __fb_app = { ${fbAppSymbols.join(', ')} };`,
    `export const __fb_auth = { ${fbAuthSymbols.join(', ')} };`,
    `export const __fb_firestore = { ${fbFirestoreSymbols.join(', ')} };`,
    `export const __fb_functions = { ${fbFunctionsSymbols.join(', ')} };`,
  ].join('\n') + '\n',
);
buildSync({
  entryPoints: [firebaseSharedEntry],
  outfile: firebaseSharedOut,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  treeShaking: true,
});
for (const [pkg, ns, syms] of [
  ['firebase/app', '__fb_app', fbAppSymbols],
  ['firebase/auth', '__fb_auth', fbAuthSymbols],
  ['firebase/firestore', '__fb_firestore', fbFirestoreSymbols],
  ['firebase/functions', '__fb_functions', fbFunctionsSymbols],
] as const) {
  const safeName = pkg.replace(/\//g, '__');
  const proxyEntry = resolve(CACHE_DIR, `${safeName}-proxy.mjs`);
  writeFileSync(
    proxyEntry,
    `import { ${ns} } from './firebase-shared.mjs';\n` +
      syms.map(k => `export const ${k} = ${ns}.${k};`).join('\n') +
      '\n',
  );
  aliasMap[pkg] = proxyEntry;
}
console.log('[seq-vendor] Prebundled tree-shaken firebase/{app,auth,firestore,functions} -> firebase-shared.mjs');

// Prebundle katex + mhchem together into a single ESM file (prevents duplicate 587KB katex.mjs load)
const katexEntry = resolve(CACHE_DIR, '_katex-entry.js');
const katexOut = resolve(CACHE_DIR, 'katex-prebundled.mjs');
const katexMhchemNoop = resolve(CACHE_DIR, 'katex-mhchem-noop.mjs');
writeFileSync(
  katexEntry,
  `import katex from 'katex'; import 'katex/dist/contrib/mhchem.mjs'; export default katex; export * from 'katex';\n`,
);
buildSync({
  entryPoints: [katexEntry],
  outfile: katexOut,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
});
writeFileSync(katexMhchemNoop, `import './katex-prebundled.mjs';\n`);
aliasMap['katex'] = katexOut;
aliasMap['katex/dist/contrib/mhchem.mjs'] = katexMhchemNoop;
console.log('[seq-vendor] Prebundled katex + mhchem -> katex-prebundled.mjs');

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
  { key: 'chapter-index', importPath: './src/data/chapterIndex.generated.ts', exports: ['SUBJECT_INDEX', 'SUBJECT_STATS'] },
  { key: 'listening-images', importPath: './src/eiken/listeningImages.generated.ts', exports: ['LISTENING_IMAGE_URLS'] },
  { key: 'listening-audio', importPath: './src/eiken/listeningAudio.generated.ts', exports: ['LISTENING_AUDIO_URLS'] },
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
