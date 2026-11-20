import { EIKEN_GRADES } from '../../eiken/config';
import type { SugorokuSpeakingSubmissionDoc } from '../shared/types';
import { SCBT_PART_LABELS, SCBT_PART_ORDER, type ScbtSpeakingSet } from './speakingTypes';

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
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * 講師手元AI（Gemini / ChatGPT）へ貼れる S-CBT スピーキング講評作成補助プロンプト
 */
export function buildSpeakingAiCoachPrompt(
  submission: SugorokuSpeakingSubmissionDoc,
  set?: ScbtSpeakingSet,
  scores?: Record<string, number>,
  memoNotes?: string,
): string {
  const gradeLabel =
    EIKEN_GRADES.find(g => g.id === submission.grade)?.label ?? submission.grade;
  const s = scores ?? submission.review?.rubricScores ?? {};

  const lines: string[] = [
    `あなたはオンライン個別指導塾「すごろく」の英検S-CBTスピーキング担当講師アシスタントです。`,
    `以下の高校生（${submission.studentName} さん）が取り組んだ【${gradeLabel} S-CBTスピーキング模擬録音】に対する講師の採点メモをもとに、生徒が次の練習で自信を持って改善できる温かいフィードバックコメント（200〜350字程度）を作成してください。`,
    ``,
    `■ 演習セット：${set?.title || submission.setTitle || submission.setId}`,
    `■ パート別スコア：`,
    `- パッセージ音読：${s.reading_aloud ?? '-'} / 5`,
    `- No.1（本文質問）：${s.q1 ?? '-'} / 5`,
    `- No.2（イラスト描写）：${s.q2 ?? '-'} / ${set?.questions[1]?.maxScore ?? 10}`,
    `- No.3：${s.q3 ?? '-'} / 5`,
    `- No.4：${s.q4 ?? '-'} / ${set?.questions[3]?.maxScore ?? 5}`,
    `- アティチュード：${s.attitude ?? '-'} / 3`,
  ];

  if (memoNotes?.trim()) {
    lines.push(``, `■ 講師の聴取メモ：`, memoNotes.trim());
  }

  if (set) {
    lines.push(
      ``,
      `■ 各パートの模範解答（指導基準）：`,
      `- 音読パッセージ：${set.passage}`,
      ...set.questions.map(q => `- ${q.numberLabel} 模範解答：${q.modelAnswer}`),
    );
  }

  lines.push(
    ``,
    `■ 出力してほしい内容：`,
    `1. 声の聞き取りやすさや取り組めたパートへの具体的な褒め言葉`,
    `2. 次回のS-CBT録音練習で意識する最重要改善ポイント（時制・文の組み立て・発音など2点に絞る）`,
    `3. 自宅での声出し反復（音読3回＋模範解答シャドーイング）への励まし一言`,
  );

  return lines.join('\n');
}

/**
 * S-CBT スピーキング評価＆自宅音読復習用 A4白黒フィードバックシート HTML を生成する
 */
