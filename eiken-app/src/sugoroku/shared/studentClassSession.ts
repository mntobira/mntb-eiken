import { auth } from '../../firebase';
import { EIKEN_GRADES } from '../../eiken/config';
import {
  loadJukuMemberships,
  saveJukuMemberships,
  type JukuMembership,
} from '../../utils/classAssignments';
import { fetchMyMembershipDetails } from '../../utils/classroom';

const ALL_EIKEN_SUBJECTS = EIKEN_GRADES.map((g) => g.id);

/**
 * 生徒が所属するクラス一覧を全英検級（5級〜1級）向けに正規化して保存する。
 *
 * 「全級一括コース（英検5級〜1級）」のように代表教科 1つ（例: eiken_2）で作成された塾クラスでも、
 * 継承保護ファイル（ReasonBox.tsx / classAssignments.ts）の `row.subject === subject` 判定に
 * 全8級でヒットするよう、キャッシュ配列へ全級エントリを展開して保持する。
 * 重複 classId が UI に出ないよう、元のクラス順で先頭に本来の代表 subject を並べる。
 */
export function expandJukuMembershipsForAllEikenGrades(
  rows: ReadonlyArray<{
    classId: string;
    teacherUid: string;
    className: string;
    subject: string;
    plan?: string;
  }>,
): JukuMembership[] {
  const jukuOnly = rows.filter((r) => !r.plan || r.plan === 'juku');
  const source = jukuOnly.length > 0 ? jukuOnly : rows;
  const out: JukuMembership[] = [];
  const seenKey = new Set<string>();

  for (const row of source) {
    const primaryKey = `${row.classId}::${row.subject}`;
    if (!seenKey.has(primaryKey)) {
      seenKey.add(primaryKey);
      out.push({
        classId: row.classId,
        teacherUid: row.teacherUid,
        className: row.className,
        subject: row.subject,
      });
    }
    const isEikenJuku =
      row.subject.startsWith('eiken_') || (row.className || '').includes('英検') || (row.className || '').includes('全級');
    if (isEikenJuku) {
      for (const gradeSubject of ALL_EIKEN_SUBJECTS) {
        const key = `${row.classId}::${gradeSubject}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        out.push({
          classId: row.classId,
          teacherUid: row.teacherUid,
          className: row.className,
          subject: gradeSubject,
        });
      }
    }
  }
  return out;
}

/** 重複展開された JukuMembership 配列からユニークなクラス単位の一覧を取り出す */
export function uniqueJukuMembershipsByClass(rows: readonly JukuMembership[]): JukuMembership[] {
  const seen = new Set<string>();
  const out: JukuMembership[] = [];
  for (const row of rows) {
    if (!row.classId || seen.has(row.classId)) continue;
    seen.add(row.classId);
    out.push(row);
  }
  return out;
}

/**
 * ローカルキャッシュが空（別端末でログイン直後や設定画面を開く前）でも、
 * Firestore から最新の参加クラスを自動取得してキャッシュを温め、代表クラスを返す。
 */
export async function ensureStudentJukuMemberships(uid: string): Promise<JukuMembership[]> {
  if (!uid) return [];
  const cached = uniqueJukuMembershipsByClass(loadJukuMemberships(uid));
  if (cached.length > 0) return cached;
  if (!auth.currentUser || auth.currentUser.uid !== uid) return [];

  try {
    const details = await fetchMyMembershipDetails();
    if (details.length === 0) return [];
    const expanded = expandJukuMembershipsForAllEikenGrades(details);
    saveJukuMemberships(uid, expanded);
    return uniqueJukuMembershipsByClass(expanded);
  } catch {
    return [];
  }
}
