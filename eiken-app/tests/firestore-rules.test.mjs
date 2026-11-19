import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required; never run against production.');

const hasStorageEmulator = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST);

const env = await initializeTestEnvironment({
  projectId: 'demo-manatobi-eiken',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  ...(hasStorageEmulator
    ? { storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') } }
    : {}),
});
after(() => env.cleanup());

const aliceCtx = env.authenticatedContext('alice');
const bobCtx = env.authenticatedContext('bob');
const anonCtx = env.unauthenticatedContext();

const alice = aliceCtx.firestore();
const bob = bobCtx.firestore();
const anon = anonCtx.firestore();
const progress = () => ({ uid: 'alice', solved: { eiken_3_listening_01: 1 }, reviewItems: [], solvedTotal: 1, reviewTotal: 0, lastStudiedAt: 1, updatedAt: serverTimestamp() });

// ===============================================================
// 既存ルール保護テスト（1件も弱めない）
// ===============================================================

test('owner can create, read and update actual studySync payload', async () => {
  await assertSucceeds(setDoc(doc(alice, 'eiken_study_progress/alice'), progress()));
  await assertSucceeds(getDoc(doc(alice, 'eiken_study_progress/alice')));
  await assertSucceeds(setDoc(doc(alice, 'eiken_study_progress/alice'), progress(), { merge: true }));
});
test('other users and anonymous visitors cannot read or write', async () => {
  for (const db of [bob, anon]) {
    await assertFails(getDoc(doc(db, 'eiken_study_progress/alice')));
    await assertFails(setDoc(doc(db, 'eiken_study_progress/alice'), progress()));
  }
});
test('owners cannot spoof uid, add fields, forge timestamp or mismatch counts', async () => {
  for (const extra of [{ uid: 'bob' }, { admin: true }, { updatedAt: 123 }, { solvedTotal: 99 }, { reviewTotal: 1 }, { lastStudiedAt: -1 }, { reviewItems: Array(601).fill({}) }]) {
    await assertFails(setDoc(doc(alice, 'eiken_study_progress/alice'), { ...progress(), ...extra }));
  }
});
test('list, deletion, subcollections and university collections remain denied', async () => {
  await assertFails(getDocs(collection(alice, 'eiken_study_progress')));
  await assertFails(deleteDoc(doc(alice, 'eiken_study_progress/alice')));
  for (const path of ['eiken_study_progress/alice/notes/test', 'questions/q1', 'questionSets/q1', 'users/alice', 'progress/alice', 'attempts/a1', 'audio/a1', 'eiken_users/alice']) {
    await assertFails(setDoc(doc(alice, path), progress()));
    await assertFails(getDoc(doc(alice, path)));
  }
});

test('shared growth, gacha and settings backups retain owner-only access', async () => {
  const payload = { uid: 'alice', s_growth: '{"coins":10}', s_profile: '{"name":"Alice"}', updatedAt: serverTimestamp() };
  const path = 'eiken_user_data/alice';
  await assertSucceeds(setDoc(doc(alice, path), payload));
  await assertSucceeds(getDoc(doc(alice, path)));
  for (const db of [bob, anon]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), payload));
  }
  for (const extra of [{ uid: 'bob' }, { admin: true }, { updatedAt: 123 }, { s_growth: 1 }, { s_growth: 'x'.repeat(200001) }]) {
    await assertFails(setDoc(doc(alice, path), { ...payload, ...extra }));
  }
  await assertFails(getDocs(collection(alice, 'eiken_user_data')));
  await assertFails(setDoc(doc(alice, 'user_data/alice'), payload));
});

test('shared friend profiles work without exposing another user or the university namespace', async () => {
  await assertSucceeds(setDoc(doc(alice, 'eiken_friend_profiles/alice'), { uid: 'alice', nickname: 'Alice' }));
  await assertSucceeds(getDoc(doc(alice, 'eiken_friend_profiles/alice')));
  await assertFails(getDoc(doc(bob, 'eiken_friend_profiles/alice')));
  await assertFails(getDocs(collection(alice, 'eiken_friend_profiles')));
  await assertFails(setDoc(doc(bob, 'eiken_friend_profiles/alice'), { uid: 'bob', nickname: 'Bob' }));
  await assertFails(setDoc(doc(alice, 'friend_profiles/alice'), { uid: 'alice', nickname: 'Alice' }));
});

