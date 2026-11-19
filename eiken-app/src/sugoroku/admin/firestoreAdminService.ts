/**
 * ===================================================================
 * すごろく塾管理者ポータル：Firestore 実データ取得アダプタ
 * ===================================================================
 * 既存の classroom.ts / classAssignments.ts / study_progress に加え、
 * AI 2・AI 3・AI 4 が読み書きする第2章Bの共通データ契約コレクションを安全に読み取る。
 *
 * 未作成コレクションやオフライン時でも例外で画面を落とさず、取得できた範囲で統合表示する。
 */

import { auth, db, FIREBASE_CONFIGURED } from '../../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
} from '../../utils/firestoreMetered';
import {
  fetchClassMembers,
  fetchMyClassrooms,
  setRosterName as setCoreRosterName,
} from '../../utils/classroom';
import { resolveRosterName, type ClassroomDoc } from '../../utils/classroomCore';
import { fetchAssignments as fetchLegacyAssignments } from '../../utils/classAssignments';
import { STUDY_PROGRESS_COLLECTION } from '../../utils/studySync';
import type { SolvedMap } from '../../utils/studySyncCore';
import { isEikenGrade, type EikenGrade } from '../../eiken/config';
import {
  SUGOROKU_COLLECTIONS,
  type SugorokuAssignmentDoc,
  type SugorokuMemberDoc,
  type SugorokuSpeakingSubmissionDoc,
  type SugorokuStudyLogDoc,
  type SugorokuWritingSubmissionDoc,
} from '../shared/types';

export interface LoadedClassPortalData {
  classroom: ClassroomDoc;
  members: SugorokuMemberDoc[];
  logsByUid: Record<string, SugorokuStudyLogDoc[]>;
  solvedByUid: Record<string, Record<string, number>>;
  assignments: SugorokuAssignmentDoc[];
  writingSubmissions: SugorokuWritingSubmissionDoc[];
  speakingSubmissions: SugorokuSpeakingSubmissionDoc[];
}

/**
 * 管理者ポータル認可チェック（AI 4 の本格ルールと協調するフロント側ガード）
 * - ログイン済みであり、①担当クラス（teacherUid === uid）を1つ以上持つ、
 *   ②sugoroku_members で owner/staff ロールを持つ、または ③環境変数許可メールに含まれること
 */
