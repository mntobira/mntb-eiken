/**
 * ===================================================================
 * 宿題（ペースメーカー）の Firestore ＆ ローカルキャッシュ層
 * ===================================================================
 *
 * ■ 3重の安全性・互換性（既存資産保護 ＆ AI 1・AI 4 との完全整合）
 *   1. 既存の `class_assignments/{assignmentId}`（JukuTab・StudentAssignments 互換）は
 *      従来の許可フィールドのみで読み書きし、既存 `firestore.rules` を一切壊さない。
 *   2. ペースメーカー拡張情報（`dailyQuotaProblems`, `skillBreakdown`, `targetStudentUids`,
 *      `startAt`, `presetId`, `presetWeek`）は以下2か所＋ローカルキャッシュへ透過保存する：
 *      - `sugoroku_homework_plans/{assignmentId}`（トップレベル拡張プラン）
 *      - `classrooms/{classId}/assignments/{assignmentId}`（第2章B契約・AI 1 管理者ポータル参照先）
 *      - `localStorage['sugoroku_homework_plans_v1_<classId>']`（ルール未適用デモ環境・オフライン時でも
 *        講師・生徒双方の同一ブラウザ／デモ確認で100%即時反映されるローカル台帳）
 *   3. いずれかの Firestore パスがルール未反映（permission-denied）でも例外で学習や出題を止めず、
 *      利用可能なデータから自動で統合復元する。
 */

import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from '../../utils/firestoreMetered';
import { db } from '../../firebase';
import { fetchMyMembershipDetails } from '../../utils/classroom';
import { requireUid, toFriendlyError } from '../../utils/classroomShared';
import { fetchAssignments, loadJukuMemberships, saveJukuMemberships } from '../../utils/classAssignments';
import type { AssignmentDoc } from '../../utils/classAssignmentsCore';
import { isPlainObject, readStoredJson } from '../../utils/safeLocalStorage';
import { safeSetItem } from '../../utils/storageGuard';
import {
  SUGOROKU_COLLECTIONS,
  type SugorokuAssignmentDoc,
  type SugorokuHomeworkPlan,
  type SugorokuSkillBreakdown,
  type SugorokuSkillKey,
} from '../shared/types';

/** 拡張プランコレクション名（firestoreMetered により eiken_sugoroku_homework_plans） */
export const HOMEWORK_PLANS_COLLECTION = 'sugoroku_homework_plans';

/** 1日の推奨ノルマ上限 */
export const DAILY_QUOTA_MAX = 60;

const LOCAL_PLANS_PREFIX = 'sugoroku_homework_plans_v1_';

function localPlansKey(classId: string): string {
  return `${LOCAL_PLANS_PREFIX}${encodeURIComponent(classId)}`;
}

function readLocalPlans(classId: string): Record<string, SugorokuHomeworkPlan> {
  if (!classId) return {};
  const raw = readStoredJson<Record<string, unknown> | null>(localPlansKey(classId), null, isPlainObject);
  if (!raw || !isPlainObject(raw)) return {};
  const out: Record<string, SugorokuHomeworkPlan> = {};
  Object.entries(raw).forEach(([id, v]) => {
    if (!isPlainObject(v)) return;
    const plan = normalizePlan({ ...v, id, classId });
    if (plan) out[plan.id] = plan;
  });
  return out;
}

function writeLocalPlan(plan: SugorokuHomeworkPlan): void {
  if (!plan.classId || !plan.id) return;
  try {
    const existing = readLocalPlans(plan.classId);
    existing[plan.id] = plan;
    safeSetItem(localPlansKey(plan.classId), JSON.stringify(existing));
  } catch {
    /* ignore */
  }
}

function removeLocalPlan(classId: string, assignmentId: string): void {
  if (!classId || !assignmentId) return;
  try {
    const existing = readLocalPlans(classId);
    if (existing[assignmentId]) {
      delete existing[assignmentId];
      safeSetItem(localPlansKey(classId), JSON.stringify(existing));
    }
  } catch {
    /* ignore */
  }
}