test('shared classroom accepts available Eiken grades without letting teachers set paid privileges', async () => {
  const classroom = { teacherUid: 'alice', schoolName: 'School', className: 'Class', joinCode: 'ACDEFG', subject: 'eiken_3', joinOpen: true };
  await assertSucceeds(setDoc(doc(alice, 'eiken_classrooms/test'), classroom));
  await assertFails(setDoc(doc(bob, 'eiken_classrooms/test'), { ...classroom, teacherUid: 'bob' }));
  for (const extra of [{ plan: 'juku' }, { subject: 'english_listening' }, { subject: 'eiken_1' }]) {
    await assertFails(setDoc(doc(alice, 'eiken_classrooms/test2'), { ...classroom, ...extra }));
  }
  await assertFails(setDoc(doc(alice, 'classrooms/test'), classroom));
});

test('server-only clan, receipt and rating collections have no client-write bypass', async () => {
  for (const path of ['eiken_mana_clans/test', 'eiken_battle_ghost_receipts/test', 'eiken_league_receipts/test', 'eiken_battle_ranking/alice']) {
    for (const db of [alice, anon]) await assertFails(setDoc(doc(db, path), { uid: 'alice', rating: 99999 }));
  }
});

// ===============================================================
// AI 4 追加テスト：すごろく塾 5アクター全ケース検証
// （本人 / 担当クラス講師 / 他クラス講師 / 他生徒 / 未認証）
// ===============================================================

const studentA = env.authenticatedContext('student_a').firestore();
const studentB = env.authenticatedContext('student_b').firestore();
const teacherA = env.authenticatedContext('teacher_a').firestore(); // class_juku_a の担任
const teacherB = env.authenticatedContext('teacher_b').firestore(); // class_juku_b（他クラス）の担任
const ownerAdmin = env.authenticatedContext('sugoroku_owner').firestore(); // 塾 owner
const staffA = env.authenticatedContext('sugoroku_staff_a').firestore(); // class_juku_a 担当 staff

/** テスト用の塾クラス・在籍・同意・オーナー初期データを Rules 無効コンテキストで投入する */
async function seedSugorokuFixtures() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    // 塾クラス A（teacher_a 担当、plan: 'juku'）
    await setDoc(doc(adminDb, 'eiken_classrooms/class_juku_a'), {
      id: 'class_juku_a',
      teacherUid: 'teacher_a',
      schoolName: 'すごろくオンライン塾',
      className: '英検2級 2月開講Aクラス',
      joinCode: 'ACDEF2',
      subject: 'eiken_2',
      joinOpen: true,
      plan: 'juku',
    });
    // 他クラス B（teacher_b 担当、plan: 'juku'）
    await setDoc(doc(adminDb, 'eiken_classrooms/class_juku_b'), {
      id: 'class_juku_b',
      teacherUid: 'teacher_b',
      schoolName: '別校舎',
      className: '別クラスB',
      joinCode: 'GHJKM3',
      subject: 'eiken_2',
      joinOpen: true,
      plan: 'juku',
    });
    // 無料クラス Free（plan: 'free'）
    await setDoc(doc(adminDb, 'eiken_classrooms/class_free_c'), {
      id: 'class_free_c',
      teacherUid: 'teacher_a',
      schoolName: '一般高校',
      className: '無料クラスC',
      joinCode: 'NPQRS4',
      subject: 'eiken_pre2',
      joinOpen: true,
      plan: 'free',
    });
    // student_a は class_juku_a に在籍＆teacher_a に study_access 付与済み
    await setDoc(doc(adminDb, 'eiken_class_members/class_juku_a_student_a'), {
      classId: 'class_juku_a',
      uid: 'student_a',
      displayName: 'たくみ',
      rosterName: '佐藤 拓海',
    });
    await setDoc(doc(adminDb, 'eiken_study_access/student_a_teacher_a'), {
      studentUid: 'student_a',
      teacherUid: 'teacher_a',
      classId: 'class_juku_a',
    });
    // student_b は class_juku_b（別クラス）に在籍
    await setDoc(doc(adminDb, 'eiken_class_members/class_juku_b_student_b'), {
      classId: 'class_juku_b',
      uid: 'student_b',
      displayName: 'はるか',
      rosterName: '鈴木 遥',
    });
    // 塾 owner ＆ class_juku_a 担当 staff
    await setDoc(doc(adminDb, 'eiken_sugoroku_members/sugoroku_owner'), {
      uid: 'sugoroku_owner',
      role: 'owner',
      active: true,
      adFree: true,
    });
    await setDoc(doc(adminDb, 'eiken_sugoroku_members/sugoroku_staff_a'), {
      uid: 'sugoroku_staff_a',
      role: 'staff',
      active: true,
      adFree: true,
      classIds: ['class_juku_a'],
    });
  });
}

