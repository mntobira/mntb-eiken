import { chapterSubjectOf, chapterTitleOf, chapterTotals } from '../homework/chapterTotals';
import { EIKEN_GRADES } from '../../eiken/config';
import type { AnswerReasonDoc } from '../../utils/classAssignmentsCore';
import type { ReviewItem } from '../../utils/reviewList';
import type { SolvedMap } from '../../utils/studySyncCore';
import type {
  SugorokuMemberDoc,
  SugorokuSpeakingSubmissionDoc,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export interface StudentSolvedQuestionChip {
  questionKey: string;
  questionNo: number;
  label: string;
  solvedAtMs: number;
  status: 'correct' | 'reviewed_ok' | 'wrong';
  wrongCount: number;
  correctCount: number;
}

export interface StudentChapterActivityRow {
  chapterId: string;
  gradeId: string | null;
  gradeShortLabel: string;
  chapterTitle: string;
  solvedCount: number;
  totalProblems: number;
  wrongQuestionCount: number;
  latestAtMs: number;
  questions: StudentSolvedQuestionChip[];
  reasons: AnswerReasonDoc[];
}

export interface ClassLiveSubmissionEvent {
  id: string;
  kind: 'reason_batch' | 'writing' | 'speaking' | 'chapter_progress';
  studentUid: string;
  studentName: string;
  title: string;
  subtitle: string;
  badgeText: string;
  tone: 'teal' | 'amber' | 'rose' | 'blue';
  timestampMs: number;
}

function gradeShortOf(gradeId: string | null): string {
  if (!gradeId) return '英検';
  const hit = EIKEN_GRADES.find((g) => g.id === gradeId);
  return hit ? hit.label.replace(/^英検/, '') : gradeId;
}

function extractQuestionNumber(rawId: string, fallbackIndex: number): number {
  const m = /(\d+)(?!.*\d)/.exec(rawId || '');
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 999) return n;
  }
  return fallbackIndex + 1;
}

export function normalizeTimestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const maybe = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') {
      const ms = maybe.toMillis();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof maybe.seconds === 'number' && Number.isFinite(maybe.seconds)) {
      return maybe.seconds * 1000;
    }
  }
  return 0;
}

/**
 * 1名の生徒の `solved`（章ID::大問ID -> 時刻ms）・`reviewItems`（誤答/復習履歴）・`answerReasons`（選んだ理由・一括提出）を統合し、
 * 先生が「どの単元の何番の問題をいつ解いて、どこを間違え、どんな理由を送ってきたか」を一目で把握できる配列を返す。
 */