/** 変更通知（講師が同じ端末で宿題を出した直後にホーム画面カードへ即時反映させる） */
const homeworkListeners = new Set<() => void>();
export function subscribeHomeworkChanges(fn: () => void): () => void {
  homeworkListeners.add(fn);
  return () => {
    homeworkListeners.delete(fn);
  };
}
export function notifyHomeworkChanged(): void {
  homeworkListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * 先生：宿題のプラン（ペースメーカー設定）を保存する。
 *   1. ローカルキャッシュへ即時保存（オフライン・デモでも即反映）
 *   2. classrooms/{classId}/assignments/{id}（AI 1 管理者ポータル＆第2章B契約）へ書き込み試行
 *   3. sugoroku_homework_plans/{id} へ書き込み試行
 */
export async function saveHomeworkPlan(
  input: Omit<SugorokuHomeworkPlan, 'id' | 'createdAt' | 'teacherUid'> & { id: string },
): Promise<{ saved: boolean; syncedToCloud: boolean; warning?: string }> {
  const teacherUid = requireUid();
  const now = Date.now();
  const payload: Record<string, unknown> = {
    id: input.id,
    classId: input.classId,
    teacherUid,
    title: input.title.trim().slice(0, 40),
    chapterIds: input.chapterIds.slice(0, 10),
    dueAt: input.dueAt,
    createdAt: now,
    updatedAt: now,
  };
  if (typeof input.startAt === 'number' && Number.isFinite(input.startAt) && input.startAt > 0) {
    payload.startAt = Math.floor(input.startAt);
  }
  if (typeof input.dailyQuotaProblems === 'number' && input.dailyQuotaProblems > 0) {
    payload.dailyQuotaProblems = Math.min(DAILY_QUOTA_MAX, Math.floor(input.dailyQuotaProblems));
  }
  if (typeof input.targetLaps === 'number' && Number.isFinite(input.targetLaps) && input.targetLaps >= 1) {
    payload.targetLaps = Math.min(10, Math.floor(input.targetLaps));
  }
  if (typeof input.coachInstruction === 'string' && input.coachInstruction.trim()) {
    payload.coachInstruction = input.coachInstruction.trim().slice(0, 140);
  }
  if (input.skillBreakdown && typeof input.skillBreakdown === 'object') {
    const breakdown: SugorokuSkillBreakdown = {};
    (['reading', 'listening', 'vocab', 'writing', 'speaking'] as const).forEach((k) => {
      const v = Number(input.skillBreakdown?.[k]);
      if (Number.isFinite(v) && v > 0) breakdown[k] = Math.floor(v);
    });
    if (Object.keys(breakdown).length > 0) payload.skillBreakdown = breakdown;
  }
  if (Array.isArray(input.targetStudentUids) && input.targetStudentUids.length > 0) {
    payload.targetStudentUids = input.targetStudentUids.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 200);
  }
  if (input.presetId) payload.presetId = String(input.presetId).slice(0, 40);
  if (typeof input.presetWeek === 'number' && input.presetWeek >= 1 && input.presetWeek <= 24) {
    payload.presetWeek = Math.floor(input.presetWeek);
  }

  const normalized = normalizePlan(payload);
  if (normalized) {
    writeLocalPlan(normalized);
  }
  notifyHomeworkChanged();

  let cloudOk = false;
  // Path A: 第2章B契約サブコレクション classrooms/{classId}/assignments/{id}
  try {
    await setDoc(
      doc(db, `${SUGOROKU_COLLECTIONS.classrooms}/${input.classId}/${SUGOROKU_COLLECTIONS.assignments}`, input.id),
      payload,
      { merge: true },
    );
    cloudOk = true;
  } catch {
    /* AI 4 ルール反映前はスキップ */
  }

  // Path B: トップレベル sugoroku_homework_plans/{id}
  try {
    await setDoc(doc(db, HOMEWORK_PLANS_COLLECTION, input.id), payload, { merge: true });
    cloudOk = true;
  } catch (error) {
    if (!cloudOk) {
      console.warn('[sugoroku/homework] クラウド側ペース設定はルール反映待ち（課題本体とローカル設定は保存済み）', error);
      return {
        saved: true,
        syncedToCloud: false,
        warning:
          '宿題本体は生徒全員へ配信されました（1日推奨ペースのクラウド共有はセキュリティルール反映後に自動有効化されます）。',
      };
    }
  }

  return { saved: true, syncedToCloud: true };
}

