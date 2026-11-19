/**
 * ===================================================================
 * 宿題（ペースメーカー）の Firestore 層
 * ===================================================================
 *
 * ■ 既存との関係（ここを壊さないことが最優先）
 *   宿題そのものは既存の class_assignments（utils/classAssignments.ts）が持つ。
 *   このファイルは、そこに「1日のノート」「配信開始」「個別配信」「プリセット」を
 *   ★重ねるだけ★の追加コレクションを扱う。
 *
 *     eiken_sugoroku_homework_plans/{assignmentId}
 *        = { id, classId, teacherUid, title, chapterIds, dueAt,
 *            startAt?, dailyQuotaProblems?, skillBreakdown?, targetStudentUids?,
 *            presetId?, createdAt }
 *
 * ■ なぜ既存ドキュメントに項目を足さないのか
 *   class_assignments のルールは hasOnly([...]) で許可フィールドを固定している
 *   （firestore.rules）。項目を足すと、ルール改定（AI 4 の担当）が終わるまで
 *   ★先生が宿題を出せなくなる★。既存を1文字も変えずに済む形にするのが正しい。
 *
 * ■ ルール未適用でも壊れないこと
 *   本番のルール改定は AI 4 の作業で、こちらより後になる。
 *   したがって「プランの読み書きに失敗しても、宿題は従来どおり動く」ようにする。
 *     - 読めない  → ノートは自動計算（残り ÷ 残り日数）で代替
 *     - 書けない  → 宿題自体は作成済みなので、成功として扱い警告だけ残す
 *   この方針により、デモ（11/23・11/27）でルール未反映でも画面が成立する。
 */

import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from '../../utils/firestoreMetered';
import { db } from '../../firebase';
import { requireUid, toFriendlyError } from '../../utils/classroomShared';
import { fetchAssignments } from '../../utils/classAssignments';
import type { AssignmentDoc } from '../../utils/classAssignmentsCore';
import type { SugorokuHomeworkPlan, SugorokuSkill } from '../shared/types';

/**
 * プランのコレクション名。
 *   firestoreMetered が root に自動で 'eiken_' を付けるので、実体は
 *   eiken_sugoroku_homework_plans になる（既存の class_assignments と同じ作法）。
 */
export const HOMEWORK_PLANS_COLLECTION = 'sugoroku_homework_plans';

/** 1日のノートの上限（画面の入力欄とルールの両方で使う。緩めすぎない） */
export const DAILY_QUOTA_MAX = 60;

/**
 * 先生：宿題のプラン（ペース設定）を保存する。
 *
 * ■ 「宿題は出せたがプランは保存できなかった」を成功として返す理由
 *   プランが無くても、生徒側は自動計算でノートを出す（homeworkCore）。
 *   ここで throw すると、先生には「宿題を出せませんでした」と見えるのに
 *   実際には class_assignments に書き込まれている、という最悪の状態になる。
 *   そのため戻り値で「プランを保存できたか」を返し、呼び出し側が警告を出す。
 */
export async function saveHomeworkPlan(
  input: Omit<SugorokuHomeworkPlan, 'id' | 'createdAt' | 'teacherUid'> & { id: string },
): Promise<{ saved: boolean; warning?: string }> {
  const teacherUid = requireUid();
  const payload: Record<string, unknown> = {
    id: input.id,
    classId: input.classId,
    teacherUid,
    title: input.title,
    chapterIds: input.chapterIds.slice(0, 10),
    dueAt: input.dueAt,
    createdAt: Date.now(),
  };
  if (typeof input.startAt === 'number' && Number.isFinite(input.startAt)) payload.startAt = Math.floor(input.startAt);
  if (typeof input.dailyQuotaProblems === 'number' && input.dailyQuotaProblems > 0) {
    payload.dailyQuotaProblems = Math.min(DAILY_QUOTA_MAX, Math.floor(input.dailyQuotaProblems));
  }
  if (input.skillBreakdown && typeof input.skillBreakdown === 'object') {
    const breakdown: Partial<Record<SugorokuSkill, number>> = {};
    (Object.keys(input.skillBreakdown) as SugorokuSkill[]).forEach((k) => {
      const v = Number(input.skillBreakdown?.[k]);
      if (Number.isFinite(v) && v >= 0) breakdown[k] = Math.floor(v);
    });
    if (Object.keys(breakdown).length > 0) payload.skillBreakdown = breakdown;
  }
  if (Array.isArray(input.targetStudentUids) && input.targetStudentUids.length > 0) {
    payload.targetStudentUids = input.targetStudentUids.slice(0, 200);
  }
  if (input.presetId) payload.presetId = String(input.presetId).slice(0, 40);

  try {
    await setDoc(doc(db, HOMEWORK_PLANS_COLLECTION, input.id), payload);
    return { saved: true };
  } catch (error) {
    // ルール未反映（permission-denied）を含め、ここでは投げない
    console.warn('[sugoroku/homework] ペース設定を保存できませんでした（宿題自体は作成済み）', error);
    return {
      saved: false,
      warning: '宿題は出せましたが、1日のペース設定だけ保存できませんでした。生徒の画面では自動計算のペースで表示されます。',
    };
  }
}

/** 先生・生徒：1件ぶんのプランを読む（無ければ null / 読めなくても null） */
export async function fetchHomeworkPlan(assignmentId: string): Promise<SugorokuHomeworkPlan | null> {
  const id = String(assignmentId || '').trim();
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, HOMEWORK_PLANS_COLLECTION, id));
    if (!snap.exists()) return null;
    return normalizePlan(snap.data() as Record<string, unknown>);
  } catch (error) {
    // ルール未反映・通信不可でも宿題表示は続ける
    console.warn('[sugoroku/homework] ペース設定を読めませんでした', error);
    return null;
  }
}

