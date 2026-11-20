import { EIKEN_GRADES } from '../../eiken/config';
import { wordCount } from '../../eiken/writingProgress';
import type { SugorokuWritingSubmissionDoc } from '../shared/types';
import { computeEnglishDiff } from './diffHighlight';

export interface FeedbackSheetOptions {
  schoolName?: string;
  taskTitle?: string;
  instruction?: string;
  targetWordsLabel?: string;
  modelAnswer?: string;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTimeJp(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '―';
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function renderDiffMarkup(original: string, corrected: string): string {
  const segments = computeEnglishDiff(original, corrected);
  return segments
    .map(seg => {
      const safe = escapeHtml(seg.text);
      if (seg.kind === 'removed') {
        return `<del class="diff-del">${safe}</del>`;
      }
      if (seg.kind === 'added') {
        return `<ins class="diff-ins">${safe}</ins>`;
      }
      return safe;
    })
    .join('');
}

/**
 * A4 白黒印刷・PDF保存に最適化された『ライティング添削フィードバックシート』HTMLを生成する。
 * 次回授業での配布・家庭学習での書き直し復習にそのまま使える高コントラスト設計（単語単位の添削差分表示付き）。
 */
export function buildFeedbackSheetHtml(
  submission: SugorokuWritingSubmissionDoc,
  options?: FeedbackSheetOptions,
): string {
  const gradeLabel =
    EIKEN_GRADES.find(g => g.id === submission.grade)?.label ?? submission.grade;
  const schoolLabel = options?.schoolName || 'オンライン個別指導「すごろく」 × マナトビ英検';
  const taskTitle = options?.taskTitle || submission.taskTitle || submission.taskKey;
  const review = submission.review;
  const rubric = review?.rubricScores;
  const maxScore = review?.maxScore ?? 16;
  const correctedWords = review?.correctedText ? wordCount(review.correctedText) : 0;
  const hasDistinctCorrection =
    Boolean(review?.correctedText) &&
    review!.correctedText!.trim() !== submission.text.trim();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>英検ライティング添削フィードバックシート_${escapeHtml(submission.studentName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 11mm 13mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 18px;
      font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
      color: #111111;
      background: #f5f5f5;
      line-height: 1.52;
      font-size: 10pt;
    }
    .toolbar {
      max-width: 190mm;
      margin: 0 auto 14px;
      padding: 10px 14px;
      background: #ffffff;
      border: 1.5px solid #222222;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .toolbar button {
      padding: 8px 16px;
      border: 1.5px solid #111111;
      border-radius: 6px;
      background: #111111;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .toolbar button.secondary {
      background: #ffffff;
      color: #111111;
    }
    .sheet {
      max-width: 190mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 11mm 12mm;
      border: 1px solid #cccccc;
    }
    .sheet-header {
      border-bottom: 2.5px solid #111111;
      padding-bottom: 7px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .sheet-brand {
      font-size: 8.8pt;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .sheet-title {
      font-size: 15pt;
      font-weight: 800;
      margin: 2px 0 0;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9.2pt;
    }
    .meta-table th,
    .meta-table td {
      border: 1px solid #222222;
      padding: 4px 8px;
      text-align: left;
    }
    .meta-table th {
      background: #eeeeee;
      width: 17%;
      font-weight: 700;
    }
    .score-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 9.2pt;
    }
    .score-grid th,
    .score-grid td {
      border: 1px solid #222222;
      padding: 4px 6px;
      text-align: center;
    }
    .score-grid th {
      background: #eeeeee;
      font-weight: 700;
    }
    .score-total {
      font-size: 12.5pt;
      font-weight: 800;
    }
    .section-box {
      border: 1.2px solid #222222;
      border-radius: 4px;
      padding: 7px 10px;
      margin-bottom: 9px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 9.8pt;
      font-weight: 800;
      border-bottom: 1px solid #444444;
      padding-bottom: 3px;
      margin: 0 0 6px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .en-text {
      font-family: "Times New Roman", Georgia, serif;
      font-size: 10.8pt;
      line-height: 1.65;
      white-space: pre-wrap;
      margin: 0;
    }
    .diff-del {
      text-decoration: line-through;
      color: #444444;
      background: #eeeeee;
      padding: 0 2px;
      margin-right: 2px;
    }
    .diff-ins {
      text-decoration: none;
      font-weight: 700;
      border-bottom: 2px solid #111111;
      padding: 0 2px;
    }
    .jp-text {
      font-size: 9.5pt;
      line-height: 1.58;
      white-space: pre-wrap;
      margin: 0;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .warn-list {
      margin: 4px 0 0;
      padding-left: 18px;
      font-size: 8.8pt;
    }
    .rewrite-lines {
      margin-top: 4px;
    }
    .rewrite-line {
      height: 21px;
      border-bottom: 1px dashed #666666;
    }
    .footer-note {
      margin-top: 6px;
      font-size: 8.2pt;
      color: #333333;
      text-align: right;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .toolbar {
        display: none !important;
      }
      .sheet {
        max-width: none;
        padding: 0;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>A4白黒印刷 / PDF保存プレビュー</strong>（印刷ダイアログで「PDFに保存」も選べます）</div>
    <div style="display:flex;gap:8px;">
      <button type="button" onclick="window.print()">印刷 ／ PDFとして保存</button>
      <button type="button" class="secondary" onclick="window.close()">閉じる</button>
    </div>
  </div>

  <main class="sheet">
    <header class="sheet-header">
      <div>
        <div class="sheet-brand">${escapeHtml(schoolLabel)}</div>
        <h1 class="sheet-title">英検ライティング 添削フィードバックシート</h1>
      </div>
      <div style="text-align:right;font-size:8.8pt;">
        提出日時：${escapeHtml(formatDateTimeJp(submission.submittedAt))}<br />
        添削返却：${escapeHtml(formatDateTimeJp(review?.reviewedAt))}
      </div>
    </header>

    <table class="meta-table">
      <tr>
        <th>生徒氏名</th>
        <td><strong>${escapeHtml(submission.studentName)}</strong></td>
        <th>対象級</th>
        <td>${escapeHtml(gradeLabel)}</td>
      </tr>
      <tr>
        <th>課題名</th>
        <td>${escapeHtml(taskTitle)}</td>
        <th>担当講師</th>
        <td>${escapeHtml(review?.reviewerName || 'すごろく英検指導担当')}</td>
      </tr>
    </table>

    <table class="score-grid">
      <thead>
        <tr>
          <th>① 内容 (Content)</th>
          <th>② 構成 (Structure)</th>
          <th>③ 語彙 (Vocabulary)</th>
          <th>④ 文法 (Grammar)</th>
          <th>総合スコア</th>
          <th>提出語数</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${rubric ? `${rubric.content} / 4` : '― / 4'}</td>
          <td>${rubric ? `${rubric.structure} / 4` : '― / 4'}</td>
          <td>${rubric ? `${rubric.vocabulary} / 4` : '― / 4'}</td>
          <td>${rubric ? `${rubric.grammar} / 4` : '― / 4'}</td>
          <td class="score-total">${review ? `${review.score} / ${maxScore}` : `未採点 / ${maxScore}`}</td>
          <td><strong>${submission.wordCount}</strong> words${
    options?.targetWordsLabel
      ? `<br /><span style="font-size:7.8pt;">(${escapeHtml(options.targetWordsLabel)})</span>`
      : ''
  }</td>
        </tr>
      </tbody>
    </table>

    ${
      options?.instruction
        ? `<section class="section-box">
      <h2 class="section-title"><span>課題テーマ・指示文</span></h2>
      <p class="jp-text">${escapeHtml(options.instruction)}</p>
    </section>`
        : ''
    }

    <section class="section-box">
      <h2 class="section-title">
        <span>1. あなたの提出英文（Original Answer）</span>
        <span>${submission.wordCount} words</span>
      </h2>
      <p class="en-text" lang="en">${escapeHtml(submission.text)}</p>
      ${
        submission.formatWarnings.length > 0
          ? `<ul class="warn-list">${submission.formatWarnings
              .map(w => `<li>形式チェック記録：${escapeHtml(w)}</li>`)
              .join('')}</ul>`
          : ''
      }
    </section>

    ${
      hasDistinctCorrection
        ? `<section class="section-box">
      <h2 class="section-title">
        <span>2. 添削箇所の比較（取り消し線＝削除 ／ 太字下線＝修正・追加）</span>
        <span>Before → After</span>
      </h2>
      <p class="en-text" lang="en">${renderDiffMarkup(submission.text, review!.correctedText!)}</p>
    </section>`
        : ''
    }

    ${
      review?.correctedText
        ? `<section class="section-box">
      <h2 class="section-title">
        <span>${hasDistinctCorrection ? '3.' : '2.'} 完成版モデル英文（Corrected Clean Version）</span>
        <span>${correctedWords} words</span>
      </h2>
      <p class="en-text" lang="en">${escapeHtml(review.correctedText)}</p>
    </section>`
        : ''
    }

    <section class="section-box">
      <h2 class="section-title"><span>${hasDistinctCorrection ? '4.' : '3.'} 先生からの講評・アドバイス</span></h2>
      <p class="jp-text">${escapeHtml(review?.comment || '（添削コメント記入欄）')}</p>
      ${
        review?.strengths || review?.nextActions
          ? `<div class="two-col" style="margin-top:7px;">
          <div style="border-top:1px dotted #555;padding-top:4px;">
            <strong>◎ 良かったポイント</strong>
            <p class="jp-text">${escapeHtml(review?.strengths || '―')}</p>
          </div>
          <div style="border-top:1px dotted #555;padding-top:4px;">
            <strong>▶ 次回意識するアクション</strong>
            <p class="jp-text">${escapeHtml(review?.nextActions || '―')}</p>
          </div>
        </div>`
          : ''
      }
    </section>

    <section class="section-box">
      <h2 class="section-title"><span>復習・清書トレーニング欄（直した表現を声に出しながら書いてみよう）</span></h2>
      <div class="rewrite-lines">
        <div class="rewrite-line"></div>
        <div class="rewrite-line"></div>
        <div class="rewrite-line"></div>
      </div>
    </section>

    <div class="footer-note">マナトビ英検 × すごろく 個別指導サポートシート（A4白黒印刷対応）</div>
  </main>
</body>
</html>`;
}

export function openFeedbackSheetPrintWindow(
  submission: SugorokuWritingSubmissionDoc,
  options?: FeedbackSheetOptions,
): boolean {
  if (typeof window === 'undefined') return false;
  const html = buildFeedbackSheetHtml(submission, options);

  const win = window.open('', '_blank', 'width=920,height=980');
  if (win && win.document) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = `添削シート_${submission.studentName.replace(/[\\/:*?"<>|]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  } catch {
    return false;
  }
}
