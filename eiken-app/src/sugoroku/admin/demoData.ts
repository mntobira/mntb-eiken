/**
 * ===================================================================
 * すごろく塾管理者ポータル：試作デモ用リアルサンプルデータ（11/23・11/27 デモ対応）
 * ===================================================================
 * 西様・小松様・藤沢様への試作デモで、
 * 「誰が・英検何級のどの分野を何分やったか・誰が停滞しているか・正答率推移はどうか」
 * が一瞬で伝わるよう、運動部所属の高校生6名のリアルな学習ペルソナを構成する。
 */

import { formatDateKey, shiftDateKey } from './adminAnalytics';
import type {
  SugorokuAssignmentDoc,
  SugorokuMemberDoc,
  SugorokuSpeakingSubmissionDoc,
  SugorokuStaffInviteDoc,
  SugorokuStudyLogDoc,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export interface SugorokuDemoBundle {
  classId: string;
  className: string;
  schoolName: string;
  joinCode: string;
  ownerName: string;
  ownerEmail: string;
  staffInvites: SugorokuStaffInviteDoc[];
  members: SugorokuMemberDoc[];
  logsByUid: Record<string, SugorokuStudyLogDoc[]>;
  solvedByUid: Record<string, Record<string, number>>;
  assignments: SugorokuAssignmentDoc[];
  writingSubmissions: SugorokuWritingSubmissionDoc[];
  speakingSubmissions: SugorokuSpeakingSubmissionDoc[];
}

export function createSugorokuDemoBundle(nowMs: number = Date.now()): SugorokuDemoBundle {
  const today = formatDateKey(nowMs);
  const d = (offsetDays: number) => shiftDateKey(today, offsetDays);
  const ts = (offsetDays: number, hour = 20, minute = 15) => {
    const [y, m, day] = d(offsetDays).split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1, hour, minute, 0).getTime();
  };

  const classId = 'demo_sugoroku_2027_sp';

  const members: SugorokuMemberDoc[] = [
    {
      uid: 'stu_takahashi_haruto',
      classId,
      role: 'student',
      rosterName: '高橋 陽斗（高2・サッカー部）',
      displayName: 'ハルト',
      targetGrade: 'eiken_2',
      active: true,
      adFree: true,
      note: '立命館大 スポーツ健康科学部（総合型＋一般3科目併願）志望。5月S-CBTで2級目標。',
      joinedAt: ts(-28),
    },
    {
      uid: 'stu_sato_mio',
      classId,
      role: 'student',
      rosterName: '佐藤 美桜（高2・陸上部）',
      displayName: 'みお',
      targetGrade: 'eiken_2',
      active: true,
      adFree: true,
      note: '毎日コツコツ型。リスニング第1部・第2部が安定、長文空所を強化中。',
      joinedAt: ts(-28),
    },
    {
      uid: 'stu_yamamoto_riku',
      classId,
      role: 'student',
      rosterName: '山本 陸（高2・野球部）',
      displayName: 'RIKU_89',
      targetGrade: 'eiken_2',
      active: true,
      adFree: true,
      note: '遠征後に学習が止まりやすい。4日間未アクセス・今週の宿題未完了のため声掛け優先。',
      joinedAt: ts(-25),
    },
    {
      uid: 'stu_nakamura_yuna',
      classId,
      role: 'student',
      rosterName: '中村 結菜（高1・バスケ部）',
      displayName: 'ゆな',
      targetGrade: 'eiken_pre2plus',
      active: true,
      adFree: true,
      note: 'まず準2級プラスで基礎固め→春から2級へステップアップ予定。',
      joinedAt: ts(-21),
    },
    {
      uid: 'stu_kobayashi_sota',
      classId,
      role: 'student',
      rosterName: '小林 颯太（高2・ラグビー部）',
      displayName: 'ソウタ',
      targetGrade: 'eiken_pre2',
      active: true,
      adFree: true,
      note: '週末まとめ解き傾向あり。1日15分の単語＋リスニング習慣化を指導中。',
      joinedAt: ts(-18),
    },
    {
      uid: 'stu_ito_aoi',
      classId,
      role: 'student',
      rosterName: '伊藤 葵（高2・バレー部／体験生）',
      displayName: 'あおい',
      targetGrade: 'eiken_2',
      active: true,
      adFree: true,
      note: '今週クラス参加コード承認済み。まだ初回演習が未開始のためLINEで案内予定。',
      joinedAt: ts(-2),
    },
  ];

  const assignments: SugorokuAssignmentDoc[] = [
    {
      id: 'asg_week04_g2_core',
      classId,
      teacherUid: 'teacher_sugoroku_nishi',
      title: '【第4週】2級 大問1語彙(第3回)＋リスニング第1部(第3回)＋必須単語30語',
      chapterIds: [
        'eiken_2_written_03_short',
        'eiken_2_listening_r03_part1',
        'eiken_2_vocabulary_01',
      ],
      startAt: ts(-5, 9, 0),
      dueAt: ts(2, 23, 59),
      dailyQuotaProblems: 10,
      skillBreakdown: {
        reading: 17,
        listening: 15,
        vocab: 30,
      },
      targetStudentUids: [
        'stu_takahashi_haruto',
        'stu_sato_mio',
        'stu_yamamoto_riku',
        'stu_ito_aoi',
      ],
      createdAt: ts(-5, 9, 0),
    },
    {
      id: 'asg_week03_g2_writing',
      classId,
      teacherUid: 'teacher_sugoroku_fujisawa',
      title: '【第3週】2級 ライティング第2回（要約・意見論述）＋長文空所',
      chapterIds: ['eiken_2_written_02_cloze'],
      startAt: ts(-12, 9, 0),
      dueAt: ts(-1, 23, 59), // 昨日締切（未完了生徒は期限超過アラート対象）
      dailyQuotaProblems: 6,
      skillBreakdown: {
        reading: 6,
        writing: 2,
      },
      targetStudentUids: ['stu_takahashi_haruto', 'stu_sato_mio', 'stu_yamamoto_riku'],
      createdAt: ts(-12, 9, 0),
    },
    {
      id: 'asg_week04_pre2p',
      classId,
      teacherUid: 'teacher_sugoroku_nishi',
      title: '【基礎固め】準2級プラス 第2回 大問1＋リスニング第1部',
      chapterIds: ['eiken_pre2plus_written_02_short', 'eiken_pre2plus_listening_r02_part1'],
      startAt: ts(-4, 9, 0),
      dueAt: ts(1, 23, 59),
      dailyQuotaProblems: 8,
      skillBreakdown: {
        reading: 17,
        listening: 15,
        vocab: 20,
      },
      targetStudentUids: ['stu_nakamura_yuna', 'stu_kobayashi_sota'],
      createdAt: ts(-4, 9, 0),
    },
  ];

  // 各生徒の14日間タイムログ（1分無操作除外済みの有効学習秒数）
  const logsByUid: Record<string, SugorokuStudyLogDoc[]> = {
    // 佐藤美桜：毎日安定して30〜50分学習（超順調）
    stu_sato_mio: [
      {
        dateKey: d(-11),
        totalActiveSeconds: 2100,
        byGradeSkill: { 'eiken_2:listening': 1200, 'eiken_2:vocab': 900 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 12, total: 15 },
          'eiken_2:vocab': { correct: 25, total: 30 },
        },
        solvedCount: 45,
        updatedAt: ts(-11, 21, 10),
      },
      {
        dateKey: d(-9),
        totalActiveSeconds: 2400,
        byGradeSkill: { 'eiken_2:reading': 1500, 'eiken_2:vocab': 900 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 13, total: 17 },
          'eiken_2:vocab': { correct: 26, total: 30 },
        },
        solvedCount: 47,
        updatedAt: ts(-9, 20, 45),
      },
      {
        dateKey: d(-6),
        totalActiveSeconds: 2700,
        byGradeSkill: { 'eiken_2:listening': 1500, 'eiken_2:writing': 1200 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 13, total: 15 },
        },
        solvedCount: 17,
        updatedAt: ts(-6, 21, 30),
      },
      {
        dateKey: d(-4),
        totalActiveSeconds: 2280,
        byGradeSkill: { 'eiken_2:reading': 1380, 'eiken_2:vocab': 900 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 14, total: 17 },
          'eiken_2:vocab': { correct: 28, total: 30 },
        },
        solvedCount: 47,
        updatedAt: ts(-4, 21, 5),
      },
      {
        dateKey: d(-2),
        totalActiveSeconds: 2520,
        byGradeSkill: { 'eiken_2:listening': 1320, 'eiken_2:speaking': 1200 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 14, total: 15 },
        },
        solvedCount: 19,
        updatedAt: ts(-2, 20, 20),
      },
      {
        dateKey: d(-1),
        totalActiveSeconds: 1980,
        byGradeSkill: { 'eiken_2:reading': 1080, 'eiken_2:vocab': 900 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 15, total: 17 },
          'eiken_2:vocab': { correct: 27, total: 30 },
        },
        solvedCount: 47,
        updatedAt: ts(-1, 21, 40),
      },
      {
        dateKey: d(0),
        totalActiveSeconds: 2340,
        byGradeSkill: { 'eiken_2:listening': 1440, 'eiken_2:vocab': 900 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 13, total: 15 },
          'eiken_2:vocab': { correct: 29, total: 30 },
        },
        solvedCount: 45,
        updatedAt: ts(0, 19, 50),
      },
    ],

    // 高橋陽斗：部活後に20〜35分取り組む標準モデル生
    stu_takahashi_haruto: [
      {
        dateKey: d(-10),
        totalActiveSeconds: 1800,
        byGradeSkill: { 'eiken_2:vocab': 1080, 'eiken_2:listening': 720 },
        accuracyByGradeSkill: {
          'eiken_2:vocab': { correct: 21, total: 30 },
          'eiken_2:listening': { correct: 9, total: 15 },
        },
        solvedCount: 45,
        updatedAt: ts(-10, 22, 10),
      },
      {
        dateKey: d(-7),
        totalActiveSeconds: 2160,
        byGradeSkill: { 'eiken_2:reading': 1440, 'eiken_2:writing': 720 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 11, total: 17 },
        },
        solvedCount: 19,
        updatedAt: ts(-7, 22, 0),
      },
      {
        dateKey: d(-5),
        totalActiveSeconds: 1920,
        byGradeSkill: { 'eiken_2:listening': 1200, 'eiken_2:vocab': 720 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 11, total: 15 },
          'eiken_2:vocab': { correct: 24, total: 30 },
        },
        solvedCount: 45,
        updatedAt: ts(-5, 21, 55),
      },
      {
        dateKey: d(-3),
        totalActiveSeconds: 1680,
        byGradeSkill: { 'eiken_2:reading': 1080, 'eiken_2:vocab': 600 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 12, total: 17 },
          'eiken_2:vocab': { correct: 25, total: 30 },
        },
        solvedCount: 47,
        updatedAt: ts(-3, 22, 20),
      },
      {
        dateKey: d(-1),
        totalActiveSeconds: 2100,
        byGradeSkill: { 'eiken_2:writing': 1200, 'eiken_2:speaking': 900 },
        solvedCount: 6,
        updatedAt: ts(-1, 22, 5),
      },
      {
        dateKey: d(0),
        totalActiveSeconds: 1500,
        byGradeSkill: { 'eiken_2:listening': 900, 'eiken_2:vocab': 600 },
        accuracyByGradeSkill: {
          'eiken_2:listening': { correct: 12, total: 15 },
          'eiken_2:vocab': { correct: 26, total: 30 },
        },
        solvedCount: 30,
        updatedAt: ts(0, 18, 30),
      },
    ],

    // 山本陸：4日前からストップ＆第3週宿題期限超過（アラート上位に表示される代表ケース）
    stu_yamamoto_riku: [
      {
        dateKey: d(-12),
        totalActiveSeconds: 1500,
        byGradeSkill: { 'eiken_2:vocab': 900, 'eiken_2:listening': 600 },
        accuracyByGradeSkill: {
          'eiken_2:vocab': { correct: 18, total: 30 },
          'eiken_2:listening': { correct: 8, total: 15 },
        },
        solvedCount: 45,
        updatedAt: ts(-12, 22, 30),
      },
      {
        dateKey: d(-8),
        totalActiveSeconds: 1200,
        byGradeSkill: { 'eiken_2:reading': 1200 },
        accuracyByGradeSkill: {
          'eiken_2:reading': { correct: 9, total: 17 },
        },
        solvedCount: 17,
        updatedAt: ts(-8, 22, 40),
      },
      {
        dateKey: d(-4),
        totalActiveSeconds: 960,
        byGradeSkill: { 'eiken_2:vocab': 600, 'eiken_2:listening': 360 },
        accuracyByGradeSkill: {
          'eiken_2:vocab': { correct: 19, total: 30 },
          'eiken_2:listening': { correct: 5, total: 10 },
        },
        solvedCount: 22,
        updatedAt: ts(-4, 23, 5),
      },
    ],

    // 中村結菜：準2級プラスで順調に学習中
    stu_nakamura_yuna: [
      {
        dateKey: d(-6),
        totalActiveSeconds: 1800,
        byGradeSkill: { 'eiken_pre2plus:reading': 1080, 'eiken_pre2plus:vocab': 720 },
        accuracyByGradeSkill: {
          'eiken_pre2plus:reading': { correct: 13, total: 17 },
          'eiken_pre2plus:vocab': { correct: 17, total: 20 },
        },
        solvedCount: 37,
        updatedAt: ts(-6, 20, 15),
      },
      {
        dateKey: d(-3),
        totalActiveSeconds: 1980,
        byGradeSkill: { 'eiken_pre2plus:listening': 1260, 'eiken_pre2plus:vocab': 720 },
        accuracyByGradeSkill: {
          'eiken_pre2plus:listening': { correct: 12, total: 15 },
          'eiken_pre2plus:vocab': { correct: 18, total: 20 },
        },
        solvedCount: 35,
        updatedAt: ts(-3, 20, 30),
      },
      {
        dateKey: d(-1),
        totalActiveSeconds: 1620,
        byGradeSkill: { 'eiken_pre2plus:reading': 1020, 'eiken_pre2plus:listening': 600 },
        accuracyByGradeSkill: {
          'eiken_pre2plus:reading': { correct: 14, total: 17 },
          'eiken_pre2plus:listening': { correct: 8, total: 10 },
        },
        solvedCount: 27,
        updatedAt: ts(-1, 21, 0),
      },
    ],

    // 小林颯太：明日締切なのに宿題消化率が35%（ペース遅れwarningアラート）
    stu_kobayashi_sota: [
      {
        dateKey: d(-5),
        totalActiveSeconds: 1320,
        byGradeSkill: { 'eiken_pre2:vocab': 720, 'eiken_pre2plus:listening': 600 },
        accuracyByGradeSkill: {
          'eiken_pre2:vocab': { correct: 15, total: 20 },
          'eiken_pre2plus:listening': { correct: 9, total: 15 },
        },
        solvedCount: 35,
        updatedAt: ts(-5, 22, 10),
      },
      {
        dateKey: d(-2),
        totalActiveSeconds: 840,
        byGradeSkill: { 'eiken_pre2plus:reading': 840 },
        accuracyByGradeSkill: {
          'eiken_pre2plus:reading': { correct: 10, total: 17 },
        },
        solvedCount: 17,
        updatedAt: ts(-2, 22, 25),
      },
    ],

    // 伊藤葵：入塾直後で未学習（初回未学習criticalアラート）
    stu_ito_aoi: [],
  };

  // 単元ごとの完了問題数（宿題進捗計算用）
  const solvedByUid: Record<string, Record<string, number>> = {
    stu_sato_mio: {
      eiken_2_written_02_cloze: 8,
      eiken_2_written_03_short: 17,
      eiken_2_listening_r03_part1: 15,
      eiken_2_vocabulary_01: 30,
    },
    stu_takahashi_haruto: {
      eiken_2_written_02_cloze: 8,
      eiken_2_written_03_short: 17,
      eiken_2_listening_r03_part1: 15,
      eiken_2_vocabulary_01: 18,
    },
    stu_yamamoto_riku: {
      eiken_2_written_02_cloze: 3, // 8問中3問で昨日締切超過
      eiken_2_written_03_short: 5,
      eiken_2_listening_r03_part1: 0,
      eiken_2_vocabulary_01: 10,
    },
    stu_nakamura_yuna: {
      eiken_pre2plus_written_02_short: 17,
      eiken_pre2plus_listening_r02_part1: 15,
    },
    stu_kobayashi_sota: {
      eiken_pre2plus_written_02_short: 10,
      eiken_pre2plus_listening_r02_part1: 8,
    },
    stu_ito_aoi: {},
  };

  const writingSubmissions: SugorokuWritingSubmissionDoc[] = [
    {
      id: 'wsub_haruto_01',
      classId,
      studentUid: 'stu_takahashi_haruto',
      studentName: '高橋 陽斗（高2・サッカー部）',
      grade: 'eiken_2',
      taskKey: 'eiken_2_round02_opinion',
      taskTitle: '英検2級 第2回 意見論述（スポーツ施設への自治体投資）',
      wordCount: 92,
      text: 'I think that local governments should invest more money in public sports facilities. First, exercising regularly helps people stay healthy and reduces medical costs in the future. Second, community gyms and parks give teenagers a safe place to practice sports and make friends outside school. Therefore, building better sports facilities benefits everyone in the city.',
      formatWarnings: [],
      status: 'submitted',
      submittedAt: ts(-1, 22, 4),
    },
    {
      id: 'wsub_mio_01',
      classId,
      studentUid: 'stu_sato_mio',
      studentName: '佐藤 美桜（高2・陸上部）',
      grade: 'eiken_2',
      taskKey: 'eiken_2_round02_summary',
      taskTitle: '英検2級 第2回 英文要約（オンライン授業の利点と課題）',
      wordCount: 54,
      text: 'Online classes allow students to study from anywhere and review recorded lessons easily. However, some students feel lonely because they have fewer chances to talk with classmates, and staring at screens for hours can cause eye fatigue.',
      formatWarnings: [],
      status: 'reviewed',
      submittedAt: ts(-6, 21, 25),
      review: {
        reviewerUid: 'teacher_sugoroku_fujisawa',
        reviewerName: '藤沢 卓登 講師',
        score: 14,
        maxScore: 16,
        comment: '45〜55語の語数制限にピタリ収まり、第1段落のメリットと第2段落の課題が自分の言葉で的確にパラフレーズできています！',
        reviewedAt: ts(-5, 18, 30),
      },
    },
  ];

  const speakingSubmissions: SugorokuSpeakingSubmissionDoc[] = [
    {
      id: 'ssub_haruto_01',
      classId,
      studentUid: 'stu_takahashi_haruto',
      studentName: '高橋 陽斗（高2・サッカー部）',
      grade: 'eiken_2',
      setId: 'scbt_g2_set01',
      setTitle: '2級 S-CBT模擬面接 Set 1（高校の部活動と地域スポーツ）',
      recordings: [
        {
          partId: 'reading_aloud',
          storagePath: `sugoroku_speaking/${classId}/stu_takahashi_haruto/ssub_haruto_01/reading_aloud.m4a`,
          mimeType: 'audio/mp4',
          durationSec: 46,
        },
        {
          partId: 'q1',
          storagePath: `sugoroku_speaking/${classId}/stu_takahashi_haruto/ssub_haruto_01/q1.m4a`,
          mimeType: 'audio/mp4',
          durationSec: 18,
        },
        {
          partId: 'q2',
          storagePath: `sugoroku_speaking/${classId}/stu_takahashi_haruto/ssub_haruto_01/q2.m4a`,
          mimeType: 'audio/mp4',
          durationSec: 27,
        },
        {
          partId: 'q3',
          storagePath: `sugoroku_speaking/${classId}/stu_takahashi_haruto/ssub_haruto_01/q3.m4a`,
          mimeType: 'audio/mp4',
          durationSec: 32,
        },
        {
          partId: 'q4',
          storagePath: `sugoroku_speaking/${classId}/stu_takahashi_haruto/ssub_haruto_01/q4.m4a`,
          mimeType: 'audio/mp4',
          durationSec: 35,
        },
      ],
      status: 'submitted',
      submittedAt: ts(-1, 22, 18),
    },
  ];

  const staffInvites: SugorokuStaffInviteDoc[] = [
    {
      id: `${classId}_fujisawa@sugoroku-juku.example.jp`,
      classId,
      className: '2027春 英検2級3か月合格コース（スポーツ総合型選抜クラス）',
      schoolName: 'オンライン個別指導塾 すごろく',
      email: 'fujisawa@sugoroku-juku.example.jp',
      staffName: '藤沢 卓登',
      role: 'staff',
      status: 'active',
      acceptedUid: 'teacher_sugoroku_fujisawa',
      invitedByUid: 'teacher_sugoroku_nishi',
      createdAt: ts(-28),
      updatedAt: ts(-27),
    },
    {
      id: `${classId}_komatsu@sugoroku-juku.example.jp`,
      classId,
      className: '2027春 英検2級3か月合格コース（スポーツ総合型選抜クラス）',
      schoolName: 'オンライン個別指導塾 すごろく',
      email: 'komatsu@sugoroku-juku.example.jp',
      staffName: '小松 講師',
      role: 'staff',
      status: 'invited',
      invitedByUid: 'teacher_sugoroku_nishi',
      createdAt: ts(-2),
      updatedAt: ts(-2),
    },
  ];

  return {
    classId,
    className: '2027春 英検2級3か月合格コース（スポーツ総合型選抜クラス）',
    schoolName: 'オンライン個別指導塾 すごろく',
    joinCode: 'SGRK27',
    ownerName: '西 代表',
    ownerEmail: 'nishi@sugoroku-juku.example.jp',
    staffInvites,
    members,
    logsByUid,
    solvedByUid,
    assignments,
    writingSubmissions,
    speakingSubmissions,
  };
}