await seedSugorokuFixtures();

test('sugoroku_members: enrolled juku student can self-enroll as student+adFree, cannot escalate role or read others', async () => {
  // 本人（class_juku_a 在籍済み）が role: 'student', adFree: true で登録成功
  await assertSucceeds(setDoc(doc(studentA, 'eiken_sugoroku_members/student_a'), {
    uid: 'student_a',
    role: 'student',
    targetGrade: 'eiken_2',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
    consentAcceptedAt: 1700000000000,
  }));

  // 本人・担当クラス講師・担当staff・塾ownerは閲覧可
  await assertSucceeds(getDoc(doc(studentA, 'eiken_sugoroku_members/student_a')));
  await assertSucceeds(getDoc(doc(teacherA, 'eiken_sugoroku_members/student_a')));
  await assertSucceeds(getDoc(doc(staffA, 'eiken_sugoroku_members/student_a')));
  await assertSucceeds(getDoc(doc(ownerAdmin, 'eiken_sugoroku_members/student_a')));

  // 他クラス講師・他生徒・未認証は閲覧不可
  await assertFails(getDoc(doc(teacherB, 'eiken_sugoroku_members/student_a')));
  await assertFails(getDoc(doc(studentB, 'eiken_sugoroku_members/student_a')));
  await assertFails(getDoc(doc(anon, 'eiken_sugoroku_members/student_a')));

  // 生徒による owner / staff への自己権限昇格、rosterName 偽装、未在籍クラス指定はすべて拒否
  await assertFails(setDoc(doc(studentA, 'eiken_sugoroku_members/student_a'), {
    uid: 'student_a',
    role: 'owner',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
  }));
  await assertFails(setDoc(doc(studentA, 'eiken_sugoroku_members/student_a'), {
    uid: 'student_a',
    role: 'staff',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
  }));
  await assertFails(setDoc(doc(studentA, 'eiken_sugoroku_members/student_a'), {
    uid: 'student_a',
    role: 'student',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
    rosterName: '勝手に実名書き換え',
  }));
  // 在籍していない塾クラスを指定しての登録は拒否
  await assertFails(setDoc(doc(bob, 'eiken_sugoroku_members/bob'), {
    uid: 'bob',
    role: 'student',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
  }));

  // 塾 owner は新しい staff を登録可能
  await assertSucceeds(setDoc(doc(ownerAdmin, 'eiken_sugoroku_members/new_tutor'), {
    uid: 'new_tutor',
    role: 'staff',
    active: true,
    adFree: true,
    classIds: ['class_juku_a'],
  }));
});