export function getConfiguredAdminEmails(): string[] {
  const raw =
    (import.meta.env.VITE_SUGOROKU_ADMIN_EMAILS as string | undefined) ||
    'mntobira@gmail.com';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailPreAuthorizedAdmin(email: string | null | undefined): boolean {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  return getConfiguredAdminEmails().includes(normalized);
}

/** 自分が管理可能なクラス一覧を取得 */
export async function fetchManageableClassrooms(): Promise<ClassroomDoc[]> {
  if (!FIREBASE_CONFIGURED || !auth.currentUser) return [];
  const ownRooms = await fetchMyClassrooms();
  // すごろく塾クラス（plan === 'juku'）を優先して先頭に並べる
  return [...ownRooms].sort((a, b) => {
    const aj = a.plan === 'juku' ? 0 : 1;
    const bj = b.plan === 'juku' ? 0 : 1;
    if (aj !== bj) return aj - bj;
    return (a.className || '').localeCompare(b.className || '', 'ja');
  });
}

/**
 * 指定クラスの塾生・学習時間ログ・宿題・ライティング提出・スピーキング提出を一括取得する
 */
export async function loadClassPortalData(
  classroom: ClassroomDoc,
): Promise<LoadedClassPortalData> {
  const classId = classroom.id;

  // 1. 既存 class_members と sugoroku_members サブコレクションを統合
  const baseMembers = await fetchClassMembers(classId).catch(() => []);
  const sugorokuMetaByUid = new Map<string, Partial<SugorokuMemberDoc>>();

  try {
    const subSnap = await getDocs(
      collection(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`),
    );
    subSnap.docs.forEach((d) => {
      const data = d.data() as Partial<SugorokuMemberDoc>;
      sugorokuMetaByUid.set(d.id, data);
    });
  } catch {
    // ルール未反映やサブコレクション空の場合はスキップ
  }

  const defaultGrade: EikenGrade = isEikenGrade(classroom.subject)
    ? classroom.subject
    : 'eiken_2';

  const memberUids = new Set<string>([
    ...baseMembers.map((m) => m.uid),
    ...[...sugorokuMetaByUid.entries()]
      .filter(([, m]) => (m.role ?? 'student') === 'student' && m.active !== false)
      .map(([uid]) => uid),
  ]);

  const members: SugorokuMemberDoc[] = [...memberUids].map((uid) => {
    const base = baseMembers.find((m) => m.uid === uid);
    const meta = sugorokuMetaByUid.get(uid);
    const targetGrade = isEikenGrade(meta?.targetGrade) ? meta.targetGrade : defaultGrade;
    const roster =
      (meta?.rosterName || '').trim() ||
      (base ? resolveRosterName(base) : '') ||
      (meta?.displayName || '').trim() ||
      '（名前未設定）';
    return {
      uid,
      classId,
      role: meta?.role ?? 'student',
      rosterName: roster,
      displayName: base?.displayName ?? meta?.displayName ?? '',
      targetGrade,
      active: meta?.active !== false,
      adFree: meta?.adFree ?? true,
      note: meta?.note,
    };
  });

  // 2. 宿題一覧（サブコレクション classrooms/{classId}/assignments と既存 class_assignments を統合）
  const assignmentMap = new Map<string, SugorokuAssignmentDoc>();
  try {
    const legacy = await fetchLegacyAssignments(classId);
    for (const a of legacy) {
      assignmentMap.set(a.id, {
        id: a.id,
        classId: a.classId,
        teacherUid: a.teacherUid,
        title: a.title,
        chapterIds: a.chapterIds,
        dueAt: a.dueAt,
      });
    }
  } catch {
    // ignore
  }
  try {
    const subAsg = await getDocs(
      collection(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.assignments}`),
    );
    subAsg.docs.forEach((row) => {
      const data = row.data() as Omit<SugorokuAssignmentDoc, 'id'>;
      assignmentMap.set(row.id, {
        ...data,
        id: row.id,
        classId,
        chapterIds: Array.isArray(data.chapterIds) ? data.chapterIds : [],
      });
    });
  } catch {
    // ignore
  }

  // 3. 各生徒の sugoroku_study_logs と study_progress（解答済み問題数）を並列取得
  const logsByUid: Record<string, SugorokuStudyLogDoc[]> = {};
  const solvedByUid: Record<string, Record<string, number>> = {};

  await Promise.all(
    members.map(async (member) => {
      // 3a. users/{uid}/sugoroku_study_logs
      try {
        const logSnap = await getDocs(
          collection(db, `users/${member.uid}/${SUGOROKU_COLLECTIONS.sugorokuStudyLogs}`),
        );
        logsByUid[member.uid] = logSnap.docs.map((d) => {
          const raw = d.data() as Partial<SugorokuStudyLogDoc>;
          return {
            dateKey: raw.dateKey || d.id,
            totalActiveSeconds: Number(raw.totalActiveSeconds) || 0,
            byGradeSkill: (raw.byGradeSkill as Record<string, number>) || {},
            accuracyByGradeSkill: raw.accuracyByGradeSkill,
            solvedCount: Number(raw.solvedCount) || 0,
            updatedAt: Number(raw.updatedAt) || 0,
          };
        });
      } catch {
        logsByUid[member.uid] = [];
      }

      // 3b. study_progress/{uid} から単元別の解いた問題数を集計
      const chapterCounts: Record<string, number> = {};
      try {
        const progSnap = await getDoc(doc(db, STUDY_PROGRESS_COLLECTION, member.uid));
        const data = progSnap.exists() ? progSnap.data() || {} : {};
        const solved = (data.solved && typeof data.solved === 'object' ? data.solved : {}) as SolvedMap;
        Object.keys(solved).forEach((key) => {
          const cid = key.split('::')[0];
          if (cid) chapterCounts[cid] = (chapterCounts[cid] ?? 0) + 1;
        });
      } catch {
        // ignore
      }
      solvedByUid[member.uid] = chapterCounts;
    }),
  );

  // 4. ライティング提出一覧
  let writingSubmissions: SugorokuWritingSubmissionDoc[] = [];
  try {
    const wSnap = await getDocs(
      query(
        collection(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.writingSubmissions}`),
      ),
    );
    writingSubmissions = wSnap.docs
      .map((d) => ({ ...(d.data() as Omit<SugorokuWritingSubmissionDoc, 'id'>), id: d.id, classId }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  } catch {
    writingSubmissions = [];
  }

  // 5. スピーキング提出一覧
  let speakingSubmissions: SugorokuSpeakingSubmissionDoc[] = [];
  try {
    const sSnap = await getDocs(
      query(
        collection(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.speakingSubmissions}`),
      ),
    );
    speakingSubmissions = sSnap.docs
      .map((d) => ({ ...(d.data() as Omit<SugorokuSpeakingSubmissionDoc, 'id'>), id: d.id, classId }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  } catch {
    speakingSubmissions = [];
  }

  return {
    classroom,
    members,
    logsByUid,
    solvedByUid,
    assignments: [...assignmentMap.values()].sort((a, b) => a.dueAt - b.dueAt),
    writingSubmissions,
    speakingSubmissions,
  };
}

/** 講師が生徒の実名（rosterName）・目標級・指導メモを更新する */
export async function updateSugorokuStudentProfile(params: {
  classId: string;
  studentUid: string;
  rosterName: string;
  targetGrade: EikenGrade;
  note?: string;
}): Promise<void> {
  const trimmedName = params.rosterName.trim().slice(0, 32);
  if (trimmedName) {
    await setCoreRosterName(params.classId, params.studentUid, trimmedName).catch(() => undefined);
  }
  await setDoc(
    doc(
      db,
      `${SUGOROKU_COLLECTIONS.classrooms}/${params.classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
      params.studentUid,
    ),
    {
      uid: params.studentUid,
      classId: params.classId,
      role: 'student',
      rosterName: trimmedName,
      targetGrade: params.targetGrade,
      note: (params.note || '').trim().slice(0, 200),
      active: true,
      adFree: true,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
