/**
 * ===================================================================
 * すごろく塾管理者ポータル：Firestore 実データ取得 ＆ AI 2 / AI 3 / AI 4 完全連携アダプタ
 * ===================================================================
 * - AI 4 の `eiken_firestore.rules`・`SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS`（mntobira / hirokingz0927）・
 *   `sugoroku_members`（ルート＆クラス別サブコレクション）・`createClassroom + plan:'juku'` と完全整合
 * - AI 2 の宿題3系統（`class_assignments` / `sugoroku_homework_plans` / `classrooms/{id}/assignments`
 *   ＋ローカルキャッシュ）および学習時間2系統（サブコレクション＆フラット `sugoroku_study_logs`）を統合読取
 * - AI 3 のライティング・スピーキング提出（Firestore＋同一ブラウザローカル提出データ）を統合読取
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
  createClassroom,
  fetchClassMembers,
  fetchMyClassrooms,
  setRosterName as setCoreRosterName,
} from '../../utils/classroom';
import {
  resolveRosterName,
  type ClassroomDoc,
  type ClassroomInput,
} from '../../utils/classroomCore';
import { fetchAssignments as fetchLegacyAssignments } from '../../utils/classAssignments';
import { STUDY_PROGRESS_COLLECTION } from '../../utils/studySync';
import type { SolvedMap } from '../../utils/studySyncCore';
import { safeGetItem } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import { isEikenGrade, type EikenGrade } from '../../eiken/config';
import {
  SUGOROKU_COLLECTIONS,
  SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS,
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

const LOCAL_STAFF_INVITES_KEY = 'eiken:v1:sugoroku_staff_invites';
const AI2_LOCAL_PLANS_PREFIX = 'sugoroku_homework_plans_v1_';
const AI3_LOCAL_WRITING_KEY = 'sugoroku_writing_submissions_v1';
const AI3_LOCAL_SPEAKING_KEY = 'sugoroku_speaking_submissions_v1';

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

function readLocalStaffInvites(): SugorokuStaffInviteDoc[] {
  try {
    const raw = safeGetItem(LOCAL_STAFF_INVITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SugorokuStaffInviteDoc[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStaffInvites(list: SugorokuStaffInviteDoc[]): void {
  try {
    safeSetItem(LOCAL_STAFF_INVITES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * 事前承認済み講師メール一覧（SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS と完全一致）
 * `mntobira@gmail.com` と `hirokingz0927@gmail.com` は環境変数未設定でも必ず含まれる。
 */
export function getConfiguredAdminEmails(envOverride?: string): string[] {
  const raw =
    envOverride !== undefined
      ? envOverride
      : (import.meta.env.VITE_SUGOROKU_ADMIN_EMAILS as string | undefined) || '';
  const extra = raw
    .split(',')
    .map((s) => normalizeStaffEmail(s))
    .filter(Boolean);
  return Array.from(new Set([...SUGOROKU_DEFAULT_INSTRUCTOR_EMAILS, ...extra]));
}

export function isEmailPreAuthorizedAdmin(email: string | null | undefined): boolean {
  const normalized = normalizeStaffEmail(email || '');
  if (!normalized) return false;
  return getConfiguredAdminEmails().includes(normalized);
}

/**
 * 事前承認オーナー（mntobira / hirokingz0927）が初回ログインした際、
 * `eiken_sugoroku_members/{uid}` (role: 'owner') を自動ブートストラップする。
 */
export async function ensureRootInstructorBootstrap(): Promise<SugorokuMemberDoc | null> {
  if (!FIREBASE_CONFIGURED || !auth.currentUser) return null;
  const u = auth.currentUser;
  const uid = u.uid;
  const email = normalizeStaffEmail(u.email || '');

  try {
    const existingSnap = await getDoc(doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, uid));
    if (existingSnap.exists()) {
      const data = existingSnap.data() as SugorokuMemberDoc;
      if (data.active === false) return { ...data, uid };
      if (data.role === 'owner' || data.role === 'staff') {
        return { ...data, uid };
      }
    }
  } catch {
    // ignore
  }

  if (u.emailVerified && isEmailPreAuthorizedAdmin(email)) {
    const payload = {
      uid,
      role: 'owner' as const,
      active: true,
      adFree: true,
      ...(email ? { email } : {}),
      ...(u.displayName ? { displayName: u.displayName.slice(0, 32) } : {}),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, uid), payload, { merge: true });
      return {
        uid,
        role: 'owner',
        active: true,
        adFree: true,
        email,
        displayName: u.displayName || undefined,
      };
    } catch {
      return {
        uid,
        role: 'owner',
        active: true,
        adFree: true,
        email,
      };
    }
  }

  return null;
}