test('sugoroku_study_logs & study_summaries: owner write/read, assigned teacher/staff read, others/anon denied', async () => {
  const logPath = 'eiken_users/student_a/sugoroku_study_logs/2026-11-19';
  const summaryPath = 'eiken_study_summaries/student_a';

  const logPayload = {
    uid: 'student_a',
    dateKey: '2026-11-19',
    totalActiveSeconds: 2400,
    byGradeSkill: { 'eiken_2:listening': 1500, 'eiken_2:reading': 900 },
    solvedCount: 22,
    updatedAt: serverTimestamp(),
  };

  const summaryPayload = {
    uid: 'student_a',
    totalActiveSeconds: 7200,
    weekActiveSeconds: 5400,
    todayActiveSeconds: 2400,
    byGradeSkill: { 'eiken_2:listening': 4200, 'eiken_2:reading': 3000 },
    solvedCount: 65,
    lastActiveDateKey: '2026-11-19',
    updatedAt: serverTimestamp(),
  };

  // 本人の作成・更新・閲覧は成功
  await assertSucceeds(setDoc(doc(studentA, logPath), logPayload));
  await assertSucceeds(getDoc(doc(studentA, logPath)));
  await assertSucceeds(getDocs(collection(studentA, 'eiken_users/student_a/sugoroku_study_logs')));
  await assertSucceeds(setDoc(doc(studentA, summaryPath), summaryPayload));
  await assertSucceeds(getDoc(doc(studentA, summaryPath)));

  // 担当講師（study_access 保持）・担当 staff・塾 owner は閲覧成功
  await assertSucceeds(getDoc(doc(teacherA, logPath)));
  await assertSucceeds(getDocs(collection(teacherA, 'eiken_users/student_a/sugoroku_study_logs')));
  await assertSucceeds(getDoc(doc(staffA, logPath)));
  await assertSucceeds(getDoc(doc(ownerAdmin, logPath)));
  await assertSucceeds(getDoc(doc(teacherA, summaryPath)));
  await assertSucceeds(getDoc(doc(staffA, summaryPath)));
  await assertSucceeds(getDoc(doc(ownerAdmin, summaryPath)));

  // 担当講師であっても生徒の学習時間を改ざん（書き込み）することは不可
  await assertFails(setDoc(doc(teacherA, logPath), logPayload));
  await assertFails(setDoc(doc(teacherA, summaryPath), summaryPayload));

  // 他クラス講師・他生徒・未認証は閲覧も書き込みも完全拒否
  for (const unauthorizedDb of [teacherB, studentB, anon]) {
    await assertFails(getDoc(doc(unauthorizedDb, logPath)));
    await assertFails(getDocs(collection(unauthorizedDb, 'eiken_users/student_a/sugoroku_study_logs')));
    await assertFails(setDoc(doc(unauthorizedDb, logPath), logPayload));
    await assertFails(getDoc(doc(unauthorizedDb, summaryPath)));
    await assertFails(setDoc(doc(unauthorizedDb, summaryPath), summaryPayload));
  }

  // 1日上限（86400秒）超過や不正日付キーは拒否
  await assertFails(setDoc(doc(studentA, logPath), { ...logPayload, totalActiveSeconds: 90000 }));
  await assertFails(setDoc(doc(studentA, 'eiken_users/student_a/sugoroku_study_logs/bad_key'), { ...logPayload, dateKey: 'bad_key' }));
});

test('classrooms/{classId}/assignments: teacher/staff create & update, enrolled student read (including targeted), others denied', async () => {
  const assignAllPath = 'eiken_classrooms/class_juku_a/assignments/hw_week1';
  const assignTargetedPath = 'eiken_classrooms/class_juku_a/assignments/hw_only_other';

  const hwPayload = {
    classId: 'class_juku_a',
    teacherUid: 'teacher_a',
    title: '第1週：2級リーディング10問＋リスニング10問＋単語30語',
    chapterIds: ['eiken_2_written_p1', 'eiken_2_listening_01'],
    dueAt: 1800000000000,
    startAt: 1799400000000,
    dailyQuotaProblems: 10,
    skillBreakdown: { reading: 10, listening: 10, vocab: 30 },
    createdAt: serverTimestamp(),
  };

  // 担当講師が宿題を作成可能
  await assertSucceeds(setDoc(doc(teacherA, assignAllPath), hwPayload));

  // 他クラス講師・生徒本人・未認証は宿題を作成不可
  await assertFails(setDoc(doc(teacherB, 'eiken_classrooms/class_juku_a/assignments/bad1'), { ...hwPayload, teacherUid: 'teacher_b' }));
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/assignments/bad2'), { ...hwPayload, teacherUid: 'student_a' }));
  await assertFails(setDoc(doc(anon, 'eiken_classrooms/class_juku_a/assignments/bad3'), hwPayload));
  // 無料クラス（plan: 'free'）では塾宿題を作成不可
  await assertFails(setDoc(doc(teacherA, 'eiken_classrooms/class_free_c/assignments/bad4'), { ...hwPayload, classId: 'class_free_c' }));

  // 在籍生徒（student_a）・担当講師・担当 staff は全体配信宿題を閲覧可能
  await assertSucceeds(getDoc(doc(studentA, assignAllPath)));
  await assertSucceeds(getDocs(collection(studentA, 'eiken_classrooms/class_juku_a/assignments')));
  await assertSucceeds(getDoc(doc(teacherA, assignAllPath)));
  await assertSucceeds(getDoc(doc(staffA, assignAllPath)));

  // 他クラス生徒（student_b）・他クラス講師（teacher_b）・未認証は閲覧不可
  for (const db of [studentB, teacherB, anon]) {
    await assertFails(getDoc(doc(db, assignAllPath)));
  }

  // 個別配信（targetStudentUids に student_a が含まれない宿題）は student_a から get 不可
  await assertSucceeds(setDoc(doc(teacherA, assignTargetedPath), {
    ...hwPayload,
    targetStudentUids: ['another_student_uid'],
  }));
  await assertFails(getDoc(doc(studentA, assignTargetedPath)));
  await assertSucceeds(getDoc(doc(teacherA, assignTargetedPath)));
});

