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
import {
  buildSpeakingStoragePath,
  type SugorokuSpeakingAudioExt,
  type SugorokuSpeakingPartId,
  type SugorokuSpeakingRecordingItem,
  type SugorokuSpeakingReview,
  type SugorokuSpeakingSubmissionDoc,
} from '../shared/types';
import { uploadSpeakingAudio } from '../shared/storageClient';
import { SUGOROKU_DEMO_CLASS_ID } from '../writing-review/writingStore';
import { SCBT_PART_ORDER, type ScbtSpeakingSet } from './speakingTypes';

const LOCAL_SPEAKING_SUBMISSIONS_KEY = 'sugoroku_speaking_submissions_v1';

/**
 * 講師レビュー画面のデモ・初期確認用サンプル提出（合成デモ音声URLと接続）
 */
export const DEMO_SPEAKING_SUBMISSIONS: readonly SugorokuSpeakingSubmissionDoc[] = [
  {
    id: 'demo_sp_001',
    classId: SUGOROKU_DEMO_CLASS_ID,
    studentUid: 'demo_student_sato',
    studentName: '佐藤 健太（高2・サッカー部）',
    grade: 'eiken_2',
    setId: 'scbt_g2_set01',
    setTitle: '2級 S-CBT模擬 第1回：地域のスポーツ用具シェアリング',
    recordings: [
      {
        partId: 'reading_aloud',
        storagePath: 'demo://scbt_g2_set01/sato/reading_aloud',
        mimeType: 'audio/wav',
        durationSec: 34.2,
      },
      {
        partId: 'q1',
        storagePath: 'demo://scbt_g2_set01/sato/q1',
        mimeType: 'audio/wav',
        durationSec: 11.5,
      },
      {
        partId: 'q2',
        storagePath: 'demo://scbt_g2_set01/sato/q2',
        mimeType: 'audio/wav',
        durationSec: 36.8,
      },
      {
        partId: 'q3',
        storagePath: 'demo://scbt_g2_set01/sato/q3',
        mimeType: 'audio/wav',
        durationSec: 27.4,
      },
      {
        partId: 'q4',
        storagePath: 'demo://scbt_g2_set01/sato/q4',
        mimeType: 'audio/wav',
        durationSec: 29.0,
      },
    ],
    status: 'submitted',
    submittedAt: Date.now() - 2 * 60 * 60 * 1000,
  },
  {
    id: 'demo_sp_002',
    classId: SUGOROKU_DEMO_CLASS_ID,
    studentUid: 'demo_student_yamamoto',
    studentName: '山本 彩花（高1・バスケ部）',
    grade: 'eiken_pre2',
    setId: 'scbt_pre2_set01',
    setTitle: '準2級 S-CBT模擬 第1回：地域の自転車レーンと安全マナー',
    recordings: [
      {
        partId: 'reading_aloud',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/reading_aloud',
        mimeType: 'audio/wav',
        durationSec: 28.5,
      },
      {
        partId: 'q1',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q1',
        mimeType: 'audio/wav',
        durationSec: 9.2,
      },
      {
        partId: 'q2',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q2',
        mimeType: 'audio/wav',
        durationSec: 24.0,
      },
      {
        partId: 'q3',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q3',
        mimeType: 'audio/wav',
        durationSec: 19.6,
      },
      {
        partId: 'q4',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q4',
        mimeType: 'audio/wav',
        durationSec: 23.1,
      },
    ],
    status: 'reviewed',
    submittedAt: Date.now() - 26 * 60 * 60 * 1000,
    review: {
      reviewerUid: 'demo_teacher_fujisawa',
      reviewerName: '藤沢 卓登（英検対策担当）',
      rubricScores: {
        reading_aloud: 4,
        q1: 5,
        q2: 4,
        q3: 4,
        q4: 8,
        attitude: 3,
      },
      comment:
        '声がハキハキしていてS-CBTのマイク録音でも非常に聞き取りやすいです！No.2の現在進行形も4人分しっかり言えました。No.3の because の後ろで少し詰まったので、「He wants to ~, but he cannot ~ because ...」の型を口慣らししておくと本番もバッチリです！',
      reviewedAt: Date.now() - 18 * 60 * 60 * 1000,
    },
  },
];

