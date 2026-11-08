import { loadEnv } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { validateEikenTarget } from '../src/eiken/config.ts';

const production = process.argv.includes('--production');
const mode = production ? 'eiken.production' : 'eiken';
const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
function fail(message) { console.error(message); process.exit(1); }
try {
  validateEikenTarget(env);
  if (env.VITE_EIKEN_USE_EMULATORS === 'true' && production) fail('本番配信にEmulatorは使用できません。');
  if (env.EIKEN_BASE_PATH && env.EIKEN_BASE_PATH !== '/' && production) fail('Vercelの配信パスは / を指定してください。');
  const expected = env.EIKEN_EXPECTED_VERCEL_PROJECT_ID;
  if (existsSync('.vercel/project.json')) {
    const linked = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
    if (!expected || linked.projectId !== expected) fail('英検専用と確認できないVercelリンクがあるため停止しました。');
  }
  if (expected && env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== expected) fail('VercelプロジェクトIDが英検版の指定と一致しません。');
  console.log(`Eiken target guard passed: ${env.VITE_EIKEN_ENABLE_CLOUD === 'true' ? 'cloud configured' : 'local-only learning'}. No deployment or cloud writes performed.`);
} catch (error) {
  fail(error.message);
}
