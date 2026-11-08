import { loadEnv } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const env = { ...loadEnv('eiken', process.cwd(), ''), ...process.env };
function fail(message) { console.error(message); process.exit(1); }
if (Object.keys(env).some(key => key.startsWith('VITE_FIREBASE_') && env[key])) fail('旧版のVITE_FIREBASE_*が混在しているためビルドを停止しました。');
if (existsSync('.vercel/project.json')) {
  const linked = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
  if (!env.EIKEN_EXPECTED_VERCEL_PROJECT_ID || linked.projectId !== env.EIKEN_EXPECTED_VERCEL_PROJECT_ID) fail('英検専用と確認できないVercelリンクがあるため停止しました。');
}
const project = env.VITE_EIKEN_FIREBASE_PROJECT_ID || '';
if (project && !/^manatobi-eiken(?:-[a-z0-9-]+)?$/.test(project)) fail('Firebaseはmanatobi-eikenまたはmanatobi-eiken-*専用プロジェクトを指定してください。');
if (process.argv.includes('--production')) {
  if (env.VITE_EIKEN_ENABLE_CLOUD !== 'true') fail('本番ビルドには英検専用Firebaseの接続確認が必要です。ローカル確認はbuild:demoを使用してください。');
  for (const name of ['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID']) {
    if (!env['VITE_EIKEN_FIREBASE_' + name]) fail('英検専用Firebaseの環境変数が不足しています: ' + name);
  }
  if (!env.EIKEN_EXPECTED_VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID !== env.EIKEN_EXPECTED_VERCEL_PROJECT_ID) fail('英検版VercelのプロジェクトID確認が必要です。');
}
console.log('Eiken target guard passed; no deployment or cloud writes performed.');
