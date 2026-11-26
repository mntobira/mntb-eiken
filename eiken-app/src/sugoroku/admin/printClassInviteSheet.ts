/**
 * ============================================================================
 * クラス招待シート A4印刷・画面提示ジェネレーター
 * ============================================================================
 * 塾の教室配布プリント・初回面談・授業スライド提示にそのまま使える
 * 白黒/カラー両対応のA4招待案内シートを生成する。
 */

import type { ClassroomDoc } from '../../utils/classroomCore';
import { getGradeLabel } from './adminAnalytics';
import {
  buildClassInviteUrl,
  FOCUS_SKILL_OPTIONS,
  getExamSessionShortLabel,
  type JukuClassSettings,
} from './classroomSettings';

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildClassInviteSheetHtml(params: {
  room: ClassroomDoc;
  settings: JukuClassSettings;
  origin?: string;
}): string {
  const { room, settings, origin } = params;
  const inviteUrl = buildClassInviteUrl(room.joinCode, origin);
  const codeChars = String(room.joinCode || '')
    .trim()
    .toUpperCase()
    .split('');
  const weeklyMin = settings.dailyGoalMinutes * settings.weeklyGoalDays;
  const sessionLabel = getExamSessionShortLabel(settings.examSession);
  const isAllGrades = room.className.includes('全級');
  const gradeSummary = isAllGrades ? '英検5級〜1級（全級一括対応）' : getGradeLabel(room.subject);
  const skills = settings.focusSkills
    .map((k) => FOCUS_SKILL_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(' ・ ');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>クラス参加のご案内 - ${escapeHtml(room.className)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif;
      color: #1b2631;
      background: #f5f3ee;
      line-height: 1.55;
    }
    .sheet {
      max-width: 740px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #1b2631;
      border-radius: 18px;
      padding: 28px 30px;
    }
    .toolbar {
      max-width: 740px;
      margin: 0 auto 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .toolbar button {
      padding: 9px 18px;
      border-radius: 10px;
      border: 1px solid #1b2631;
      background: #1b2631;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .toolbar button.sub {
      background: #fff;
      color: #1b2631;
    }
    .kicker {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      border: 1.5px solid #1b2631;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 0.01em;
    }
    .org {
      font-size: 14px;
      font-weight: 700;
      color: #4b5563;
      margin: 0 0 18px;
    }
    .code-panel {
      border: 2.5px solid #1b2631;
      border-radius: 16px;
      padding: 18px 20px;
      text-align: center;
      background: #faf8f2;
      margin-bottom: 18px;
    }
    .code-label {
      font-size: 13px;
      font-weight: 800;
      color: #374151;
      margin-bottom: 10px;
    }
    .code-boxes {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .code-box {
      width: 56px;
      height: 66px;
      border: 2.5px solid #1b2631;
      border-radius: 12px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 32px;
      font-weight: 900;
      color: #1b2631;
    }
    .url-box {
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: #fff;
      border: 1px dashed #6b7280;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 18px;
    }
    .meta-item {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 10px 14px;
    }
    .meta-item small {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
    }
    .meta-item strong {
      font-size: 14px;
      font-weight: 800;
    }
    .steps {
      border: 1.5px solid #1b2631;
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 16px;
    }
    .steps h2 {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 800;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
      font-size: 13px;
    }
    .steps li {
      margin-bottom: 6px;
    }
    .note-box {
      border-radius: 12px;
      background: #f4f7fa;
      border: 1px solid #cbd5e1;
      padding: 12px 14px;
      font-size: 12px;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border-width: 2px; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="sub" onclick="window.close()">閉じる</button>
    <button type="button" onclick="window.print()">A4で印刷 / PDF保存</button>
  </div>
  <main class="sheet">
    <span class="kicker">${room.plan === 'juku' ? 'マナトビ英検 塾生専用クラス招待状（広告完全非表示）' : 'マナトビ英検 クラス参加シート'}</span>
    <h1>${escapeHtml(room.className)}</h1>
    <p class="org">${escapeHtml(room.schoolName)}</p>

    <section class="code-panel">
      <div class="code-label">クラス招待コード（6文字・大文字小文字どちらでも可）</div>
      <div class="code-boxes">
        ${codeChars.map((ch) => `<div class="code-box">${escapeHtml(ch)}</div>`).join('')}
      </div>
      <div style="font-size:11px;color:#4b5563;">※ 見間違えやすい 0 と O、1 と I は自動補正されます</div>
      <div class="url-box">直行URL：${escapeHtml(inviteUrl)}</div>
    </section>

    <section class="meta-grid">
      <div class="meta-item">
        <small>対象級・受験目標</small>
        <strong>${escapeHtml(gradeSummary)} ／ ${escapeHtml(sessionLabel)}</strong>
      </div>
      <div class="meta-item">
        <small>推奨学習ペース目安</small>
        <strong>1日${settings.dailyGoalMinutes}分 × 週${settings.weeklyGoalDays}日（週${weeklyMin}分）</strong>
      </div>
      ${
        skills
          ? `<div class="meta-item" style="grid-column:1 / -1;">
        <small>重点トレーニング分野</small>
        <strong>${escapeHtml(skills)}</strong>
      </div>`
          : ''
      }
    </section>

    <section class="steps">
      <h2>参加手順（iPad・スマホ・PC 共通／約30秒）</h2>
      <ol>
        <li><strong>Safari</strong> または <strong>Chrome</strong> で上の直行URLを開く（またはマナトビ英検アプリを開く）</li>
        <li><strong>Google アカウントでログイン</strong>（学校配布 iPad アカウント・個人 Gmail のどちらでも利用可）</li>
        <li>「設定 ＞ クラス」から招待コード <strong>${escapeHtml(room.joinCode)}</strong> を入力（直行URLからは自動入力）して<strong>参加完了</strong>！</li>
      </ol>
    </section>

    <section class="note-box">
      <strong>保護者の方・生徒のみなさんへ（プライバシー保護について）</strong><br />
      ・日々の学習時間、単元の進捗・正答率、先生との1対1チャット、英作文・スピーキング録音は担当の先生のみが確認できます。<br />
      ・一般公開のランキング等に本名（名簿名）が表示されることは一切ありません。${
        settings.coachNote ? `<br />・先生より：${escapeHtml(settings.coachNote)}` : ''
      }
    </section>
  </main>
</body>
</html>`;
}

export function openClassInviteSheetPrint(params: {
  room: ClassroomDoc;
  settings: JukuClassSettings;
}): boolean {
  if (typeof window === 'undefined') return false;
  const html = buildClassInviteSheetHtml(params);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
