/**
 * 低メモリ環境（1GB RAM サンドボックス等）でも安定して全 785 ファイルの型検査を完走するランナー。
 * 各フェーズを単一 Node サブプロセス（~580MB ピーク）で順次実行・解放することで、
 * 親子2プロセス同時確保や全ファイル型キャッシュ累積による V8 GC スラッシングを防ぐ。
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const phase = process.argv[2];

if (!phase) {
  const self = fileURLToPath(import.meta.url);
  for (const p of ['sugoroku', 'components', 'hooks_utils', 'data']) {
    execFileSync(
      process.execPath,
      ['--max-old-space-size=680', '--max-semi-space-size=8', self, p],
      { stdio: 'inherit' },
    );
  }
  console.log('Full typecheck passed across all 4 phases (0 errors).');
  process.exit(0);
}

const ts = (await import('typescript')).default;

const cfgPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
if (!cfgPath) {
  console.error('tsconfig.json not found');
  process.exit(1);
}

const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, './');
const prog = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });

const formatHost = {
  getCanonicalFileName: (f) => f,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};

const isHooksUtils = (f) =>
  f.includes('src/hooks/') ||
  f.includes('src/utils/') ||
  f.includes('src/features/') ||
  f.includes('src/motion/');

const match =
  phase === 'sugoroku'
    ? (f) => f.includes('src/sugoroku/')
    : phase === 'components'
      ? (f) => f.includes('src/components/')
      : phase === 'hooks_utils'
        ? isHooksUtils
        : (f) =>
            !f.includes('src/sugoroku/') &&
            !f.includes('src/components/') &&
            !isHooksUtils(f);

let checked = 0;
let errors = 0;

for (const file of parsed.fileNames.filter(match)) {
  const sf = prog.getSourceFile(file);
  if (!sf) continue;
  checked += 1;
  const diags = [...prog.getSyntacticDiagnostics(sf), ...prog.getSemanticDiagnostics(sf)];
  if (diags.length > 0) {
    errors += diags.length;
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diags, formatHost));
  }
}

console.log(`[typecheck:${phase}] ${checked} files checked, ${errors} error(s).`);
process.exit(errors > 0 ? 1 : 0);
