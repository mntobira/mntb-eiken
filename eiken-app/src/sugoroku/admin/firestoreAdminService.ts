/**
 * すごろく塾管理者ポータル：Firestore 実データ取得＆複数講師（owner/staff）管理アダプタ
 */

import { auth, db, FIREBASE_CONFIGURED } from '../../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from '../../utils/firestoreMetered';
import {
  CLASSROOMS_COLLECTION,
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
  type SugorokuStaffInviteDoc,
  type SugorokuStudyLogDoc,
  type SugorokuWritingSubmissionDoc,
} from '../shared/types';

export interface LoadedClassPortalData {
  classroom: ClassroomDoc;
  viewerRole: 'owner' | 'staff';
  members: SugorokuMemberDoc[];
  staffInvites: SugorokuStaffInviteDoc[];
  logsByUid: Record<string, SugorokuStudyLogDoc[]>;
  solvedByUid: Record<string, Record<string, number>>;
  assignments: SugorokuAssignmentDoc[];
  writingSubmissions: SugorokuWritingSubmissionDoc[];
  speakingSubmissions: SugorokuSpeakingSubmissionDoc[];
}

export function normalizeStaffEmail(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

export function isValidStaffEmail(raw: string): boolean {
  const email = normalizeStaffEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120;
}

export function buildStaffInviteId(classId: string, rawEmail: string): string {
  return `${classId}_${normalizeStaffEmail(rawEmail)}`;
}

/** 環境変数で事前登録された初期管理者メール一覧 */
export function getConfiguredAdminEmails(): string[] {
  const raw =
    (import.meta.env.VITE_SUGOROKU_ADMIN_EMAILS as string | undefined) ||
    'mntobira@gmail.com';
  return raw
    .split(',')
    .map((s) => normalizeStaffEmail(s))
    .filter(Boolean);
}

export function isEmailPreAuthorizedAdmin(email: string | null | undefined): boolean {
  const normalized = normalizeStaffEmail(email || '');
  if (!normalized) return false;
  return getConfiguredAdminEmails().includes(normalized);
}

/**
 * 自分が管理可能なクラス一覧を取得（複数講師対応）：
 *  1) 自分が作成したクラス（teacherUid === currentUser.uid）→ role: 'owner'
 *  2) 自分のGoogleメール宛に招待されたクラス（sugoroku_staff_invites）→ 自動で sugoroku_members に昇格し role: 'staff'
 */
export async function fetchManageableClassrooms(): Promise<ClassroomDoc[]> {
  if (!FIREBASE_CONFIGURED || !auth.currentUser) return [];
  const uid = auth.currentUser.uid;
  const email = normalizeStaffEmail(auth.currentUser.email || '');

  const roomMap = new Map<string, ClassroomDoc>();

  // 1. 自分がオーナー（teacherUid）のクラス
  const ownRooms = await fetchMyClassrooms().catch(() => []);
  for (const r of ownRooms) {
    roomMap.set(r.id, r);
  }

  // 2. 自分のメール宛に発行されているスタッフ招待を検索し、未昇格なら sugoroku_members へ自動登録
  if (email) {
    try {
      const invSnap = await getDocs(
        query(
          collection(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites),
          where('email', '==', email),
        ),
      );
      await Promise.all(
        invSnap.docs.map(async (d) => {
          const inv = d.data() as SugorokuStaffInviteDoc;
          if (!inv.classId || inv.status === 'revoked') return;

          // 初回ログイン時に招待を active 化し、sugoroku_members/{uid} を自動作成
          if (inv.status === 'invited' || inv.acceptedUid !== uid) {
            const now = Date.now();
            await setDoc(
              doc(
                db,
                `${SUGOROKU_COLLECTIONS.classrooms}/${inv.classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
                uid,
              ),
              {
                uid,
                classId: inv.classId,
                role: 'staff',
                rosterName: inv.staffName || auth.currentUser?.displayName || email,
                displayName: auth.currentUser?.displayName || inv.staffName || '',
                email,
                targetGrade: 'eiken_2',
                active: true,
                adFree: true,
                joinedAt: now,
                updatedAt: now,
                serverUpdatedAt: serverTimestamp(),
              },
              { merge: true },
            ).catch(() => undefined);

            await setDoc(
              doc(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites, d.id),
              {
                status: 'active',
                acceptedUid: uid,
                updatedAt: now,
                serverUpdatedAt: serverTimestamp(),
              },
              { merge: true },
            ).catch(() => undefined);
          }

          if (!roomMap.has(inv.classId)) {
            const roomSnap = await getDoc(doc(db, CLASSROOMS_COLLECTION, inv.classId)).catch(
              () => null,
            );
            if (roomSnap && roomSnap.exists()) {
              roomMap.set(inv.classId, {
                ...(roomSnap.data() as ClassroomDoc),
                id: roomSnap.id,
              });
            }
          }
        }),
      );
    } catch {
      // ルール未反映時はオーナー分のみ返す
    }
  }

  return [...roomMap.values()].sort((a, b) => {
    const aj = a.plan === 'juku' ? 0 : 1;
    const bj = b.plan === 'juku' ? 0 : 1;
    if (aj !== bj) return aj - bj;
    return (a.className || '').localeCompare(b.className || '', 'ja');
  });
}

/** クラスの講師招待一覧を取得 */
export async function fetchClassStaffInvites(
  classId: string,
): Promise<SugorokuStaffInviteDoc[]> {
  if (!FIREBASE_CONFIGURED || !classId) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites),
        where('classId', '==', classId),
      ),
    );
    return snap.docs
      .map((d) => ({ ...(d.data() as SugorokuStaffInviteDoc), id: d.id }))
      .filter((inv) => inv.status !== 'revoked')
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch {
    return [];
  }
}

/** オーナー講師がスタッフ講師をGoogleメールアドレスで招待追加する */
export async function inviteSugorokuStaff(params: {
  classroom: Pick<ClassroomDoc, 'id' | 'className' | 'schoolName'>;
  email: string;
  staffName: string;
}): Promise<SugorokuStaffInviteDoc> {
  const email = normalizeStaffEmail(params.email);
  if (!isValidStaffEmail(email)) {
    throw new Error('有効なメールアドレスを入力してください');
  }
  const staffName = params.staffName.trim().slice(0, 32) || email.split('@')[0];
  const now = Date.now();
  const id = buildStaffInviteId(params.classroom.id, email);
  const invitedByUid = auth.currentUser?.uid || 'owner';

  const payload: SugorokuStaffInviteDoc = {
    id,
    classId: params.classroom.id,
    className: params.classroom.className,
    schoolName: params.classroom.schoolName,
    email,
    staffName,
    role: 'staff',
    status: 'invited',
    invitedByUid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    doc(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites, id),
    {
      ...payload,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
}

/** オーナー講師がスタッフ講師の権限を解除する */
export async function revokeSugorokuStaff(params: {
  classId: string;
  invite: SugorokuStaffInviteDoc;
}): Promise<void> {
  const now = Date.now();
  await setDoc(
    doc(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites, params.invite.id),
    {
      status: 'revoked',
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (params.invite.acceptedUid) {
    await setDoc(
      doc(
        db,
        `${SUGOROKU_COLLECTIONS.classrooms}/${params.classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
        params.invite.acceptedUid,
      ),
      {
        active: false,
        updatedAt: now,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => undefined);
  }
}

/**
 * 指定クラスの塾生・講師一覧・学習時間ログ・宿題・提出物を一括取得する
 */
export async function loadClassPortalData(
  classroom: ClassroomDoc,
): Promise<LoadedClassPortalData> {
  const classId = classroom.id;
  const currentUid = auth.currentUser?.uid || '';
  const viewerRole: 'owner' | 'staff' =
    classroom.teacherUid === currentUid ? 'owner' : 'staff';

  // 1. 既存 class_members と sugoroku_members サブコレクションを統合
  const baseMembers = await fetchClassMembers(classId).catch(() => []);
  const sugorokuMetaByUid = new Map<string, Partial<SugorokuMemberDoc>>();

  try {
    const subSnap = await getDocs(
      collection(
        db,
        `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
      ),
    );
    subSnap.docs.forEach((d) => {
      const data = d.data() as Partial<SugorokuMemberDoc>;
      sugorokuMetaByUid.set(d.id, data);
    });
  } catch {
    // ignore
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

  const members: SugorokuMemberDoc[] = [...memberUids]
    .filter((uid) => {
      const meta = sugorokuMetaByUid.get(uid);
      return (meta?.role ?? 'student') === 'student';
    })
    .map((uid) => {
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
        role: 'student',
        rosterName: roster,
        displayName: base?.displayName ?? meta?.displayName ?? '',
        targetGrade,
        active: meta?.active !== false,
        adFree: meta?.adFree ?? true,
        note: meta?.note,
      };
    });

  // 1b. 講師スタッフ招待一覧
  const staffInvites = await fetchClassStaffInvites(classId);

  // 2. 宿題一覧
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
      collection(
        db,
        `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.assignments}`,
      ),
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

  // 3. 各生徒のログと解答済み問題数
  const logsByUid: Record<string, SugorokuStudyLogDoc[]> = {};
  const solvedByUid: Record<string, Record<string, number>> = {};

  await Promise.all(
    members.map(async (member) => {
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

      const chapterCounts: Record<string, number> = {};
      try {
        const progSnap = await getDoc(doc(db, STUDY_PROGRESS_COLLECTION, member.uid));
        const data = progSnap.exists() ? progSnap.data() || {} : {};
        const solved = (
          data.solved && typeof data.solved === 'object' ? data.solved : {}
        ) as SolvedMap;
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
        collection(
          db,
          `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.writingSubmissions}`,
        ),
      ),
    );
    writingSubmissions = wSnap.docs
      .map((d) => ({
        ...(d.data() as Omit<SugorokuWritingSubmissionDoc, 'id'>),
        id: d.id,
        classId,
      }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  } catch {
    writingSubmissions = [];
  }

  // 5. スピーキング提出一覧
  let speakingSubmissions: SugorokuSpeakingSubmissionDoc[] = [];
  try {
    const sSnap = await getDocs(
      query(
        collection(
          db,
          `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.speakingSubmissions}`,
        ),
      ),
    );
    speakingSubmissions = sSnap.docs
      .map((d) => ({
        ...(d.data() as Omit<SugorokuSpeakingSubmissionDoc, 'id'>),
        id: d.id,
        classId,
      }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  } catch {
    speakingSubmissions = [];
  }

  return {
    classroom,
    viewerRole,
    members,
    staffInvites,
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
