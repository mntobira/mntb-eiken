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
import type { RecordedClip } from './audioRecorder';
import { SCBT_PART_ORDER, type ScbtSpeakingSet } from './speakingTypes';

const LOCAL_SPEAKING_SUBMISSIONS_KEY = 'sugoroku_speaking_submissions_v1';
const DRAFT_IDB_NAME = 'sugoroku_speaking_drafts_v1';
const DRAFT_IDB_STORE = 'draft_clips';

const memoryDraftFallback = new Map<string, Omit<RecordedClip, 'objectUrl'>>();

function draftKey(uid: string, setId: string, partId: SugorokuSpeakingPartId): string {
  return `${uid || 'guest'}::${setId}::${partId}`;
}

function openDraftIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DRAFT_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(DRAFT_IDB_STORE)) {
          database.createObjectStore(DRAFT_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * iPad / スマホでの画面ロックや誤リロード事故を防ぐため、
 * 1パート録音完了ごとに IndexedDB へ途中録音を自動退避する。
 */
export async function saveDraftSpeakingClip(
  uid: string,
  setId: string,
  partId: SugorokuSpeakingPartId,
  clip: RecordedClip,
): Promise<void> {
  const key = draftKey(uid, setId, partId);
  const record: Omit<RecordedClip, 'objectUrl'> = {
    blob: clip.blob,
    mimeType: clip.mimeType,
    extension: clip.extension,
    durationSec: clip.durationSec,
    sizeBytes: clip.sizeBytes,
    speechRatio: clip.speechRatio,
    maxSilenceSec: clip.maxSilenceSec,
    transcript: clip.transcript,
  };
  memoryDraftFallback.set(key, record);

  const idb = await openDraftIdb();
  if (!idb) return;
  await new Promise<void>(resolve => {
    try {
      const tx = idb.transaction(DRAFT_IDB_STORE, 'readwrite');
      tx.objectStore(DRAFT_IDB_STORE).put(record, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadDraftSpeakingClips(
  uid: string,
  setId: string,
): Promise<Partial<Record<SugorokuSpeakingPartId, RecordedClip>>> {
  const restored: Partial<Record<SugorokuSpeakingPartId, RecordedClip>> = {};
  const idb = await openDraftIdb();

  for (const partId of SCBT_PART_ORDER) {
    const key = draftKey(uid, setId, partId);
    let stored: Omit<RecordedClip, 'objectUrl'> | undefined = memoryDraftFallback.get(key);
    if (!stored && idb) {
      stored = await new Promise<Omit<RecordedClip, 'objectUrl'> | undefined>(resolve => {
        try {
          const tx = idb.transaction(DRAFT_IDB_STORE, 'readonly');
          const req = tx.objectStore(DRAFT_IDB_STORE).get(key);
          req.onsuccess = () =>
            resolve(req.result as Omit<RecordedClip, 'objectUrl'> | undefined);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      });
    }
    if (stored && stored.blob && stored.blob.size > 0) {
      const objectUrl =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(stored.blob)
          : '';
      restored[partId] = { ...stored, objectUrl };
    }
  }
  return restored;
}

export async function clearDraftSpeakingClips(uid: string, setId: string): Promise<void> {
  for (const partId of SCBT_PART_ORDER) {
    memoryDraftFallback.delete(draftKey(uid, setId, partId));
  }
  const idb = await openDraftIdb();
  if (!idb) return;
  await new Promise<void>(resolve => {
    try {
      const tx = idb.transaction(DRAFT_IDB_STORE, 'readwrite');
      const store = tx.objectStore(DRAFT_IDB_STORE);
      for (const partId of SCBT_PART_ORDER) {
        store.delete(draftKey(uid, setId, partId));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

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
        speechRatio: 78,
        maxSilenceSec: 1.4,
        transcript:
          'Sharing Sports Gear in Communities. Many teenagers want to try new sports at school, but buying rackets, shoes, and uniforms can be expensive for their families.',
      },
      {
        partId: 'q1',
        storagePath: 'demo://scbt_g2_set01/sato/q1',
        mimeType: 'audio/wav',
        durationSec: 11.5,
        speechRatio: 71,
        maxSilenceSec: 1.9,
        transcript:
          'By holding weekend workshops where experienced players teach students how to take care of their gear.',
      },
      {
        partId: 'q2',
        storagePath: 'demo://scbt_g2_set01/sato/q2',
        mimeType: 'audio/wav',
        durationSec: 36.8,
        speechRatio: 64,
        maxSilenceSec: 4.3,
        transcript:
          'Last month Misaki and her teacher were looking at a torn practice net. The next Saturday Misaki went to a free repair workshop at the city gym. Two weeks later Misaki was happy to practice with new members.',
      },
      {
        partId: 'q3',
        storagePath: 'demo://scbt_g2_set01/sato/q3',
        mimeType: 'audio/wav',
        durationSec: 27.4,
        speechRatio: 68,
        maxSilenceSec: 2.6,
        transcript:
          'Yes. Borrowing sports equipment helps students try different sports without spending too much money.',
      },
      {
        partId: 'q4',
        storagePath: 'demo://scbt_g2_set01/sato/q4',
        mimeType: 'audio/wav',
        durationSec: 29.0,
        speechRatio: 62,
        maxSilenceSec: 4.8,
        transcript:
          'Yes, I think public gyms should stay open later at night because high school students finish club activities late.',
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
        speechRatio: 82,
        maxSilenceSec: 1.1,
      },
      {
        partId: 'q1',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q1',
        mimeType: 'audio/wav',
        durationSec: 9.2,
        speechRatio: 75,
        maxSilenceSec: 1.5,
      },
      {
        partId: 'q2',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q2',
        mimeType: 'audio/wav',
        durationSec: 24.0,
        speechRatio: 73,
        maxSilenceSec: 2.0,
      },
      {
        partId: 'q3',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q3',
        mimeType: 'audio/wav',
        durationSec: 19.6,
        speechRatio: 58,
        maxSilenceSec: 4.5,
      },
      {
        partId: 'q4',
        storagePath: 'demo://scbt_pre2_set01/yamamoto/q4',
        mimeType: 'audio/wav',
        durationSec: 23.1,
        speechRatio: 74,
        maxSilenceSec: 1.8,
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
  speechRatio?: number;
  maxSilenceSec?: number;
  transcript?: string;
}

export interface SubmitSpeakingInput {
  classId: string;
  studentUid: string;
  studentName: string;
  grade: EikenGrade;
  set: ScbtSpeakingSet;
  clips: Record<SugorokuSpeakingPartId, PartClipUploadInput | undefined>;
}

export async function submitSpeakingSession(
  input: SubmitSpeakingInput,
): Promise<SugorokuSpeakingSubmissionDoc> {
  const classId = input.classId || SUGOROKU_DEMO_CLASS_ID;
  const uid = input.studentUid || auth.currentUser?.uid || 'guest';
  const now = Date.now();
  const submissionId = `${uid}_${input.set.id}_${now}`.replace(/[^A-Za-z0-9_-]/g, '_');

  const missing = SCBT_PART_ORDER.filter(partId => !input.clips[partId]);
  if (missing.length > 0) {
    throw new Error(
      `未録音のパートがあります（残り ${missing.length} パート）。すべて録音してから提出してください。`,
    );
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
      speechRatio: clip.speechRatio,
      maxSilenceSec: clip.maxSilenceSec,
      transcript: clip.transcript?.trim() || undefined,
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
  await clearDraftSpeakingClips(uid, input.set.id);

  if (cloudEnabledForClass(classId)) {
    const ref = doc(db, 'classrooms', classId, 'speaking_submissions', submissionId);
    await setDoc(ref, {
      studentUid: payload.studentUid,
      studentName: payload.studentName,
      grade: payload.grade,
      setId: payload.setId,
      setTitle: payload.setTitle || input.set.title,
      recordings: payload.recordings.map(r => {
        const row: Record<string, unknown> = {
          partId: r.partId,
          storagePath: r.storagePath,
          mimeType: r.mimeType,
          durationSec: r.durationSec,
        };
        if (typeof r.speechRatio === 'number') row.speechRatio = r.speechRatio;
        if (typeof r.maxSilenceSec === 'number') row.maxSilenceSec = r.maxSilenceSec;
        if (r.transcript) row.transcript = r.transcript;
        return row;
      }),
      status: payload.status,
      submittedAt: payload.submittedAt,
    });
  }

  return payload;
}

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

function isFirestorePermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code || '').toLowerCase();
  const message = String((err as { message?: unknown }).message || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    message.includes('missing or insufficient permissions') ||
    message.includes('permission_denied')
  );
}

export async function fetchClassSpeakingSubmissions(
  classId: string,
  options?: { includeDemoSamples?: boolean; fallbackSubmissions?: readonly SugorokuSpeakingSubmissionDoc[] },
): Promise<SugorokuSpeakingSubmissionDoc[]> {
  const local = readLocalSpeakingSubmissions().filter(item => item.classId === classId);
  const seeded = (options?.fallbackSubmissions ?? []).filter(item => item.classId === classId || !item.classId);
  const includeDemo =
    options?.includeDemoSamples ?? classId === SUGOROKU_DEMO_CLASS_ID;

  if (!cloudEnabledForClass(classId)) {
    const merged = new Map<string, SugorokuSpeakingSubmissionDoc>();
    if (includeDemo) {
      for (const demo of DEMO_SPEAKING_SUBMISSIONS) {
        if (demo.id) merged.set(demo.id, demo);
      }
    }
    for (const item of [...seeded, ...local]) {
      if (item.id) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
  }

  let remote: SugorokuSpeakingSubmissionDoc[] = [];
  try {
    const colRef = collection(db, 'classrooms', classId, 'speaking_submissions');
    const snap = await getDocs(colRef);
    remote = snap.docs.map(d => ({
      ...(d.data() as SugorokuSpeakingSubmissionDoc),
      id: d.id,
      classId,
    }));
  } catch (err) {
    if (!isFirestorePermissionDenied(err)) {
      throw new Error('スピーキング提出音声一覧の取得に失敗しました。通信環境を確認してください。');
    }
    remote = [];
  }

  const merged = new Map<string, SugorokuSpeakingSubmissionDoc>();
  for (const item of [...seeded, ...local, ...remote]) {
    if (item.id) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => b.submittedAt - a.submittedAt);
}

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

    try {
      await updateDoc(ref, {
        status: 'reviewed',
        review: cleanReview,
      });
    } catch (err) {
      if (isFirestorePermissionDenied(err)) {
        throw new Error('クラウドへの評価返却権限が確認できませんでした（この端末には保存済みです）。クラスの塾プラン設定を確認してください。');
      }
      throw new Error('評価結果のクラウド保存に失敗しました。通信環境を確認してください。');
    }
  }

  return updated;
}