/** 先生・生徒：1件ぶんのプランを読む */
export async function fetchHomeworkPlan(
  assignmentId: string,
  classId?: string,
): Promise<SugorokuHomeworkPlan | null> {
  const id = String(assignmentId || '').trim();
  if (!id) return null;
  if (classId) {
    try {
      const subSnap = await getDoc(
        doc(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.assignments}`, id),
      );
      if (subSnap.exists()) {
        const plan = normalizePlan({ ...(subSnap.data() as Record<string, unknown>), id, classId });
        if (plan) {
          writeLocalPlan(plan);
          return plan;
        }
      }
    } catch {
      /* fallback */
    }
  }
  try {
    const snap = await getDoc(doc(db, HOMEWORK_PLANS_COLLECTION, id));
    if (snap.exists()) {
      const plan = normalizePlan({ ...(snap.data() as Record<string, unknown>), id });
      if (plan) {
        writeLocalPlan(plan);
        return plan;
      }
    }
  } catch {
    /* fallback */
  }
  return classId ? readLocalPlans(classId)[id] || null : null;
}

/** 先生・生徒：クラスぶんのプランをまとめて読む（サブコレクション＋トップレベル＋ローカル統合） */
export async function fetchHomeworkPlans(classId: string): Promise<Record<string, SugorokuHomeworkPlan>> {
  const id = String(classId || '').trim();
  if (!id) return {};
  const merged: Record<string, SugorokuHomeworkPlan> = { ...readLocalPlans(id) };

  // 1. トップレベル sugoroku_homework_plans
  try {
    const snap = await getDocs(
      query(collection(db, HOMEWORK_PLANS_COLLECTION), where('classId', '==', id)),
    );
    snap.docs.forEach((row) => {
      const plan = normalizePlan({ ...(row.data() as Record<string, unknown>), id: row.id, classId: id });
      if (plan) {
        merged[plan.id] = plan;
        writeLocalPlan(plan);
      }
    });
  } catch {
    /* ignore */
  }

  // 2. 第2章B サブコレクション classrooms/{classId}/assignments
  try {
    const subSnap = await getDocs(
      collection(db, `${SUGOROKU_COLLECTIONS.classrooms}/${id}/${SUGOROKU_COLLECTIONS.assignments}`),
    );
    subSnap.docs.forEach((row) => {
      const plan = normalizePlan({ ...(row.data() as Record<string, unknown>), id: row.id, classId: id });
      if (plan) {
        merged[plan.id] = { ...(merged[plan.id] || {}), ...plan };
        writeLocalPlan(merged[plan.id]);
      }
    });
  } catch {
    /* ignore */
  }

  return merged;
}

/** 先生：宿題を削除したときに拡張プランもクリーンアップする */
export async function deleteHomeworkPlan(assignmentId: string, classId?: string): Promise<void> {
  const id = String(assignmentId || '').trim();
  if (!id) return;
  if (classId) {
    removeLocalPlan(classId, id);
    try {
      await deleteDoc(
        doc(db, `${SUGOROKU_COLLECTIONS.classrooms}/${classId}/${SUGOROKU_COLLECTIONS.assignments}`, id),
      );
    } catch {
      /* ignore */
    }
  }
  try {
    await deleteDoc(doc(db, HOMEWORK_PLANS_COLLECTION, id));
  } catch {
    /* ignore */
  }
  notifyHomeworkChanged();
}

/** Firestore や localStorage から読んだ生データを SugorokuHomeworkPlan に正規化する */
export function normalizePlan(raw: Record<string, unknown> | null | undefined): SugorokuHomeworkPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const classId = String(raw.classId ?? '').trim();
  if (!id || !classId) return null;
  const chapterIds = Array.isArray(raw.chapterIds)
    ? raw.chapterIds.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 10)
    : [];
  const dueAt = Number(raw.dueAt);
  const plan: SugorokuHomeworkPlan = {
    id,
    classId,
    teacherUid: String(raw.teacherUid ?? ''),
    title: String(raw.title ?? '').slice(0, 40),
    chapterIds,
    dueAt: Number.isFinite(dueAt) ? dueAt : 0,
  };
  const startAt = Number(raw.startAt);
  if (Number.isFinite(startAt) && startAt > 0) plan.startAt = Math.floor(startAt);
  const quota = Number(raw.dailyQuotaProblems);
  if (Number.isFinite(quota) && quota > 0) {
    plan.dailyQuotaProblems = Math.min(DAILY_QUOTA_MAX, Math.floor(quota));
  }
  const targetLaps = Number(raw.targetLaps);
  if (Number.isFinite(targetLaps) && targetLaps >= 1) {
    plan.targetLaps = Math.min(10, Math.floor(targetLaps));
  }
  if (typeof raw.coachInstruction === 'string' && raw.coachInstruction.trim()) {
    plan.coachInstruction = raw.coachInstruction.trim().slice(0, 140);
  }
  if (raw.skillBreakdown && typeof raw.skillBreakdown === 'object') {
    const breakdown: SugorokuSkillBreakdown = {};
    (Object.keys(raw.skillBreakdown) as string[]).forEach((k) => {
      if (!['reading', 'listening', 'writing', 'speaking', 'vocab'].includes(k)) return;
      const v = Number((raw.skillBreakdown as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v > 0) breakdown[k as SugorokuSkillKey] = Math.floor(v);
    });
    if (Object.keys(breakdown).length > 0) plan.skillBreakdown = breakdown;
  }
  if (Array.isArray(raw.targetStudentUids)) {
    const targets = raw.targetStudentUids.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 200);
    if (targets.length > 0) plan.targetStudentUids = targets;
  }
  if (raw.presetId) plan.presetId = String(raw.presetId).slice(0, 40);
  const presetWeek = Number(raw.presetWeek);
  if (Number.isFinite(presetWeek) && presetWeek >= 1 && presetWeek <= 24) {
    plan.presetWeek = Math.floor(presetWeek);
  }
  const createdAt = Number(raw.createdAt);
  if (Number.isFinite(createdAt)) plan.createdAt = createdAt;
  const updatedAt = Number(raw.updatedAt);
  if (Number.isFinite(updatedAt)) plan.updatedAt = updatedAt;
  return plan;
}

/**
 * 生徒：自分に出ている宿題（既存 class_assignments ＋ サブコレクション assignments ＋ 拡張プラン）を統合取得する。
 *   - `targetStudentUids` が指定されている個別配信宿題は、対象生徒のみに返す（未指定・空配列はクラス全員）
 */
export async function fetchMyHomeworkAssignments(
  uid: string,
): Promise<Array<AssignmentDoc & { plan: SugorokuHomeworkPlan | null }>> {
  const myUid = String(uid || '').trim();
  if (!myUid) return [];
  let memberships = loadJukuMemberships(myUid);
  if (memberships.length === 0) {
    // 初回ログイン直後や別端末で設定＞クラスを開く前でもタイトル画面・ホームで即座に宿題が見えるよう自動同期する
    try {
      const details = await fetchMyMembershipDetails();
      const jukuRows = details
        .filter((d) => d.plan === 'juku' || d.classId.length > 0)
        .map((d) => ({
          classId: d.classId,
          teacherUid: d.teacherUid,
          className: d.className,
          subject: d.subject,
        }));
      if (jukuRows.length > 0) {
        saveJukuMemberships(myUid, jukuRows);
        memberships = jukuRows;
      }
    } catch {
      /* オフライン・テスト環境等は無視 */
    }
  }
  if (memberships.length === 0) return [];

  const rows: Array<AssignmentDoc & { plan: SugorokuHomeworkPlan | null }> = [];
  await Promise.all(
    memberships.map(async (membership) => {
      try {
        const [legacyAssignments, plans] = await Promise.all([
          fetchAssignments(membership.classId).catch(() => [] as AssignmentDoc[]),
          fetchHomeworkPlans(membership.classId),
        ]);

        const mergedById = new Map<string, SugorokuAssignmentDoc>();
        legacyAssignments.forEach((a) => {
          const plan = plans[a.id];
          mergedById.set(a.id, {
            ...(plan || {}),
            id: a.id,
            classId: membership.classId,
            teacherUid: a.teacherUid || plan?.teacherUid || '',
            title: a.title || plan?.title || '',
            chapterIds: a.chapterIds?.length ? a.chapterIds : plan?.chapterIds || [],
            dueAt: a.dueAt || plan?.dueAt || 0,
            createdAt: typeof a.createdAt === 'number' ? a.createdAt : plan?.createdAt,
          });
        });

        // サブコレクション（またはローカルプラン）のみに存在する宿題も統合
        Object.values(plans).forEach((p) => {
          if (!mergedById.has(p.id) && p.chapterIds.length > 0 && p.dueAt > 0) {
            mergedById.set(p.id, p);
          }
        });

        mergedById.forEach((item) => {
          const plan = plans[item.id] || item;
          if (
            plan.targetStudentUids &&
            plan.targetStudentUids.length > 0 &&
            !plan.targetStudentUids.includes(myUid)
          ) {
            return;
          }
          rows.push({
            id: item.id,
            classId: item.classId,
            teacherUid: item.teacherUid,
            title: item.title,
            chapterIds: item.chapterIds,
            dueAt: item.dueAt,
            plan,
          });
        });
      } catch (error) {
        console.warn('[sugoroku/homework] クラスの宿題を読めませんでした', membership.classId, error);
      }
    }),
  );
  return rows;
}

/** 先生：宿題作成直後にペースメーカー設定を紐付けて保存するヘルパー */
export async function attachPlanToAssignment(
  assignment: AssignmentDoc,
  extra: {
    dailyQuotaProblems?: number;
    targetLaps?: number;
    coachInstruction?: string;
    skillBreakdown?: SugorokuSkillBreakdown;
    targetStudentUids?: string[];
    presetId?: string;
    presetWeek?: number;
    startAt?: number;
  },
): Promise<{ saved: boolean; syncedToCloud: boolean; warning?: string }> {
  try {
    return await saveHomeworkPlan({
      id: assignment.id,
      classId: assignment.classId,
      title: assignment.title,
      chapterIds: assignment.chapterIds,
      dueAt: assignment.dueAt,
      dailyQuotaProblems: extra.dailyQuotaProblems,
      targetLaps: extra.targetLaps,
      coachInstruction: extra.coachInstruction,
      skillBreakdown: extra.skillBreakdown,
      targetStudentUids: extra.targetStudentUids,
      presetId: extra.presetId,
      presetWeek: extra.presetWeek,
      startAt: extra.startAt,
    });
  } catch (error) {
    throw toFriendlyError(error, 'ペース設定の保存に失敗しました。');
  }
}