test('writing_submissions: student submits own work, assigned teacher/staff reviews, cross-student/cross-class/anon denied', async () => {
  const subPath = 'eiken_classrooms/class_juku_a/writing_submissions/sub_w1';
  const baseSubmission = {
    classId: 'class_juku_a',
    studentUid: 'student_a',
    studentName: 'たくみ',
    grade: 'eiken_2',
    taskKey: 'eiken_2_round01_opinion',
    wordCount: 92,
    text: 'I think high school students should play sports regularly. First, it improves health...',
    formatWarnings: [],
    status: 'submitted',
    submittedAt: serverTimestamp(),
  };

  // 生徒本人が提出成功
  await assertSucceeds(setDoc(doc(studentA, subPath), baseSubmission));

  // 生徒が自分で review 付き（採点済み偽装）で提出するのは拒否
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/writing_submissions/sub_fake'), {
    ...baseSubmission,
    status: 'reviewed',
    review: { reviewerUid: 'student_a', score: 100, comment: 'perfect', reviewedAt: 1700000000000 },
  }));

  // 他生徒が student_a になりすまして提出・または未在籍クラスへ提出するのは拒否
  await assertFails(setDoc(doc(studentB, 'eiken_classrooms/class_juku_a/writing_submissions/sub_spoof'), baseSubmission));
  await assertFails(setDoc(doc(studentB, 'eiken_classrooms/class_juku_a/writing_submissions/sub_unmember'), {
    ...baseSubmission,
    studentUid: 'student_b',
  }));

  // 閲覧検証：本人・担当講師・担当staff・owner は可、他クラス講師・他生徒・未認証は拒否
  await assertSucceeds(getDoc(doc(studentA, subPath)));
  await assertSucceeds(getDoc(doc(teacherA, subPath)));
  await assertSucceeds(getDoc(doc(staffA, subPath)));
  await assertSucceeds(getDoc(doc(ownerAdmin, subPath)));
  await assertFails(getDoc(doc(teacherB, subPath)));
  await assertFails(getDoc(doc(studentB, subPath)));
  await assertFails(getDoc(doc(anon, subPath)));
  // 他生徒がクラス全体の提出一覧を list しようとしても拒否（自分の studentUid で絞ったクエリのみ可）
  await assertFails(getDocs(collection(studentB, 'eiken_classrooms/class_juku_a/writing_submissions')));
  await assertSucceeds(getDocs(query(collection(studentA, 'eiken_classrooms/class_juku_a/writing_submissions'), where('studentUid', '==', 'student_a'))));
  await assertSucceeds(getDocs(collection(teacherA, 'eiken_classrooms/class_juku_a/writing_submissions')));

  // 他クラス講師による添削書き込みは拒否
  await assertFails(updateDoc(doc(teacherB, subPath), {
    status: 'reviewed',
    review: { reviewerUid: 'teacher_b', score: 14, comment: 'unauthorized', reviewedAt: serverTimestamp() },
  }));

  // 担当講師による添削書き込み（review 付与）は成功
  await assertSucceeds(updateDoc(doc(teacherA, subPath), {
    status: 'reviewed',
    review: {
      reviewerUid: 'teacher_a',
      score: 14,
      comment: '理由が2点明確に書けています。第2段落の時制だけ揃えましょう。',
      correctedText: 'I think high school students should play sports regularly...',
      reviewedAt: serverTimestamp(),
    },
  }));

  // 添削完了（status == 'reviewed'）後は生徒が勝手に上書き・削除できない
  await assertFails(deleteDoc(doc(studentA, subPath)));
});