/**
 * 自分が管理可能なクラス一覧を取得：
 *  1) 事前承認オーナーのルート `sugoroku_members/{uid}` 自動ブートストラップ
 *  2) 自分が作成したクラス（`teacherUid === uid`）
 *  3) ルート `sugoroku_members/{uid}` の `role: 'owner' | 'staff'` の `classIds` に含まれるクラス
 *  4) メール招待コレクション（`sugoroku_staff_invites`）経由の招待クラス
 */
export async function fetchManageableClassrooms(): Promise<ClassroomDoc[]> {
  if (!FIREBASE_CONFIGURED || !auth.currentUser) return [];
  const email = normalizeStaffEmail(auth.currentUser.email || '');

  const roomMap = new Map<string, ClassroomDoc>();

  const rootMember = await ensureRootInstructorBootstrap();
  if (rootMember && rootMember.active === false) {
    return [];
  }

  // 1. 自分が teacherUid のクラス
  const ownRooms = await fetchMyClassrooms().catch(() => []);
  for (const r of ownRooms) {
    roomMap.set(r.id, r);
  }

  // 2. ルート sugoroku_members/{uid} の classIds（staff / owner 割当クラス）
  if (
    rootMember &&
    rootMember.active &&
    (rootMember.role === 'owner' || rootMember.role === 'staff') &&
    Array.isArray(rootMember.classIds)
  ) {
    await Promise.all(
      rootMember.classIds.map(async (cid) => {
        if (!cid || roomMap.has(cid)) return;
        const snap = await getDoc(doc(db, CLASSROOMS_COLLECTION, cid)).catch(() => null);
        if (snap && snap.exists()) {
          roomMap.set(cid, { ...(snap.data() as ClassroomDoc), id: snap.id });
        }
      }),
    );
  }

  // 3. メール招待コレクション（フォールバック）
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
          if (!roomMap.has(inv.classId)) {
            const roomSnap = await getDoc(doc(db, CLASSROOMS_COLLECTION, inv.classId)).catch(
              () => null,
            );
            if (roomSnap && roomSnap.exists()) {
              roomMap.set(inv.classId, { ...(roomSnap.data() as ClassroomDoc), id: roomSnap.id });
            }
          }
        }),
      );
    } catch {
      // ルール未定義時は静かにスキップ
    }
  }

  return [...roomMap.values()].sort((a, b) => {
    const aj = a.plan === 'juku' ? 0 : 1;
    const bj = b.plan === 'juku' ? 0 : 1;
    if (aj !== bj) return aj - bj;
    return (a.className || '').localeCompare(b.className || '', 'ja');
  });
}

/**
 * オーナー講師が管理者ポータルから `plan: 'juku'` のすごろく塾クラスを新規作成する
 */
