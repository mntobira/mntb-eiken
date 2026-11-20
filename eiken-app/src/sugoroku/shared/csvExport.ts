import { EIKEN_GRADES } from '../../eiken/config';
import type {
  SugorokuSpeakingSubmissionDoc,
  SugorokuWritingSubmissionDoc,
} from './types';

function csvCell(value: unknown): string {
  const s = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateIsoJp(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * ライティング提出・添削一覧を Excel 互換の UTF-8 BOM 付き CSV 文字列へ変換する
 */
export function buildWritingSubmissionsCsv(
  items: readonly SugorokuWritingSubmissionDoc[],
): string {
  const headers = [
    '提出日時',
    '生徒氏名',
    '対象級',
    '課題名',
    '語数',
    '状態',
    '合計点(/16)',
    '内容(/4)',
    '構成(/4)',
    '語彙(/4)',
    '文法(/4)',
    '担当講師',
    '講評コメント',
    '添削英文',
    '生徒原文',
  ];
  const rows = items.map(item => {
    const gradeLabel = EIKEN_GRADES.find(g => g.id === item.grade)?.label ?? item.grade;
    const r = item.review;
    const rs = r?.rubricScores;
    return [
      formatDateIsoJp(item.submittedAt),
      item.studentName,
      gradeLabel,
      item.taskTitle || item.taskKey,
      item.wordCount,
      item.status === 'reviewed' ? '添削済' : '未添削',
      r ? r.score : '',
      rs?.content ?? '',
      rs?.structure ?? rs?.organization ?? '',
      rs?.vocabulary ?? '',
      rs?.grammar ?? '',
      r?.reviewerName ?? '',
      r?.comment ?? '',
      r?.correctedText ?? '',
      item.text,
    ].map(csvCell);
  });

  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

/**
 * S-CBT スピーキング提出・講評一覧を Excel 互換の UTF-8 BOM 付き CSV 文字列へ変換する
 */
export function buildSpeakingSubmissionsCsv(
  items: readonly SugorokuSpeakingSubmissionDoc[],
): string {
  const headers = [
    '提出日時',
    '生徒氏名',
    '対象級',
    '演習セット',
    '合計録音秒数',
    '平均発話率(%)',
    '最長無音(秒)',
    '状態',
    '合計スコア',
    '音読',
    'No.1',
    'No.2',
    'No.3',
    'No.4',
    'アティチュード',
    '担当講師',
    '講評コメント',
  ];
  const rows = items.map(item => {
    const gradeLabel = EIKEN_GRADES.find(g => g.id === item.grade)?.label ?? item.grade;
    const totalSec =
      Math.round(item.recordings.reduce((s, r) => s + (r.durationSec || 0), 0) * 10) / 10;
    const withRatio = item.recordings.filter(r => typeof r.speechRatio === 'number');
    const avgRatio =
      withRatio.length > 0
        ? Math.round(
            withRatio.reduce((s, r) => s + (r.speechRatio ?? 0), 0) / withRatio.length,
          )
        : '';
    const maxSilence = item.recordings.reduce(
      (m, r) => Math.max(m, r.maxSilenceSec ?? 0),
      0,
    );
    const scores = item.review?.rubricScores ?? {};
    const totalScore = item.review
      ? Object.values(scores).reduce<number>(
          (sum, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
          0,
        )
      : '';
    return [
      formatDateIsoJp(item.submittedAt),
      item.studentName,
      gradeLabel,
      item.setTitle || item.setId,
      totalSec,
      avgRatio,
      maxSilence > 0 ? maxSilence : '',
      item.status === 'reviewed' ? '講評済' : '未確認',
      totalScore,
      scores.reading_aloud ?? scores.readingAloud ?? '',
      scores.q1 ?? '',
      scores.q2 ?? '',
      scores.q3 ?? '',
      scores.q4 ?? '',
      scores.attitude ?? '',
      item.review?.reviewerName ?? '',
      item.review?.comment ?? '',
    ].map(csvCell);
  });

  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

export function downloadUtf8BomCsv(csvContent: string, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