/** 先生・生徒：クラスぶんのプランをまとめて読む（1クエリ。読めなければ空） */
export async function fetchHomeworkPlans(classId: string): Promise<Record<string, SugorokuHomeworkPlan>> {
  const id = String(classId || '').trim();
  if (!id) return {};
  try {
    const snap = await getDocs(
      query(collection(db, HOMEWORK_PLANS_COLLECTION), where('classId', '==', id)),
    );
    const out: Record<string, SugorokuHomeworkPlan> = {};
    snap.docs.forEach((row) => {
      const plan = normalizePlan(row.data() as Record<string, unknown>);
      if (plan) out[plan.id] = plan;
    });
    return out;
  } catch (error) {
    console.warn('[sugoroku/homework] ペース設定をまとめて読めませんでした', error);
    return {};
  }
}

/** 先生：宿題を消したときにプランも消す（残骸を残さない） */
export async function deleteHomeworkPlan(assignmentId: string): Promise<void> {
  const id = String(assignmentId || '').trim();
  if (!id) return;
  try {
    await deleteDoc(doc(db, HOMEWORK_PLANS_COLLECTION, id));
  } catch (error) {
    // 消せなくても宿題は消えている。残骸は次に同じIDが来ない限り無害。
    console.warn('[sugoroku/homework] ペース設定を消せませんでした', error);
  }
}

/**
 * Firestore から読んだ生データを SugorokuHomeworkPlan に整える。
 *   型が違う値は捨てる（壊れたデータで画面を落とさない）。
 */
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
  if (Number.isFinite(startAt) && startAt > 0) plan.startAt = startAt;
  const quota = Number(raw.dailyQuotaProblems);
  if (Number.isFinite(quota) && quota > 0) plan.dailyQuotaProblems = Math.min(DAILY_QUOTA_MAX, Math.floor(quota));
  if (raw.skillBreakdown && typeof raw.skillBreakdown === 'object') {
    const breakdown: Partial<Record<SugorokuSkill, number>> = {};
    (Object.keys(raw.skillBreakdown) as string[]).forEach((k) => {
      if (!['reading', 'listening', 'writing', 'speaking', 'vocab'].includes(k)) return;
      const v = Number((raw.skillBreakdown as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v >= 0) breakdown[k as SugorokuSkill] = Math.floor(v);
    });
    plan.skillBreakdown = breakdown;
  }
  if (Array.isArray(raw.targetStudentUids)) {
    plan.targetStudentUids = raw.targetStudentUids.map((v) => String(v || '')).filter(Boolean).slice(0, 200);
  }
  if (raw.presetId) plan.presetId = String(raw.presetId).slice(0, 40);
  const createdAt = Number(raw.createdAt);
  if (Number.isFinite(createdAt)) plan.createdAt = createdAt;
  return plan;
}

/**
 * 生徒：自分に出ている宿題（課題＋プラン）をまとめて取る。
 *
 * ■ 通信回数
 *   クラスごとに「課題一覧 1 read群」「プラン一覧 1 read群」の2回だけ。
 *   生徒が増えても教室あたりの回数は変わらない。
 *
 * ■ 個別配信の絞り込み
 *   plan.targetStudentUids がある場合、自分が入っていなければ出さない。
 *   （未指定はクラス全員）
 */
export async function fetchMyHomeworkAssignments(uid: string): Promise<Array<AssignmentDoc & { plan: SugorokuHomeworkPlan | null }>> {
  const myUid = String(uid || '').trim();
  if (!myUid) return [];
  const { loadJukuMemberships } = await import('../../utils/classAssignments');
  const memberships = loadJukuMemberships(myUid);
  if (memberships.length === 0) return [];

  const rows: Array<AssignmentDoc & { plan: SugorokuHomeworkPlan | null }> = [];
  await Promise.all(
    memberships.map(async (membership) => {
      try {
        const [assignments, plans] = await Promise.all([
          fetchAssignments(membership.classId),
          fetchHomeworkPlans(membership.classId),
        ]);
        assignments.forEach((assignment) => {
          const plan = plans[assignment.id] || null;
          if (plan?.targetStudentUids && plan.targetStudentUids.length > 0 && !plan.targetStudentUids.includes(myUid)) return;
          rows.push({ ...assignment, plan });
        });
      } catch (error) {
        console.warn('[sugoroku/homework] クラスの宿題を読めませんでした', membership.classId, error);
      }
    }),
  );
  return rows;
}

/** 先生：宿題を作った直後に「プランも保存する」まとめ処理（JukuTab から呼ぶ） */
export async function attachPlanToAssignment(
  assignment: AssignmentDoc,
  extra: { dailyQuotaProblems?: number; presetId?: string; startAt?: number },
): Promise<{ saved: boolean; warning?: string }> {
  try {
    return await saveHomeworkPlan({
      id: assignment.id,
      classId: assignment.classId,
      title: assignment.title,
      chapterIds: assignment.chapterIds,
      dueAt: assignment.dueAt,
      dailyQuotaProblems: extra.dailyQuotaProblems,
      presetId: extra.presetId,
      startAt: extra.startAt,
    });
  } catch (error) {
    throw toFriendlyError(error, 'ペース設定の保存に失敗しました。');
  }
}
