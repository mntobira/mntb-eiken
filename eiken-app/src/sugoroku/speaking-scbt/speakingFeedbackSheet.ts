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
 * 講師手元AI（Gemini / ChatGPT）へ貼れる S-CBT スピーキング講評作成補助プロンプト。
 * 生徒の発話率・最長無音秒数・自動認識テキスト（ある場合）を同梱し、
 * [SCORES]..[/SCORES] / [COMMENT]..[/COMMENT] で1クリック一括反映に対応する。
 */
export function buildSpeakingAiCoachPrompt(
  submission: SugorokuSpeakingSubmissionDoc,
  set?: ScbtSpeakingSet,
  scores?: Record<string, number | undefined>,
  memoNotes?: string,
): string {
  const gradeLabel =
    EIKEN_GRADES.find(g => g.id === submission.grade)?.label ?? submission.grade;
  const s = scores ?? submission.review?.rubricScores ?? {};
  const q2Max = set?.questions[1]?.maxScore ?? 10;
  const q4Max = set?.questions[3]?.maxScore ?? 5;

  const lines: string[] = [
    `あなたはオンライン個別指導塾「すごろく」の英検S-CBTスピーキング担当講師アシスタントです。`,
    `以下の高校生（${submission.studentName} さん）が取り組んだ【${gradeLabel} S-CBTスピーキング模擬録音】データをもとに、パート別スコア案と温かい講評コメント（220〜360字程度）を作成してください。`,
    ``,
    `■ 演習セット：${set?.title || submission.setTitle || submission.setId}`,
    `■ 現在の仮採点スコア：`,
    `- 音読 (reading_aloud)：${s.reading_aloud ?? '-'} / 5`,
    `- No.1 (q1)：${s.q1 ?? '-'} / 5`,
    `- No.2 (q2)：${s.q2 ?? '-'} / ${q2Max}`,
    `- No.3 (q3)：${s.q3 ?? '-'} / 5`,
    `- No.4 (q4)：${s.q4 ?? '-'} / ${q4Max}`,
    `- アティチュード (attitude)：${s.attitude ?? '-'} / 3`,
    ``,
    `■ 生徒の録音テレメトリ＆音声認識ログ（参考）：`,
    ...SCBT_PART_ORDER.map(partId => {
      const rec = submission.recordings.find(r => r.partId === partId);
      if (!rec) return `- ${SCBT_PART_LABELS[partId]}：未録音`;
      const ratioTxt =
        typeof rec.speechRatio === 'number' ? ` / 発話率 ${rec.speechRatio}%` : '';
      const silenceTxt =
        typeof rec.maxSilenceSec === 'number'
          ? ` / 最長ポーズ ${rec.maxSilenceSec}秒`
          : '';
      const trTxt = rec.transcript ? `\n  認識英語: "${rec.transcript}"` : '';
      return `- ${SCBT_PART_LABELS[partId]}：${rec.durationSec}秒${ratioTxt}${silenceTxt}${trTxt}`;
    }),
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
    `■ 出力形式（管理画面への1クリック自動反映のため、以下の見出しタグをそのまま使って出力してください）`,
    `[SCORES]`,
    `reading_aloud: X/5`,
    `q1: X/5`,
    `q2: X/${q2Max}`,
    `q3: X/5`,
    `q4: X/${q4Max}`,
    `attitude: X/3`,
    `[/SCORES]`,
    ``,
    `[COMMENT]`,
    `（1. 声の出し方・発話できた内容への具体的な褒め言葉、2. 次回のS-CBT録音で意識する改善ポイント2点、3. 自宅での音読3回＋模範解答シャドーイングへの励ましを日本語で記載）`,
    `[/COMMENT]`,
  );

  return lines.join('\n');
}

export interface ParsedSpeakingAiReview {
  rubricScores: Record<string, number>;
  comment?: string;
}