export function buildSpeakingFeedbackSheetHtml(
  submission: SugorokuSpeakingSubmissionDoc,
  set?: ScbtSpeakingSet,
  schoolName?: string,
): string {
  const gradeLabel =
    EIKEN_GRADES.find(g => g.id === submission.grade)?.label ?? submission.grade;
  const headerBrand = schoolName || 'オンライン個別指導「すごろく」 × マナトビ英検';
  const review = submission.review;
  const scores = review?.rubricScores ?? {};
  const totalScore = Object.values(scores).reduce(
    (sum, v) => sum + (Number.isFinite(v) ? v : 0),
    0,
  );
  const maxTotal =
    5 +
    5 +
    (set?.questions[1]?.maxScore ?? 10) +
    5 +
    (set?.questions[3]?.maxScore ?? 5) +
    3;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>S-CBTスピーキング講評シート_${escapeHtml(submission.studentName)}</title>
  <style>
    @page { size: A4 portrait; margin: 11mm 13mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 18px; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #111; background: #f5f5f5; font-size: 9.8pt; line-height: 1.5; }
    .toolbar { max-width: 190mm; margin: 0 auto 12px; padding: 10px 14px; background: #fff; border: 1.5px solid #111; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .toolbar button { padding: 7px 14px; border: 1.5px solid #111; border-radius: 6px; background: #111; color: #fff; font-weight: 700; cursor: pointer; }
    .sheet { max-width: 190mm; margin: 0 auto; background: #fff; padding: 11mm 12mm; border: 1px solid #ccc; }
    .head { border-bottom: 2.5px solid #111; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
    .head h1 { font-size: 14.5pt; margin: 2px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9pt; }
    th, td { border: 1px solid #222; padding: 4px 7px; }
    th { background: #eee; font-weight: 700; }
    .box { border: 1.2px solid #222; border-radius: 4px; padding: 7px 10px; margin-bottom: 9px; page-break-inside: avoid; }
    .box h2 { font-size: 9.8pt; margin: 0 0 5px; border-bottom: 1px solid #444; padding-bottom: 2px; }
    .en { font-family: "Times New Roman", Georgia, serif; font-size: 10.2pt; line-height: 1.55; margin: 3px 0; }
    @media print { body { background: #fff; padding: 0; } .toolbar { display: none !important; } .sheet { max-width: none; padding: 0; border: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>S-CBT スピーキング講評＆音読復習シート（A4白黒印刷対応）</strong>
    <div style="display:flex;gap:8px;">
      <button type="button" onclick="window.print()">印刷 ／ PDFとして保存</button>
      <button type="button" style="background:#fff;color:#111;" onclick="window.close()">閉じる</button>
    </div>
  </div>
  <main class="sheet">
    <header class="head">
      <div>
        <div style="font-size:8.5pt;font-weight:700;">${escapeHtml(headerBrand)}</div>
        <h1>英検 S-CBT スピーキング 音声講評＆復習シート</h1>
      </div>
      <div style="text-align:right;font-size:8.5pt;">
        録音提出：${escapeHtml(formatDateTimeJp(submission.submittedAt))}<br />
        講評返却：${escapeHtml(formatDateTimeJp(review?.reviewedAt))}
      </div>
    </header>

    <table>
      <tr>
        <th style="width:16%;">生徒氏名</th>
        <td><strong>${escapeHtml(submission.studentName)}</strong></td>
        <th style="width:16%;">対象級</th>
        <td>${escapeHtml(gradeLabel)}</td>
      </tr>
      <tr>
        <th>演習セット</th>
        <td>${escapeHtml(set?.title || submission.setTitle || submission.setId)}</td>
        <th>担当講師</th>
        <td>${escapeHtml(review?.reviewerName || 'すごろく英検指導担当')}</td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <th>音読 (/5)</th>
          <th>No.1 (/5)</th>
          <th>No.2 (/${set?.questions[1]?.maxScore ?? 10})</th>
          <th>No.3 (/5)</th>
          <th>No.4 (/${set?.questions[3]?.maxScore ?? 5})</th>
          <th>態度 (/3)</th>
          <th>総合スコア</th>
        </tr>
      </thead>
      <tbody>
        <tr style="text-align:center;">
          <td>${scores.reading_aloud ?? '―'}</td>
          <td>${scores.q1 ?? '―'}</td>
          <td>${scores.q2 ?? '―'}</td>
          <td>${scores.q3 ?? '―'}</td>
          <td>${scores.q4 ?? '―'}</td>
          <td>${scores.attitude ?? '―'}</td>
          <td style="font-size:12pt;font-weight:800;">${review ? `${totalScore} / ${maxTotal}` : `未採点 / ${maxTotal}`}</td>
        </tr>
      </tbody>
    </table>

    <section class="box">
      <h2>1. 先生からの音声講評・次回に向けたアドバイス</h2>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(
        review?.comment || '（講師コメント記入欄）',
      )}</p>
    </section>

    ${
      set
        ? `<section class="box">
      <h2>2. 自宅声出し復習用：音読パッセージ ＆ 各問の模範解答例（各3回ずつ声に出して練習しよう！）</h2>
      <p style="margin:0 0 4px;"><strong>【音読パッセージ：${escapeHtml(set.cardTitle)}】</strong> □1回目 □2回目 □3回目</p>
      <p class="en" lang="en">${escapeHtml(set.passage)}</p>
      ${set.questions
        .map(
          q => `<div style="border-top:1px dotted #666;margin-top:6px;padding-top:4px;">
        <div><strong>【${escapeHtml(q.numberLabel)}】</strong> <span lang="en">${escapeHtml(
            q.promptAudioScript,
          )}</span> □1回 □2回 □3回</div>
        <p class="en" lang="en"><strong>Model:</strong> ${escapeHtml(q.modelAnswer)}</p>
        <div style="font-size:8.6pt;color:#333;">（和訳：${escapeHtml(q.modelTranslation)}）</div>
      </div>`,
        )
        .join('')}
    </section>`
        : `<section class="box">
      <h2>2. 提出録音パート記録</h2>
      <ul>${SCBT_PART_ORDER.map(p => {
        const r = submission.recordings.find(x => x.partId === p);
        return `<li>${escapeHtml(SCBT_PART_LABELS[p])}：${r ? `${r.durationSec}秒` : '未録音'}</li>`;
      }).join('')}</ul>
    </section>`
    }
  </main>
</body>
</html>`;
}

export function openSpeakingFeedbackPrintWindow(
  submission: SugorokuSpeakingSubmissionDoc,
  set?: ScbtSpeakingSet,
  schoolName?: string,
): boolean {
  if (typeof window === 'undefined') return false;
  const html = buildSpeakingFeedbackSheetHtml(submission, set, schoolName);
  const win = window.open('', '_blank', 'width=920,height=980');
  if (win && win.document) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }
  return false;
}
