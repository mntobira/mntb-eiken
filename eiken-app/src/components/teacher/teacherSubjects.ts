import { SUBJECT_REGISTRY } from '../../data/subjects';
import { type ClassroomDoc } from '../../utils/classroomCore';
import { filterEnabledSubjects } from '../../config/features';

/** Firestore eiken_classrooms ルールで許可されている英検級のみ対象とする（eiken_5 〜 eiken_pre1） */
const CLASSROOM_RULE_ALLOWED = new Set([
  'eiken_5',
  'eiken_4',
  'eiken_3',
  'eiken_pre2',
  'eiken_pre2plus',
  'eiken_2',
  'eiken_pre1',
]);

/** 登録簿の全教科。クラス作成で選べるのは、このうち公開中かつルール対応済みの教科だけ */
const ALL_SUBJECT_OPTIONS: Array<{ value: ClassroomDoc['subject']; label: string }> =
  SUBJECT_REGISTRY
    .filter((s) => !('classroom' in s && s.classroom === false) && CLASSROOM_RULE_ALLOWED.has(s.id))
    .map((s) => ({ value: s.id as ClassroomDoc['subject'], label: s.label }));
export const SUBJECT_OPTIONS = filterEnabledSubjects(ALL_SUBJECT_OPTIONS, (option) => option.value);
/** クラス作成の初期級（塾で最も需要が高い英検2級を優先） */
export const DEFAULT_CLASS_SUBJECT: ClassroomDoc['subject'] =
  SUBJECT_OPTIONS.find((option) => option.value === 'eiken_2')?.value ??
  SUBJECT_OPTIONS[0]?.value ??
  'eiken_2';