export function buildStudentChapterActivities(params: {
  uid: string;
  rawSolved?: SolvedMap;
  chapterCountsFallback?: Record<string, number>;
  reviewItems?: readonly ReviewItem[];
  answerReasons?: readonly AnswerReasonDoc[];
}): StudentChapterActivityRow[] {
  const totals = chapterTotals();
  const rawSolved = params.rawSolved || {};
  const reviewItems = params.reviewItems || [];
  const reasons = (params.answerReasons || []).filter((r) => r.uid === params.uid);

  const byChapter = new Map<
    string,
    {
      solvedEntries: Array<{ qId: string; ts: number }>;
      reviews: ReviewItem[];
      reasons: AnswerReasonDoc[];
      fallbackCount: number;
    }
  >();

  const ensure = (chapterId: string) => {
    let bucket = byChapter.get(chapterId);
    if (!bucket) {
      bucket = { solvedEntries: [], reviews: [], reasons: [], fallbackCount: 0 };
      byChapter.set(chapterId, bucket);
    }
    return bucket;
  };

  for (const [key, rawTs] of Object.entries(rawSolved)) {
    const sep = key.indexOf('::');
    if (sep <= 0) continue;
    const chapterId = key.slice(0, sep);
    const qId = key.slice(sep + 2);
    if (!chapterId || !qId) continue;
    ensure(chapterId).solvedEntries.push({
      qId,
      ts: normalizeTimestampMs(rawTs),
    });
  }

  for (const [chapterId, count] of Object.entries(params.chapterCountsFallback || {})) {
    if (count > 0) {
      ensure(chapterId).fallbackCount = Math.max(ensure(chapterId).fallbackCount, count);
    }
  }

  for (const rev of reviewItems) {
    if (!rev?.chapterId) continue;
    ensure(rev.chapterId).reviews.push(rev);
  }

  for (const r of reasons) {
    if (!r?.chapterId) continue;
    ensure(r.chapterId).reasons.push(r);
  }

  const rows: StudentChapterActivityRow[] = [];

  for (const [chapterId, bucket] of byChapter.entries()) {
    const gradeId = chapterSubjectOf(chapterId);
    const gradeShortLabel = gradeShortOf(gradeId);
    const chapterTitle = chapterTitleOf(chapterId);
    const totalProblems = totals[chapterId] || Math.max(bucket.solvedEntries.length, bucket.fallbackCount);

    // 設問番号ごとの統合マップ
    const qMap = new Map<string, StudentSolvedQuestionChip>();

    bucket.solvedEntries.forEach((entry, idx) => {
      const qNo = extractQuestionNumber(entry.qId, idx);
      qMap.set(entry.qId, {
        questionKey: entry.qId,
        questionNo: qNo,
        label: `問${qNo}`,
        solvedAtMs: entry.ts,
        status: 'correct',
        wrongCount: 0,
        correctCount: 1,
      });
    });

    bucket.reviews.forEach((rev, idx) => {
      const qKey = rev.questionId || rev.subQuestionId || `rev_${idx}`;
      const qNo = rev.questionIndex && rev.questionIndex > 0 ? rev.questionIndex : extractQuestionNumber(qKey, idx);
      const existing = qMap.get(qKey);
      const wrongCount = Math.max(0, Number(rev.wrongCount) || 0);
      const correctCount = Math.max(0, Number(rev.correctCount) || 0);
      const isCurrentlyWrong =
        rev.lastResult === 'wrong' || (rev.lastResult !== 'correct' && wrongCount > 0 && rev.box === 0);
      const status: StudentSolvedQuestionChip['status'] = isCurrentlyWrong
        ? 'wrong'
        : wrongCount > 0
        ? 'reviewed_ok'
        : 'correct';
      const ts = Math.max(existing?.solvedAtMs || 0, normalizeTimestampMs(rev.updatedAt));
      qMap.set(qKey, {
        questionKey: qKey,
        questionNo: qNo,
        label: rev.subLabel?.trim() || `問${qNo}`,
        solvedAtMs: ts,
        status,
        wrongCount,
        correctCount: Math.max(existing?.correctCount || 0, correctCount),
      });
    });

    // rawSolved が無く fallbackCount だけある場合（古いデモデータ等）は問1〜問Nを生成
    if (qMap.size === 0 && bucket.fallbackCount > 0) {
      for (let i = 1; i <= bucket.fallbackCount; i += 1) {
        qMap.set(`q${i}`, {
          questionKey: `q${i}`,
          questionNo: i,
          label: `問${i}`,
          solvedAtMs: 0,
          status: 'correct',
          wrongCount: 0,
          correctCount: 1,
        });
      }
    }

    const questions = [...qMap.values()].sort(
      (a, b) => a.questionNo - b.questionNo || a.questionKey.localeCompare(b.questionKey),
    );
    const solvedCount = Math.max(bucket.solvedEntries.length, bucket.fallbackCount, questions.filter((q) => q.status !== 'wrong').length);
    const wrongQuestionCount = questions.filter((q) => q.status === 'wrong').length;

    let latestAtMs = 0;
    for (const q of questions) {
      if (q.solvedAtMs > latestAtMs) latestAtMs = q.solvedAtMs;
    }
    for (const r of bucket.reasons) {
      const rTs = normalizeTimestampMs(r.updatedAt);
      if (rTs > latestAtMs) latestAtMs = rTs;
    }

    const sortedReasons = [...bucket.reasons].sort(
      (a, b) => normalizeTimestampMs(b.updatedAt) - normalizeTimestampMs(a.updatedAt) || (a.qNo || 0) - (b.qNo || 0),
    );

    rows.push({
      chapterId,
      gradeId,
      gradeShortLabel,
      chapterTitle,
      solvedCount,
      totalProblems,
      wrongQuestionCount,
      latestAtMs,
      questions,
      reasons: sortedReasons,
    });
  }

  return rows.sort(
    (a, b) =>
      b.latestAtMs - a.latestAtMs ||
      b.reasons.length - a.reasons.length ||
      b.solvedCount - a.solvedCount ||
      a.chapterId.localeCompare(b.chapterId),
  );
}