test('speaking_submissions: S-CBT metadata & storagePath validation, teacher review, cross-access denied', async () => {
  const subPath = 'eiken_classrooms/class_juku_a/speaking_submissions/spk_01';
  const validRecs = [
    {
      partId: 'reading_aloud',
      storagePath: 'sugoroku_speaking/class_juku_a/student_a/spk_01/reading_aloud.webm',
      mimeType: 'audio/webm;codecs=opus',
      durationSec: 19.5,
    },
    {
      partId: 'q1',
      storagePath: 'sugoroku_speaking/class_juku_a/student_a/spk_01/q1.m4a',
      mimeType: 'audio/mp4',
      durationSec: 24.0,
    },
  ];

  const spkPayload = {
    classId: 'class_juku_a',
    studentUid: 'student_a',
    studentName: 'たくみ',
    grade: 'eiken_2',
    setId: 'scbt_eiken2_set01',
    recordings: validRecs,
    status: 'submitted',
    submittedAt: serverTimestamp(),
  };

  // 生徒本人が正しい Storage パス・MIME で提出成功
  await assertSucceeds(setDoc(doc(studentA, subPath), spkPayload));

  // 他人の Storage パスを指すメタデータや非音声 MIME は拒否
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/speaking_submissions/spk_bad_path'), {
    ...spkPayload,
    recordings: [{
      partId: 'q1',
      storagePath: 'sugoroku_speaking/class_juku_a/student_b/spk_bad_path/q1.webm',
      mimeType: 'audio/webm',
      durationSec: 15,
    }],
  }));
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/speaking_submissions/spk_bad_mime'), {
    ...spkPayload,
    recordings: [{
      partId: 'q1',
      storagePath: 'sugoroku_speaking/class_juku_a/student_a/spk_bad_mime/q1.webm',
      mimeType: 'application/octet-stream',
      durationSec: 15,
    }],
  }));

  // 本人・担当講師・担当 staff は閲覧成功、他クラス講師・他生徒・未認証は拒否
  await assertSucceeds(getDoc(doc(studentA, subPath)));
  await assertSucceeds(getDoc(doc(teacherA, subPath)));
  await assertSucceeds(getDoc(doc(staffA, subPath)));
  await assertFails(getDoc(doc(teacherB, subPath)));
  await assertFails(getDoc(doc(studentB, subPath)));
  await assertFails(getDoc(doc(anon, subPath)));

  // 担当 staff によるスピーキング評価返却が成功
  await assertSucceeds(updateDoc(doc(staffA, subPath), {
    status: 'reviewed',
    review: {
      reviewerUid: 'sugoroku_staff_a',
      rubricScores: { reading: 4, qa: 18, attitude: 3 },
      comment: '音読の発音が明瞭です。No.4は結論を最初の1文で言い切りましょう。',
      reviewedAt: serverTimestamp(),
    },
  }));
});