function readLocalSpeakingSubmissions(): SugorokuSpeakingSubmissionDoc[] {
  const store = safeLocalStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(LOCAL_SPEAKING_SUBMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SugorokuSpeakingSubmissionDoc[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSpeakingSubmissions(items: SugorokuSpeakingSubmissionDoc[]): void {
  const store = safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(LOCAL_SPEAKING_SUBMISSIONS_KEY, JSON.stringify(items.slice(0, 120)));
  } catch {
    // ignore quota error
  }
}

function upsertLocalSpeakingSubmission(docItem: SugorokuSpeakingSubmissionDoc): void {
  const current = readLocalSpeakingSubmissions();
  const next = [docItem, ...current.filter(item => item.id !== docItem.id)];
  writeLocalSpeakingSubmissions(next);
}

function cloudEnabledForClass(classId: string): boolean {
  return (
    Boolean(classId) &&
    classId !== SUGOROKU_DEMO_CLASS_ID &&
    (FIREBASE_CONFIGURED || USE_EMULATORS) &&
    Boolean(auth.currentUser?.uid)
  );
}

export interface PartClipUploadInput {
  partId: SugorokuSpeakingPartId;
  blob: Blob;
  mimeType: string;
  extension: SugorokuSpeakingAudioExt;
  durationSec: number;
}

export interface SubmitSpeakingInput {
  classId: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  set: ScbtSpeakingSet;
  clips: Record<SugorokuSpeakingPartId, PartClipUploadInput | undefined>;
}

/**
 * 生徒：全5パート（音読＋No.1〜No.4）の録音データを Storage へ保存し、
 * Firestore `classrooms/{classId}/speaking_submissions/{submissionId}` に提出レコードを作成する。
 */
export async function submitSpeakingSession(
  input: SubmitSpeakingInput,
): Promise<SugorokuSpeakingSubmissionDoc> {
  const classId = input.classId || SUGOROKU_DEMO_CLASS_ID;
  const uid = input.studentUid || auth.currentUser?.uid || 'guest';
  const now = Date.now();
  const submissionId = `${uid}_${input.set.id}_${now}`.replace(/[^A-Za-z0-9_-]/g, '_');

  const missing = SCBT_PART_ORDER.filter(partId => !input.clips[partId]);
  if (missing.length > 0) {
    throw new Error(`未録音のパートがあります（残り ${missing.length} パート）。すべて録音してから提出してください。`);
  }

  const recordings: SugorokuSpeakingRecordingItem[] = [];
  for (const partId of SCBT_PART_ORDER) {
    const clip = input.clips[partId]!;
    const storagePath = buildSpeakingStoragePath(
      classId,
      uid,
      submissionId,
      partId,
      clip.extension,
    );
    const uploaded = await uploadSpeakingAudio(storagePath, clip.blob, clip.mimeType);
    recordings.push({
      partId,
      storagePath: uploaded.storagePath,
      mimeType: clip.mimeType,
      durationSec: clip.durationSec,
      sizeBytes: uploaded.sizeBytes,
    });
  }

  const payload: SugorokuSpeakingSubmissionDoc = {
    id: submissionId,
    classId,
    studentUid: uid,
    studentName: (input.studentName || 'すごろく塾生').trim().slice(0, 60),
    grade: input.grade,
    setId: input.set.id,
    setTitle: input.set.title,
    recordings,
    status: 'submitted',
    submittedAt: now,
  };

  upsertLocalSpeakingSubmission(payload);

  if (cloudEnabledForClass(classId)) {
    const ref = doc(db, 'classrooms', classId, 'speaking_submissions', submissionId);
    await setDoc(ref, {
      studentUid: payload.studentUid,
      studentName: payload.studentName,
      grade: payload.grade,
      setId: payload.setId,
      setTitle: payload.setTitle || input.set.title,
      recordings: payload.recordings.map(r => ({
        partId: r.partId,
        storagePath: r.storagePath,
        mimeType: r.mimeType,
        durationSec: r.durationSec,
      })),
      status: payload.status,
      submittedAt: payload.submittedAt,
    });
  }

  return payload;
}

/**
 * 生徒：自分のスピーキング提出＆講師講評履歴を取得する
 */
export async function fetchStudentSpeakingSubmissions(
  classId: string,
  studentUid: string,
  setId?: string,
): Promise<SugorokuSpeakingSubmissionDoc[]> {
  const local = readLocalSpeakingSubmissions().filter(
    item =>
      item.classId === classId &&
      item.studentUid === studentUid &&
      (!setId || item.setId === setId),
  );

  if (!cloudEnabledForClass(classId)) {
    return local.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  try {
    const colRef = collection(db, 'classrooms', classId, 'speaking_submissions');
    const q = query(colRef, where('studentUid', '==', studentUid));
    const snap = await getDocs(q);
    const remote = snap.docs
      .map(d => ({ ...(d.data() as SugorokuSpeakingSubmissionDoc), id: d.id, classId }))
      .filter(item => !setId || item.setId === setId);

    const byId = new Map<string, SugorokuSpeakingSubmissionDoc>();
    for (const item of [...local, ...remote]) {
      if (item.id) byId.set(item.id, item);
    }
    return [...byId.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  } catch {
    return local.sort((a, b) => b.submittedAt - a.submittedAt);
  }
}

/**
 * 講師：クラス全体の S-CBT スピーキング録音提出一覧を取得する
 */
export async function fetchClassSpeakingSubmissions(
  classId: string,
  options?: { includeDemoSamples?: boolean },
): Promise<SugorokuSpeakingSubmissionDoc[]> {
  const local = readLocalSpeakingSubmissions().filter(item => item.classId === classId);
  const includeDemo =
    options?.includeDemoSamples ?? classId === SUGOROKU_DEMO_CLASS_ID;

  if (!cloudEnabledForClass(classId)) {
    const merged = new Map<string, SugorokuSpeakingSubmissionDoc>();
    if (includeDemo) {
      for (const demo of DEMO_SPEAKING_SUBMISSIONS) {
        if (demo.id) merged.set(demo.id, demo);
      }
    }
    for (const item of local) {
      if (item.id) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  }

  const colRef = collection(db, 'classrooms', classId, 'speaking_submissions');
  const snap = await getDocs(colRef);
  const remote = snap.docs.map(d => ({
    ...(d.data() as SugorokuSpeakingSubmissionDoc),
    id: d.id,
    classId,
  }));

  const merged = new Map<string, SugorokuSpeakingSubmissionDoc>();
  for (const item of [...local, ...remote]) {
    if (item.id) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * 講師：スピーキング評価スコア・講評コメントを保存して生徒へ返却する
 */
export async function saveSpeakingReview(
  classId: string,
  submission: SugorokuSpeakingSubmissionDoc,
  reviewInput: Omit<SugorokuSpeakingReview, 'reviewedAt'> & { reviewedAt?: number },
): Promise<SugorokuSpeakingSubmissionDoc> {
  if (!submission.id) {
    throw new Error('提出IDが不明なため評価を保存できません。');
  }
  const reviewedAt = reviewInput.reviewedAt ?? Date.now();
  const review: SugorokuSpeakingReview = {
    reviewerUid: reviewInput.reviewerUid || auth.currentUser?.uid || 'teacher_local',
    reviewerName: reviewInput.reviewerName?.trim() || undefined,
    rubricScores: reviewInput.rubricScores,
    comment: reviewInput.comment.trim(),
    reviewedAt,
  };

  const updated: SugorokuSpeakingSubmissionDoc = {
    ...submission,
    classId,
    status: 'reviewed',
    review,
  };

  upsertLocalSpeakingSubmission(updated);

  if (cloudEnabledForClass(classId)) {
    const ref = doc(db, 'classrooms', classId, 'speaking_submissions', submission.id);
    const cleanReview: Record<string, unknown> = {
      reviewerUid: review.reviewerUid,
      rubricScores: review.rubricScores,
      comment: review.comment,
      reviewedAt: review.reviewedAt,
    };
    if (review.reviewerName) cleanReview.reviewerName = review.reviewerName;

    await updateDoc(ref, {
      status: 'reviewed',
      review: cleanReview,
    });
  }

  return updated;
}