export function formatShortTimestampJa(ms: number): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mo}/${day} ${hh}:${mm}`;
}

/**
 * クラス全体の「一括提出（選んだ理由・振り返り／英作文／スピーキング）＋ 直近で解いた単元・問題番号」を
 * 時系列順に統合して返す（右サイドのライブ提出・演習フィード用）。
 */
export function buildClassLiveSubmissionFeed(params: {
  members: readonly SugorokuMemberDoc[];
  rawSolvedByUid?: Record<string, SolvedMap>;
  solvedByUid?: Record<string, Record<string, number>>;
  reviewItemsByUid?: Record<string, ReviewItem[]>;
  answerReasons?: readonly AnswerReasonDoc[];
  writingSubmissions?: readonly SugorokuWritingSubmissionDoc[];
  speakingSubmissions?: readonly SugorokuSpeakingSubmissionDoc[];
  limit?: number;
}): ClassLiveSubmissionEvent[] {
  const nameByUid = new Map<string, string>();
  for (const m of params.members) {
    nameByUid.set(m.uid, m.rosterName || m.displayName || '生徒');
  }

  const events: ClassLiveSubmissionEvent[] = [];

  for (const w of params.writingSubmissions || []) {
    const sName = w.studentName || nameByUid.get(w.studentUid) || '生徒';
    events.push({
      id: `writing_${w.id}`,
      kind: 'writing',
      studentUid: w.studentUid,
      studentName: sName,
      title: w.taskTitle,
      subtitle: `${w.wordCount}語 · ${w.status === 'reviewed' ? '添削返却済' : '先生の添削待ち'}`,
      badgeText: w.status === 'reviewed' ? '英作文・添削済' : '英作文・一括提出',
      tone: w.status === 'reviewed' ? 'teal' : 'amber',
      timestampMs: normalizeTimestampMs(w.submittedAt),
    });
  }

  for (const sp of params.speakingSubmissions || []) {
    const sName = sp.studentName || nameByUid.get(sp.studentUid) || '生徒';
    events.push({
      id: `speaking_${sp.id}`,
      kind: 'speaking',
      studentUid: sp.studentUid,
      studentName: sName,
      title: sp.setTitle,
      subtitle: `録音 ${sp.recordings?.length || 0}パート · ${sp.status === 'reviewed' ? '講評返却済' : '先生の確認待ち'}`,
      badgeText: sp.status === 'reviewed' ? '面接・講評済' : '面接録音・一括提出',
      tone: sp.status === 'reviewed' ? 'teal' : 'amber',
      timestampMs: normalizeTimestampMs(sp.submittedAt),
    });
  }

  for (const r of params.answerReasons || []) {
    const sName = nameByUid.get(r.uid) || '生徒';
    const chTitle = chapterTitleOf(r.chapterId);
    const qTag = r.qNo && r.qNo > 0 ? `問${r.qNo}` : r.questionId;
    const mark = typeof r.correct === 'boolean' ? (r.correct ? '○' : '×') : '';
    const ts = normalizeTimestampMs(r.updatedAt);
    events.push({
      id: `reason_${r.uid}_${r.chapterId}_${r.questionId}`,
      kind: 'reason_batch',
      studentUid: r.uid,
      studentName: sName,
      title: `${chTitle}（${qTag}${mark ? ` ${mark}` : ''}）`,
      subtitle: r.reason,
      badgeText: r.reason.startsWith('【一括提出】') ? '演習結果・一括提出' : '選んだ理由・質問',
      tone: r.correct === false ? 'rose' : 'blue',
      timestampMs: ts,
    });
  }

  // 各生徒の直近単元演習（最大2件ずつ）も混ぜて「誰が何の問題を解いたか」をゼロ状態にしない
  for (const m of params.members) {
    if (m.role !== 'student' || m.active === false) continue;
    const chapters = buildStudentChapterActivities({
      uid: m.uid,
      rawSolved: params.rawSolvedByUid?.[m.uid],
      chapterCountsFallback: params.solvedByUid?.[m.uid],
      reviewItems: params.reviewItemsByUid?.[m.uid],
      answerReasons: params.answerReasons,
    });
    for (const ch of chapters.slice(0, 2)) {
      const sampleChips = ch.questions
        .slice(0, 6)
        .map((q) => `${q.label}${q.status === 'wrong' ? '×' : '○'}`)
        .join(' ');
      const tail = ch.questions.length > 6 ? ` ほか計${ch.solvedCount}問` : '';
      events.push({
        id: `prog_${m.uid}_${ch.chapterId}`,
        kind: 'chapter_progress',
        studentUid: m.uid,
        studentName: m.rosterName || m.displayName || '生徒',
        title: `[${ch.gradeShortLabel}] ${ch.chapterTitle}`,
        subtitle: `${ch.solvedCount}/${ch.totalProblems}問完了${ch.wrongQuestionCount > 0 ? `（要復習 ${ch.wrongQuestionCount}問）` : ''} · ${sampleChips}${tail}`,
        badgeText: '問題演習クリア',
        tone: ch.wrongQuestionCount > 0 ? 'rose' : 'teal',
        timestampMs: ch.latestAtMs,
      });
    }
  }

  return events
    .sort((a, b) => b.timestampMs - a.timestampMs || a.id.localeCompare(b.id))
    .slice(0, params.limit ?? 14);
}