test('storage.rules: S-CBT audio upload enforces student ownership, <=5MB limit, audio MIME, and teacher-only review playback', { skip: !hasStorageEmulator }, async () => {
  const stStudentA = env.authenticatedContext('student_a').storage();
  const stStudentB = env.authenticatedContext('student_b').storage();
  const stTeacherA = env.authenticatedContext('teacher_a').storage();
  const stTeacherB = env.authenticatedContext('teacher_b').storage();
  const stStaffA = env.authenticatedContext('sugoroku_staff_a').storage();
  const stAnon = env.unauthenticatedContext().storage();

  const smallAudio = new Uint8Array(2048);
  const validPath = 'sugoroku_speaking/class_juku_a/student_a/spk_01/reading_aloud.webm';
  const safariPath = 'sugoroku_speaking/class_juku_a/student_a/spk_01/q1.m4a';

  // 1. 生徒本人が WebM/Opus (Chrome) および MP4/M4A (iPad Safari) でアップロード成功
  await assertSucceeds(uploadBytes(ref(stStudentA, validPath), smallAudio, { contentType: 'audio/webm;codecs=opus' }));
  await assertSucceeds(uploadBytes(ref(stStudentA, safariPath), smallAudio, { contentType: 'audio/mp4' }));

  // 2. 生徒本人・担当クラス講師・担当 staff は音声を取得（再生）可能
  await assertSucceeds(getBytes(ref(stStudentA, validPath)));
  await assertSucceeds(getBytes(ref(stTeacherA, validPath)));
  await assertSucceeds(getBytes(ref(stStaffA, validPath)));

  // 3. 他クラス講師・他生徒・未認証は再生も上書きも完全拒否
  for (const unauthorizedSt of [stTeacherB, stStudentB, stAnon]) {
    await assertFails(getBytes(ref(unauthorizedSt, validPath)));
    await assertFails(uploadBytes(ref(unauthorizedSt, validPath), smallAudio, { contentType: 'audio/webm' }));
  }

  // 3b. ちょうど 5MB（5 * 1024 * 1024 bytes）は上限以内のため成功
  const exact5Mb = new Uint8Array(5 * 1024 * 1024);
  await assertSucceeds(uploadBytes(
    ref(stStudentA, 'sugoroku_speaking/class_juku_a/student_a/spk_01/q4.webm'),
    exact5Mb,
    { contentType: 'audio/webm' },
  ));

  // 4. 5MB 超過ファイル（5MB + 1 byte）は拒否
  const over5Mb = new Uint8Array(5 * 1024 * 1024 + 1);
  await assertFails(uploadBytes(
    ref(stStudentA, 'sugoroku_speaking/class_juku_a/student_a/spk_01/q2.webm'),
    over5Mb,
    { contentType: 'audio/webm' },
  ));

  // 5. 音声以外の MIME タイプや不正ファイル名は拒否
  await assertFails(uploadBytes(
    ref(stStudentA, 'sugoroku_speaking/class_juku_a/student_a/spk_01/q3.webm'),
    smallAudio,
    { contentType: 'text/plain' },
  ));
  await assertFails(uploadBytes(
    ref(stStudentA, 'sugoroku_speaking/class_juku_a/student_a/spk_01/malware.exe'),
    smallAudio,
    { contentType: 'audio/webm' },
  ));

  // 6. 許可されていない任意の Storage パスは拒否
  await assertFails(uploadBytes(ref(stStudentA, 'public/random.webm'), smallAudio, { contentType: 'audio/webm' }));

  // 7. 生徒本人は自分の録音を削除可能、他人は削除不可
  await assertFails(deleteObject(ref(stStudentB, safariPath)));
  await assertSucceeds(deleteObject(ref(stStudentA, safariPath)));
});

