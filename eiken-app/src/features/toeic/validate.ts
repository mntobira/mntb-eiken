/**
 * 問題データの構造チェック（テストから呼ぶ）。中身の英語の正しさは人が確認する。
 */
import { MOCK_BLUEPRINT, TOEIC_PARTS } from './format';
import type { ToeicMockExam, ToeicPart, ToeicSet, ToeicSetId } from './types';

export interface ValidationIssue { id: string; message: string }

export function validateSet(set: ToeicSet): ValidationIssue[] {
  const spec = TOEIC_PARTS[set.part];
  const issues: ValidationIssue[] = [];
  const add = (message: string, id: string = set.id) => issues.push({ id, message });

  if (!set.id.startsWith(`toeic-p${set.part}-`)) add(`ID が Part ${set.part} の規約と合わない`);
  if (!spec.questionsPerSet.includes(set.questions.length)) {
    add(`設問数 ${set.questions.length}（Part ${set.part} は ${spec.questionsPerSet.join('/')}）`);
  }
  for (const q of set.questions) {
    if (!q.id.startsWith(`${set.id}-q`)) add('設問IDがセットIDで始まらない', q.id);
    const labels = q.choices.map(c => c.label).join('');
    if (labels !== spec.choices.join('')) add(`選択肢が ${spec.choices.join('')} ではない（${labels}）`, q.id);
    if (!spec.choices.includes(q.answer)) add(`正解 ${q.answer} が選択肢にない`, q.id);
    if (!q.explanation.reason.trim()) add('解説が空', q.id);
    if (!spec.audioOnlyChoices && set.part !== 6 && !q.stem) add('設問文がない', q.id);
  }
  if (set.part === 6) {
    const blanks = set.passage.paragraphs.join('\n').match(/\[\[\d+\]\]/g) ?? [];
    if (blanks.length !== set.questions.length) add(`空所 ${blanks.length} 個と設問 ${set.questions.length} 問が合わない`);
  }
  if (set.part === 7) {
    const docs = set.passages.length;
    if (docs > 1 && set.questions.length !== 5) add(`${docs === 2 ? 'ダブル' : 'トリプル'}パッセージは5問`);
    if (docs === 1 && set.questions.length > 4) add('シングルパッセージは2〜4問');
  }
  if (set.part === 6 || set.part === 7) {
    const ps = set.part === 6 ? [set.passage] : set.passages;
    ps.forEach((p, i) => { if (p.paragraphs.length !== p.paragraphsJa.length) add(`文書${i + 1}の段落数と全訳の段落数が違う`); });
  }
  return issues;
}

/** 模試のセット構成が本番どおりか */
export function validateMock(exam: ToeicMockExam, lookup: (id: ToeicSetId) => ToeicSet | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const part of [1, 2, 3, 4, 5, 6, 7] as ToeicPart[]) {
    const sets = exam.setIds[part].map(lookup);
    if (sets.some(s => !s)) issues.push({ id: exam.id, message: `Part ${part} に存在しないセットがある` });
    const q = sets.reduce((n, s) => n + (s?.questions.length ?? 0), 0);
    const bp = MOCK_BLUEPRINT[part];
    if (sets.length !== bp.sets || q !== bp.questions) {
      issues.push({ id: exam.id, message: `Part ${part}: ${sets.length}セット${q}問（本番は ${bp.sets}セット${bp.questions}問）` });
    }
  }
  return issues;
}
