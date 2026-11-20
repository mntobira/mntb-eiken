import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from '../../utils/firestoreMetered';
import { auth, db, FIREBASE_CONFIGURED, USE_EMULATORS } from '../../firebase';
import { safeLocalStorage } from '../../utils/safeLocalStorage';
import type { EikenGrade } from '../../eiken/config';
import type {
  SugorokuWritingReview,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export const SUGOROKU_DEMO_CLASS_ID = 'sugoroku_demo_class';
const LOCAL_WRITING_SUBMISSIONS_KEY = 'sugoroku_writing_submissions_v1';

/**
 * デモ・初期確認用のリアルなサンプル提出答案（すごろく塾：運動部高2生の英検2級対策イメージ）
 */
export const DEMO_WRITING_SUBMISSIONS: readonly SugorokuWritingSubmissionDoc[] = [
  {
    id: 'demo_ws_001',
    classId: SUGOROKU_DEMO_CLASS_ID,
    studentUid: 'demo_student_sato',
    studentName: '佐藤 健太（高2・サッカー部）',
    grade: 'eiken_2',
    taskKey: 'eiken_2_writing_opinion',
    taskTitle: '英検2級 意見論述（基礎練習）',
    wordCount: 84,
    text:
      'I think that high school students should do part-time jobs during long vacations.\n' +
      'First, students can learn the importance of money and communication. When they work with adults, they learn polite language that is useful in the future.\n' +
      'Second, they can save money for their own goals, such as buying sports equipment or books for university.\n' +
      'For these reasons, i beleive working during vacations is a good experience for students.',
    formatWarnings: [
      '一人称の「I（私）」が小文字の "i" になっています。必ず大文字の "I" にしましょう。',
      'スペル注意の語が見つかりました："beleive" → "believe"',
    ],
    status: 'submitted',
    submittedAt: Date.now() - 3 * 60 * 60 * 1000,
  },
  {
    id: 'demo_ws_002',
    classId: SUGOROKU_DEMO_CLASS_ID,
    studentUid: 'demo_student_takahashi',
    studentName: '高橋 葵（高2・陸上部）',
    grade: 'eiken_2',
    taskKey: 'eiken_2_writing_summary',
    taskTitle: '英検2級 英文要約（基礎練習）',
    wordCount: 54,
    text:
      'Recently, many cities introduce shared bicycles for residents and tourists. They are convenient for short trips and help reduce traffic jams and air pollution. However, some users park them in the wrong places, and accidents are increasing. Therefore, cities need to make clear rules and safer lanes.',
    formatWarnings: [],
    status: 'reviewed',
    submittedAt: Date.now() - 28 * 60 * 60 * 1000,
    review: {
      reviewerUid: 'demo_teacher_fujisawa',
      reviewerName: '藤沢 卓登（英検2級担当）',
      score: 14,
      maxScore: 16,
      rubricScores: {
        content: 4,
        structure: 4,
        vocabulary: 3,
        grammar: 3,
      },
      comment:
        '45〜55語の語数レンジ（54語）にピタッと収められており、第1段落の導入・メリット・課題・対策の4要素がすべて自分の言葉で整理できていて素晴らしいです！1文目の "introduce" を現在完了形 "have introduced" にすると「近年導入してきている」ニュアンスがさらに自然になります。',
      correctedText:
        'Recently, many cities have introduced shared bicycles for residents and tourists. These bicycles are convenient for short trips and help reduce traffic jams and air pollution. However, improper parking and traffic accidents have become serious problems, so cities need clearer rules and safer lanes.',
      strengths: '・語数管理（54語）と対比のディスコースマーカー（However / Therefore）の使い方が完璧です。',
      nextActions: '・「最近〜している（Recently, ...）」では現在完了形（have + 過去分詞）を意識してみましょう！',
      reviewedAt: Date.now() - 20 * 60 * 60 * 1000,
    },
  },
];

function readLocalSubmissions(): SugorokuWritingSubmissionDoc[] {
  const store = safeLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(LOCAL_WRITING_SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SugorokuWritingSubmissionDoc[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSubmissions(items: SugorokuWritingSubmissionDoc[]): void {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(LOCAL_WRITING_SUBMISSIONS_KEY, JSON.stringify(items.slice(0, 200)));
  } catch {
    // 容量超過時は無視
  }
}

function upsertLocalSubmission(docItem: SugorokuWritingSubmissionDoc): void {
  const current = readLocalSubmissions();
  const next = [docItem, ...current.filter(item => item.id !== docItem.id)];
  writeLocalSubmissions(next);
}

function cloudEnabledForClass(classId: string): boolean {
  return (
    Boolean(classId) &&
    classId !== SUGOROKU_DEMO_CLASS_ID &&
    (FIREBASE_CONFIGURED || USE_EMULATORS) &&
    Boolean(auth.currentUser?.uid)
  );
}

export interface SubmitWritingInput {
  classId: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  taskKey: string;
  taskTitle?: string;
  wordCount: number;
  text: string;
  formatWarnings: string[];
}

/**
 * 生徒：英作文答案を塾クラスへ提出する。
 * Firestore パス契約: classrooms/{classId}/writing_submissions/{submissionId}
 * （既存の EikenWriting ローカル保存形式には一切影響を与えない）
 */
export async function submitWritingToClass(
  input: SubmitWritingInput,
): Promise<SugorokuWritingSubmissionDoc> {
  const trimmed = input.text.trim();
  if (!trimmed) {
    throw new Error('提出する英文を入力してください。');
  }
  const classId = input.classId || SUGOROKU_DEMO_CLASS_ID;
  const studentUid = input.studentUid || auth.currentUser?.uid || 'guest';
  const now = Date.now();
  const submissionId = `${studentUid}_${input.taskKey}_${now}`.replace(/[^A-Za-z0-9_-]/g, '_');

  const payload: SugorokuWritingSubmissionDoc = {
    id: submissionId,
    classId,
    studentUid,
    studentName: (input.studentName || '塾生').trim().slice(0, 60),
    grade: input.grade,
    taskKey: input.taskKey,
    taskTitle: input.taskTitle,
    wordCount: input.wordCount,
    text: trimmed,
    formatWarnings: input.formatWarnings,
    status: 'submitted',
    submittedAt: now,
  };

  // 常にローカルにも控えを残す（オフライン・即時UI反映・クラウド未接続デモ両対応）
  upsertLocalSubmission(payload);

  if (cloudEnabledForClass(classId)) {
    const ref = doc(db, 'classrooms', classId, 'writing_submissions', submissionId);
    const firestoreData: Record<string, unknown> = {
      studentUid: payload.studentUid,
      studentName: payload.studentName,
      grade: payload.grade,
      taskKey: payload.taskKey,
      wordCount: payload.wordCount,
      text: payload.text,
      formatWarnings: payload.formatWarnings,
      status: payload.status,
      submittedAt: payload.submittedAt,
    };
    if (payload.taskTitle) firestoreData.taskTitle = payload.taskTitle;
    await setDoc(ref, firestoreData);
  }

  return payload;
}

/**
 * 生徒：特定課題について自分の提出・返却履歴を取得する（新しい順）
 */
export async function fetchStudentWritingSubmissions(
  classId: string,
  studentUid: string,
  taskKey?: string,
): Promise<SugorokuWritingSubmissionDoc[]> {
  const local = readLocalSubmissions().filter(
    item =>
      item.classId === classId &&
      item.studentUid === studentUid &&
      (!taskKey || item.taskKey === taskKey),
  );

  if (!cloudEnabledForClass(classId)) {
    return local.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  try {
    const colRef = collection(db, 'classrooms', classId, 'writing_submissions');
    const q = query(colRef, where('studentUid', '==', studentUid));
    const snap = await getDocs(q);
    const remote = snap.docs
      .map(d => ({ ...(d.data() as SugorokuWritingSubmissionDoc), id: d.id, classId }))
      .filter(item => !taskKey || item.taskKey === taskKey);

    const byId = new Map<string, SugorokuWritingSubmissionDoc>();
    for (const item of [...local, ...remote]) {
      if (item.id) byId.set(item.id, item);
    }
    return [...byId.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  } catch {
    return local.sort((a, b) => b.submittedAt - a.submittedAt);
  }
}

/**
 * 講師：クラス全体のライティング提出答案一覧を取得する（新しい順）
 */
export async function fetchClassWritingSubmissions(
  classId: string,
  options?: { includeDemoSamples?: boolean },
): Promise<SugorokuWritingSubmissionDoc[]> {
  const local = readLocalSubmissions().filter(item => item.classId === classId);
  const includeDemo =
    options?.includeDemoSamples ?? classId === SUGOROKU_DEMO_CLASS_ID;

  if (!cloudEnabledForClass(classId)) {
    const merged = new Map<string, SugorokuWritingSubmissionDoc>();
    if (includeDemo) {
      for (const demo of DEMO_WRITING_SUBMISSIONS) {
        if (demo.id) merged.set(demo.id, demo);
      }
    }
    for (const item of local) {
      if (item.id) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  }

  const colRef = collection(db, 'classrooms', classId, 'writing_submissions');
  const snap = await getDocs(colRef);
  const remote = snap.docs.map(d => ({
    ...(d.data() as SugorokuWritingSubmissionDoc),
    id: d.id,
    classId,
  }));

  const merged = new Map<string, SugorokuWritingSubmissionDoc>();
  for (const item of [...local, ...remote]) {
    if (item.id) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * 講師：添削結果（スコア・コメント・添削英文）を保存して生徒へ返却する
 */
export async function saveWritingReview(
  classId: string,
  submission: SugorokuWritingSubmissionDoc,
  reviewInput: Omit<SugorokuWritingReview, 'reviewedAt'> & { reviewedAt?: number },
): Promise<SugorokuWritingSubmissionDoc> {
  if (!submission.id) {
    throw new Error('提出IDが不明なため添削を保存できません。');
  }
  const reviewedAt = reviewInput.reviewedAt ?? Date.now();
  const review: SugorokuWritingReview = {
    reviewerUid: reviewInput.reviewerUid || auth.currentUser?.uid || 'teacher_local',
    reviewerName: reviewInput.reviewerName?.trim() || undefined,
    score: reviewInput.score,
    maxScore: reviewInput.maxScore ?? 16,
    rubricScores: reviewInput.rubricScores,
    comment: reviewInput.comment.trim(),
    correctedText: reviewInput.correctedText?.trim() || undefined,
    strengths: reviewInput.strengths?.trim() || undefined,
    nextActions: reviewInput.nextActions?.trim() || undefined,
    reviewedAt,
  };

  const updated: SugorokuWritingSubmissionDoc = {
    ...submission,
    classId,
    status: 'reviewed',
    review,
  };

  upsertLocalSubmission(updated);

  if (cloudEnabledForClass(classId)) {
    const ref = doc(db, 'classrooms', classId, 'writing_submissions', submission.id);
    // Firestore は undefined フィールドを拒否するため定義済みプロパティのみ整形
    const cleanReview: Record<string, unknown> = {
      reviewerUid: review.reviewerUid,
      score: review.score,
      maxScore: review.maxScore ?? 16,
      comment: review.comment,
      reviewedAt: review.reviewedAt,
    };
    if (review.reviewerName) cleanReview.reviewerName = review.reviewerName;
    if (review.rubricScores) cleanReview.rubricScores = review.rubricScores;
    if (review.correctedText) cleanReview.correctedText = review.correctedText;
    if (review.strengths) cleanReview.strengths = review.strengths;
    if (review.nextActions) cleanReview.nextActions = review.nextActions;

    await updateDoc(ref, {
      status: 'reviewed',
      review: cleanReview,
    });
  }

  return updated;
}