export async function createSugorokuPortalClassroom(
  input: ClassroomInput,
): Promise<ClassroomDoc> {
  await ensureRootInstructorBootstrap();
  const created = await createClassroom(input);
  try {
    await setDoc(
      doc(db, CLASSROOMS_COLLECTION, created.id),
      {
        plan: 'juku',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ...created, plan: 'juku' };
  } catch {
    return created;
  }
}

/** クラスの講師メンバー＆招待一覧を取得 */
export async function fetchClassStaffInvites(
  classId: string,
  ownerUid?: string,
): Promise<SugorokuStaffInviteDoc[]> {
  if (!classId) return [];
  const byKey = new Map<string, SugorokuStaffInviteDoc>();

  for (const inv of readLocalStaffInvites()) {
    if (inv.classId === classId && inv.status !== 'revoked') {
      byKey.set(inv.id, inv);
    }
  }

  if (!FIREBASE_CONFIGURED) {
    return [...byKey.values()];
  }

  // 1) ルート sugoroku_members コレクション
  try {
    const rootSnap = await getDocs(collection(db, SUGOROKU_COLLECTIONS.sugorokuMembers));
    rootSnap.docs.forEach((d) => {
      const m = d.data() as SugorokuMemberDoc;
      if (d.id === ownerUid) return;
      if (m.active === false) return;
      if (m.role !== 'owner' && m.role !== 'staff') return;
      if (m.role === 'staff' && Array.isArray(m.classIds) && m.classIds.length > 0) {
        if (!m.classIds.includes(classId)) return;
      }
      const key = `${classId}_${m.email || d.id}`;
      byKey.set(key, {
        id: key,
        classId,
        email: m.email || `UID: ${d.id}`,
        staffName: m.rosterName || m.displayName || m.email || d.id.slice(0, 8),
        role: m.role,
        status: 'active',
        acceptedUid: d.id,
        invitedByUid: ownerUid || '',
        createdAt: typeof m.joinedAt === 'number' ? m.joinedAt : 0,
        updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : 0,
      });
    });
  } catch {
    // staff ログイン時はルート list が拒否されるためサブコレクション側を見る
  }

  // 2) クラス別サブコレクション classrooms/{classId}/sugoroku_members
  try {
    const subSnap = await getDocs(
      collection(
        db,
        `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
      ),
    );
    subSnap.docs.forEach((d) => {
      const m = d.data() as SugorokuMemberDoc;
      if (d.id === ownerUid) return;
      if (m.active === false) return;
      if (m.role !== 'owner' && m.role !== 'staff') return;
      const key = `${classId}_${m.email || d.id}`;
      byKey.set(key, {
        id: key,
        classId,
        email: m.email || `UID: ${d.id}`,
        staffName: m.rosterName || m.displayName || m.email || d.id.slice(0, 8),
        role: m.role,
        status: 'active',
        acceptedUid: d.id,
        invitedByUid: ownerUid || '',
        createdAt: typeof m.joinedAt === 'number' ? m.joinedAt : 0,
        updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : 0,
      });
    });
  } catch {
    // ignore
  }

  // 3) sugoroku_staff_invites
  try {
    const snap = await getDocs(
      query(
        collection(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites),
        where('classId', '==', classId),
      ),
    );
    snap.docs.forEach((d) => {
      const inv = { ...(d.data() as SugorokuStaffInviteDoc), id: d.id };
      if (inv.status !== 'revoked') {
        byKey.set(inv.id, inv);
      }
    });
  } catch {
    // ignore
  }

  return [...byKey.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * オーナー講師がスタッフ講師を追加する
 */
export async function inviteSugorokuStaff(params: {
  classroom: Pick<ClassroomDoc, 'id' | 'className' | 'schoolName'>;
  email: string;
  staffName: string;
  staffUid?: string;
}): Promise<SugorokuStaffInviteDoc> {
  const email = normalizeStaffEmail(params.email);
  const explicitUid = (params.staffUid || '').trim();
  if (!explicitUid && !isValidStaffEmail(email)) {
    throw new Error('有効なGoogleメールアドレスまたは講師UIDを入力してください');
  }

  const staffName =
    params.staffName.trim().slice(0, 32) ||
    (email ? email.split('@')[0] : explicitUid.slice(0, 10));
  const now = Date.now();
  const invitedByUid = auth.currentUser?.uid || 'owner';

  let resolvedUid = explicitUid;
  if (!resolvedUid && FIREBASE_CONFIGURED && email) {
    try {
      const qSnap = await getDocs(
        query(collection(db, SUGOROKU_COLLECTIONS.sugorokuMembers), where('email', '==', email)),
      );
      if (!qSnap.empty) {
        resolvedUid = qSnap.docs[0].id;
      }
    } catch {
      // ignore
    }
  }

  const id = buildStaffInviteId(params.classroom.id, email || resolvedUid);
  const status: 'active' | 'invited' = resolvedUid ? 'active' : 'invited';

  const payload: SugorokuStaffInviteDoc = {
    id,
    classId: params.classroom.id,
    className: params.classroom.className,
    schoolName: params.classroom.schoolName,
    email: email || `UID: ${resolvedUid}`,
    staffName,
    role: 'staff',
    status,
    ...(resolvedUid ? { acceptedUid: resolvedUid } : {}),
    invitedByUid,
    createdAt: now,
    updatedAt: now,
  };

  if (resolvedUid && FIREBASE_CONFIGURED) {
    let existingClassIds: string[] = [];
    try {
      const prev = await getDoc(doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, resolvedUid));
      if (prev.exists()) {
        const prevData = prev.data() as SugorokuMemberDoc;
        if (Array.isArray(prevData.classIds)) {
          existingClassIds = prevData.classIds;
        }
      }
    } catch {
      // ignore
    }
    const nextClassIds = Array.from(new Set([params.classroom.id, ...existingClassIds])).slice(
      0,
      10,
    );

    await setDoc(
      doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, resolvedUid),
      {
        uid: resolvedUid,
        classId: params.classroom.id,
        classIds: nextClassIds,
        role: 'staff',
        rosterName: staffName,
        displayName: staffName,
        ...(email ? { email } : {}),
        active: true,
        adFree: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await setDoc(
      doc(
        db,
        `${SUGOROKU_COLLECTIONS.classrooms}/${params.classroom.id}/${SUGOROKU_COLLECTIONS.sugorokuMembers}`,
        resolvedUid,
      ),
      {
        uid: resolvedUid,
        classId: params.classroom.id,
        role: 'staff',
        rosterName: staffName,
        displayName: staffName,
        ...(email ? { email } : {}),
        active: true,
        adFree: true,
        updatedAt: now,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => undefined);
  }

  if (FIREBASE_CONFIGURED) {
    await setDoc(
      doc(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites, id),
      {
        ...payload,
        serverUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => undefined);
  }

  const nextLocal = [...readLocalStaffInvites().filter((x) => x.id !== id), payload];
  writeLocalStaffInvites(nextLocal);

  return payload;
}

/** オーナー講師がスタッフ講師の権限を解除する */
export async function revokeSugorokuStaff(params: {
  classId: string;
  invite: SugorokuStaffInviteDoc;
}): Promise<void> {
  const now = Date.now();

  writeLocalStaffInvites(readLocalStaffInvites().filter((x) => x.id !== params.invite.id));

  if (!FIREBASE_CONFIGURED) return;

  if (params.invite.acceptedUid) {
    try {
      const rootRef = doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, params.invite.acceptedUid);
      const snap = await getDoc(rootRef);
      if (snap.exists()) {
        const data = snap.data() as SugorokuMemberDoc;
        const remaining = (data.classIds || []).filter((c) => c !== params.classId);
        await setDoc(
          rootRef,
          {
            classIds: remaining,
            active: remaining.length > 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch {
      // ignore
    }

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

  await setDoc(
    doc(db, SUGOROKU_COLLECTIONS.sugorokuStaffInvites, params.invite.id),
    {
      status: 'revoked',
      updatedAt: now,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => undefined);
}

/**
 * 指定クラスの塾生・講師一覧・学習時間ログ・宿題・提出物を一括取得する
 */
export async function loadClassPortalData(
  classroom: ClassroomDoc,
): Promise<LoadedClassPortalData> {
  const classId = classroom.id;
  const currentUid = auth.currentUser?.uid || '';
  const currentEmail = normalizeStaffEmail(auth.currentUser?.email || '');
  const viewerRole: 'owner' | 'staff' =
    classroom.teacherUid === currentUid || isEmailPreAuthorizedAdmin(currentEmail)
      ? 'owner'
      : 'staff';

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
      if (meta?.active === false) return false;
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

  // 1b. 講師スタッフ一覧
  const staffInvites = await fetchClassStaffInvites(classId, classroom.teacherUid);

  // 2. 宿題一覧（class_assignments ＋ sugoroku_homework_plans ＋ classrooms/{id}/assignments ＋ ローカルキャッシュ）
  const assignmentMap = new Map<string, SugorokuAssignmentDoc>();

  try {
    const localRaw = safeGetItem(`${AI2_LOCAL_PLANS_PREFIX}${encodeURIComponent(classId)}`);
    if (localRaw) {
      const parsed = JSON.parse(localRaw) as Record<string, SugorokuAssignmentDoc>;
      Object.entries(parsed || {}).forEach(([id, p]) => {
        if (p && Array.isArray(p.chapterIds)) {
          assignmentMap.set(id, { ...p, id, classId });
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    const legacy = await fetchLegacyAssignments(classId);
    for (const a of legacy) {
      assignmentMap.set(a.id, {
        ...(assignmentMap.get(a.id) || {}),
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
    const planSnap = await getDocs(
      query(collection(db, SUGOROKU_COLLECTIONS.homeworkPlans), where('classId', '==', classId)),
    );
    planSnap.docs.forEach((row) => {
      const data = row.data() as Omit<SugorokuAssignmentDoc, 'id'>;
      assignmentMap.set(row.id, {
        ...(assignmentMap.get(row.id) || {}),
        ...data,
        id: row.id,
        classId,
        chapterIds: Array.isArray(data.chapterIds) ? data.chapterIds : [],
      });
    });
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
        ...(assignmentMap.get(row.id) || {}),
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
      const byDate = new Map<string, SugorokuStudyLogDoc>();

      try {
        const logSnap = await getDocs(
          collection(db, `users/${member.uid}/${SUGOROKU_COLLECTIONS.sugorokuStudyLogs}`),
        );
        logSnap.docs.forEach((d) => {
          const raw = d.data() as Partial<SugorokuStudyLogDoc>;
          const dk = raw.dateKey || d.id;
          byDate.set(dk, {
            uid: member.uid,
            dateKey: dk,
            totalActiveSeconds: Number(raw.totalActiveSeconds) || 0,
            byGradeSkill: (raw.byGradeSkill as Record<string, number>) || {},
            accuracyByGradeSkill: raw.accuracyByGradeSkill,
            solvedCount: Number(raw.solvedCount) || 0,
            updatedAt: Number(raw.updatedAt) || 0,
          });
        });
      } catch {
        // ignore
      }

      if (byDate.size === 0) {
        try {
          const flatSnap = await getDocs(
            query(
              collection(db, SUGOROKU_COLLECTIONS.sugorokuStudyLogs),
              where('uid', '==', member.uid),
            ),
          );
          flatSnap.docs.forEach((d) => {
            const raw = d.data() as Partial<SugorokuStudyLogDoc>;
            const dk = raw.dateKey || d.id.replace(`${member.uid}_`, '');
            byDate.set(dk, {
              uid: member.uid,
              dateKey: dk,
              totalActiveSeconds: Number(raw.totalActiveSeconds) || 0,
              byGradeSkill: (raw.byGradeSkill as Record<string, number>) || {},
              accuracyByGradeSkill: raw.accuracyByGradeSkill,
              solvedCount: Number(raw.solvedCount) || 0,
              updatedAt: Number(raw.updatedAt) || 0,
            });
          });
        } catch {
          // ignore
        }
      }

      logsByUid[member.uid] = [...byDate.values()];

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
  const writingMap = new Map<string, SugorokuWritingSubmissionDoc>();
  try {
    const rawLocalW = safeGetItem(AI3_LOCAL_WRITING_KEY);
    if (rawLocalW) {
      const parsedW = JSON.parse(rawLocalW) as SugorokuWritingSubmissionDoc[];
      for (const item of parsedW || []) {
        if (item?.id && item.classId === classId) {
          writingMap.set(item.id, item);
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    const wSnap = await getDocs(
      query(
        collection(
          db,
          `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.writingSubmissions}`,
        ),
      ),
    );
    wSnap.docs.forEach((d) => {
      writingMap.set(d.id, {
        ...(d.data() as Omit<SugorokuWritingSubmissionDoc, 'id'>),
        id: d.id,
        classId,
      });
    });
  } catch {
    // ignore
  }

  // 5. スピーキング提出一覧
  const speakingMap = new Map<string, SugorokuSpeakingSubmissionDoc>();
  try {
    const rawLocalS = safeGetItem(AI3_LOCAL_SPEAKING_KEY);
    if (rawLocalS) {
      const parsedS = JSON.parse(rawLocalS) as SugorokuSpeakingSubmissionDoc[];
      for (const item of parsedS || []) {
        if (item?.id && item.classId === classId) {
          speakingMap.set(item.id, item);
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    const sSnap = await getDocs(
      query(
        collection(
          db,
          `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.speakingSubmissions}`,
        ),
      ),
    );
    sSnap.docs.forEach((d) => {
      speakingMap.set(d.id, {
        ...(d.data() as Omit<SugorokuSpeakingSubmissionDoc, 'id'>),
        id: d.id,
        classId,
      });
    });
  } catch {
    // ignore
  }

  return {
    classroom,
    viewerRole,
    members,
    staffInvites,
    logsByUid,
    solvedByUid,
    assignments: [...assignmentMap.values()].sort((a, b) => a.dueAt - b.dueAt),
    writingSubmissions: [...writingMap.values()].sort(
      (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0),
    ),
    speakingSubmissions: [...speakingMap.values()].sort(
      (a, b) => (b.submittedAt || 0) - (a.submittedAt || 0),
    ),
  };
}

/** 講師が生徒の実名（rosterName）・目標級・指導メモ・在籍状態（退塾停止対応）を更新する */
export async function updateSugorokuStudentProfile(params: {
  classId: string;
  studentUid: string;
  rosterName: string;
  targetGrade: EikenGrade;
  note?: string;
  active?: boolean;
}): Promise<void> {
  const trimmedName = params.rosterName.trim().slice(0, 32);
  const isActive = params.active !== false;
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
      active: isActive,
      adFree: isActive,
      updatedAt: Date.now(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, SUGOROKU_COLLECTIONS.sugorokuMembers, params.studentUid),
    {
      uid: params.studentUid,
      role: 'student',
      rosterName: trimmedName,
      targetGrade: params.targetGrade,
      note: (params.note || '').trim().slice(0, 200),
      active: isActive,
      adFree: isActive,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => undefined);
}