export function parseSpeakingAiReviewResponse(
  rawText: string,
  q2Max = 10,
  q4Max = 5,
): ParsedSpeakingAiReview {
  const text = String(rawText ?? '').trim();
  const rubricScores: Record<string, number> = {};

  const pick = (re: RegExp, maxVal: number, key: string) => {
    const m = re.exec(text);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n)) {
      rubricScores[key] = Math.max(0, Math.min(maxVal, Math.round(n)));
    }
  };

  pick(/(?:reading_aloud|音読)[^\d\n]{0,14}(\d+)/i, 5, 'reading_aloud');
  pick(/(?:\bq1\b|No\.?\s*1)[^\d\n]{0,14}(\d+)/i, 5, 'q1');
  pick(/(?:\bq2\b|No\.?\s*2)[^\d\n]{0,14}(\d+)/i, q2Max, 'q2');
  pick(/(?:\bq3\b|No\.?\s*3)[^\d\n]{0,14}(\d+)/i, 5, 'q3');
  pick(/(?:\bq4\b|No\.?\s*4)[^\d\n]{0,14}(\d+)/i, q4Max, 'q4');
  pick(/(?:attitude|アティチュード|態度)[^\d\n]{0,14}(\d+)/i, 3, 'attitude');

  const commentMatch = /\[COMMENT\]([\s\S]*?)\[\/COMMENT\]/i.exec(text);
  const comment = commentMatch
    ? commentMatch[1].replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
    : Object.keys(rubricScores).length === 0
    ? text
    : undefined;

  return { rubricScores, comment: comment || undefined };
}

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
  const totalScore = Object.values(scores).reduce<number>(
    (sum, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
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
    body { margin: 0; padding: 18px; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #111; background: #f5f5f5; font-size: 9.6pt; line-height: 1.48; }
    .toolbar { max-width: 190mm; margin: 0 auto 12px; padding: 10px 14px; background: #fff; border: 1.5px solid #111; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .toolbar button { padding: 7px 14px; border: 1.5px solid #111; border-radius: 6px; background: #111; color: #fff; font-weight: 700; cursor: pointer; }
    .sheet { max-width: 190mm; margin: 0 auto; background: #fff; padding: 10mm 12mm; border: 1px solid #ccc; }
    .head { border-bottom: 2.5px solid #111; padding-bottom: 6px; margin-bottom: 9px; display: flex; justify-content: space-between; align-items: flex-end; }
    .head h1 { font-size: 14pt; margin: 2px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 9px; font-size: 8.8pt; }
    th, td { border: 1px solid #222; padding: 4px 7px; }
    th { background: #eee; font-weight: 700; }
    .box { border: 1.2px solid #222; border-radius: 4px; padding: 7px 10px; margin-bottom: 8px; page-break-inside: avoid; }
    .box h2 { font-size: 9.6pt; margin: 0 0 5px; border-bottom: 1px solid #444; padding-bottom: 2px; }
    .en { font-family: "Times New Roman", Georgia, serif; font-size: 10pt; line-height: 1.5; margin: 3px 0; }
    .meta-line { font-size: 8.4pt; color: #222; }
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
          <td>${scores.reading_aloud ?? scores.readingAloud ?? '―'}</td>
          <td>${scores.q1 ?? '―'}</td>
          <td>${scores.q2 ?? '―'}</td>
          <td>${scores.q3 ?? '―'}</td>
          <td>${scores.q4 ?? '―'}</td>
          <td>${scores.attitude ?? '―'}</td>
          <td style="font-size:11.5pt;font-weight:800;">${review ? `${totalScore} / ${maxTotal}` : `未採点 / ${maxTotal}`}</td>
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
      <p style="margin:0 0 3px;"><strong>【音読パッセージ：${escapeHtml(set.cardTitle)}】</strong> □1回目 □2回目 □3回目</p>
      <p class="en" lang="en">${escapeHtml(set.passage)}</p>
      ${set.questions
        .map(q => {
          const rec = submission.recordings.find(r => r.partId === q.partId);
          const trHtml = rec?.transcript
            ? `<div class="meta-line">あなたの発話認識メモ: <span lang="en">"${escapeHtml(rec.transcript)}"</span></div>`
            : '';
          return `<div style="border-top:1px dotted #666;margin-top:6px;padding-top:4px;">
        <div><strong>【${escapeHtml(q.numberLabel)}】</strong> <span lang="en">${escapeHtml(
            q.promptAudioScript,
          )}</span> □1回 □2回 □3回</div>
        ${trHtml}
        <p class="en" lang="en"><strong>Model:</strong> ${escapeHtml(q.modelAnswer)}</p>
        <div class="meta-line">（和訳：${escapeHtml(q.modelTranslation)}）</div>
      </div>`;
        })
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