test('sugoroku class member subcollection, flat study logs, and suspended member revocation', async () => {
  await seedSugorokuFixtures();

  const stStudentA = env.authenticatedContext('student_a').storage();

  // 1. クラス別 sugoroku_members サブコレクション（AI 1 管理ポータル連携）
  const classMemberARef = doc(studentA, 'eiken_classrooms/class_juku_a/sugoroku_members/student_a');
  await assertSucceeds(setDoc(classMemberARef, {
    uid: 'student_a',
    classId: 'class_juku_a',
    role: 'student',
    targetGrade: 'eiken_2',
    active: true,
    adFree: true,
    displayName: 'たくみ',
    consentAcceptedAt: Date.now(),
    updatedAt: Date.now(),
    serverUpdatedAt: serverTimestamp(),
  }));

  // 生徒本人が自分で rosterName や note を書き込むのは拒否
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/sugoroku_members/student_a'), {
    uid: 'student_a',
    classId: 'class_juku_a',
    role: 'student',
    targetGrade: 'eiken_2',
    active: true,
    adFree: true,
    rosterName: '勝手な名簿名',
    note: '勝手な指導メモ',
    updatedAt: Date.now(),
  }));

  // 担当講師（teacher_a）は rosterName・note・targetGrade を更新でき、一覧 list も取得可能
  await assertSucceeds(setDoc(doc(teacherA, 'eiken_classrooms/class_juku_a/sugoroku_members/student_a'), {
    uid: 'student_a',
    classId: 'class_juku_a',
    role: 'student',
    rosterName: '佐藤 拓海',
    targetGrade: 'eiken_pre1',
    note: 'ライティングの理由展開が毎週伸びています',
    active: true,
    adFree: true,
    updatedAt: Date.now(),
    serverUpdatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDocs(collection(teacherA, 'eiken_classrooms/class_juku_a/sugoroku_members')));

  // 他生徒や他クラス講師はクラス名簿サブコレクションを list 不可（実名・指導メモ漏洩防止）
  await assertFails(getDocs(collection(studentB, 'eiken_classrooms/class_juku_a/sugoroku_members')));
  await assertFails(getDocs(collection(teacherB, 'eiken_classrooms/class_juku_a/sugoroku_members')));

  // 2. フラット学習時間ログ eiken_sugoroku_study_logs/{uid}_{dateKey}（AI 2 timelogStore 互換）
  await assertSucceeds(setDoc(doc(studentA, 'eiken_sugoroku_study_logs/student_a_2026-11-19'), {
    uid: 'student_a',
    dateKey: '2026-11-19',
    totalActiveSeconds: 2400,
    byGradeSkill: { 'eiken_2:listening': 1200, 'eiken_2:vocab': 1200 },
    accuracyByGradeSkill: { 'eiken_2:listening': { correct: 18, total: 22 } },
    solvedCount: 22,
    updatedAt: Date.now(),
  }));

  // 他人の UID プレフィックスを偽装した書き込みは拒否
  await assertFails(setDoc(doc(studentA, 'eiken_sugoroku_study_logs/student_b_2026-11-19'), {
    uid: 'student_a',
    dateKey: '2026-11-19',
    totalActiveSeconds: 100,
    byGradeSkill: {},
    solvedCount: 1,
    updatedAt: Date.now(),
  }));

  // 本人・担当講師は読めるが、他生徒・他クラス講師は読めない
  await assertSucceeds(getDoc(doc(studentA, 'eiken_sugoroku_study_logs/student_a_2026-11-19')));
  await assertSucceeds(getDoc(doc(teacherA, 'eiken_sugoroku_study_logs/student_a_2026-11-19')));
  await assertFails(getDoc(doc(studentB, 'eiken_sugoroku_study_logs/student_a_2026-11-19')));
  await assertFails(getDoc(doc(teacherB, 'eiken_sugoroku_study_logs/student_a_2026-11-19')));

  // 3. 退塾・停止（active: false）時の即時遮断テスト
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'eiken_sugoroku_members/student_a'), {
      uid: 'student_a',
      role: 'student',
      active: false,
      adFree: false,
      classIds: ['class_juku_a'],
    });
  });

  // 停止された student_a は新規ライティング提出・学習ログ更新・Storage 録音アップロードがすべて即時拒否される
  await assertFails(setDoc(doc(studentA, 'eiken_classrooms/class_juku_a/writing_submissions/sub_after_suspend'), {
    studentUid: 'student_a',
    studentName: 'たくみ',
    grade: 'eiken_2',
    taskKey: 'g2_email_01',
    wordCount: 90,
    text: 'Suspended user attempt.',
    formatWarnings: [],
    status: 'submitted',
    submittedAt: Date.now(),
  }));
  await assertFails(setDoc(doc(studentA, 'eiken_sugoroku_study_logs/student_a_2026-11-20'), {
    uid: 'student_a',
    dateKey: '2026-11-20',
    totalActiveSeconds: 300,
    byGradeSkill: {},
    solvedCount: 5,
    updatedAt: Date.now(),
  }));
  await assertFails(uploadBytes(
    ref(stStudentA, 'sugoroku_speaking/class_juku_a/student_a/spk_suspended/q1.webm'),
    new Uint8Array(512),
    { contentType: 'audio/webm' },
  ));
});
