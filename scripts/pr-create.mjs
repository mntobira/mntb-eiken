#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const usage = `使い方: npm run pr:create -- --title "タイトル" --body-file /path/to/body.md [--base main] [--draft]

PR本文には「リスニング納品の判断」の欄が必要です。`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) fail(`${command} を実行できません: ${result.error.message}`);
  if (result.status !== 0) {
    if (capture && result.stderr) process.stderr.write(result.stderr);
    fail(`${command} が終了コード ${result.status} で失敗しました`);
  }
  return capture ? result.stdout.trim() : '';
}

const args = process.argv.slice(2);
let title = '';
let bodyFile = '';
let base = 'main';
let draft = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log(usage);
    process.exit(0);
  }
  if (arg === '--draft') { draft = true; continue; }
  if (arg === '--title' || arg === '--body-file' || arg === '--base') {
    const value = args[++i];
    if (!value || value.startsWith('--')) fail(`${arg} の値が必要です`);
    if (arg === '--title') title = value;
    if (arg === '--body-file') bodyFile = value;
    if (arg === '--base') base = value;
    continue;
  }
  fail(`不明な引数です: ${arg}\n${usage}`);
}
if (!title || !bodyFile) fail(`--title と --body-file が必要です\n${usage}`);

let body;
try { body = readFileSync(bodyFile, 'utf8').trim(); }
catch (error) { fail(`PR本文ファイルを読めません: ${error.message}`); }
if (!body.includes('リスニング納品の判断')) {
  fail('PR本文に必須欄「リスニング納品の判断」がありません');
}

const branch = run('git', ['branch', '--show-current'], { capture: true });
if (!branch || branch === base) fail(`${base} 以外の作業ブランチから実行してください`);
const dirty = run('git', ['status', '--porcelain'], { capture: true });
if (dirty) fail('未コミット変更があります。先に変更をコミットしてください');

console.log(`… ${branch} を origin へ push`);
run('git', ['push', '-u', 'origin', `HEAD:${branch}`]);
const existing = run('gh', ['pr', 'list', '--state', 'open', '--head', branch, '--json', 'number', '--jq', '.[0].number // empty'], { capture: true });
const bodyPath = bodyFile.startsWith('/') ? bodyFile : `${process.cwd()}/${bodyFile}`;
if (existing) {
  run('gh', ['pr', 'edit', existing, '--title', title, '--body-file', bodyPath]);
  console.log(`✓ 既存PR #${existing} のタイトルと本文を更新しました`);
} else {
  const createArgs = ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body-file', bodyPath];
  if (draft) createArgs.push('--draft');
  run('gh', createArgs);
}
