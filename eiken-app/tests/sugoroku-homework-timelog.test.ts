import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildHomeworkTask,
  buildWeeklyRoute,
  chapterIdsOfAppRound,
  compactSkillBreakdown,
  computeTodayQuota,
  countBySkill,
  daysLeftIncludingToday,
  endOfDayKey,
  estimateMinutes,
  HOMEWORK_PRESETS,
  parseChapterRef,
  pickPrimaryTask,
  sortHomeworkTasks,
} from '../src/sugoroku/homework/homeworkCore';
import {
  allEikenChapterCatalog,
  chapterIdsOfGrade,
  chapterTitleOf,
  chapterTotals,
} from '../src/sugoroku/homework/chapterTotals';
import { normalizePlan } from '../src/sugoroku/homework/homeworkStore';
import {
  activeSeconds,
  addSeconds,
  buildStudySummaryDoc,
  dayKeyOf,
  DAY_CAP_SECONDS,
  emptyLedger,
  formatDuration,
  IDLE_MS,
  labelOfBucket,
  markDatesSynced,
  OTHER_BUCKET,
  resolveStudyBucket,
  STEP_CAP_SECONDS,
  sumRecentDays,
} from '../src/sugoroku/timelog/timelogCore';
import {
  readLedger,
  recordTick,
  resetSyncGuardForTests,
  skillTotals,
  summarize,
} from '../src/sugoroku/timelog/timelogStore';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('AI 2: すごろく宿題エンジン（homeworkCore & chapterTotals）', () => {
  it('章IDから英検の級・技能（vocab / reading / listening / writing / speaking）を正確に判別する', () => {
    expect(parseChapterRef('eiken_2_written_01_short')).toEqual({
      grade: 'eiken_2',
      skill: 'vocab',
      family: 'written',
      variant: 'short',
    });
    expect(parseChapterRef('eiken_2_written_03_reading')).toEqual({
      grade: 'eiken_2',
      skill: 'reading',
      family: 'written',
      variant: 'reading',
    });
    expect(parseChapterRef('eiken_pre2plus_listening_r02_part1')).toEqual({
      grade: 'eiken_pre2plus',
      skill: 'listening',
      family: 'listening',
      variant: 'part1',
    });
    expect(parseChapterRef('eiken_pre2_vocabulary_01')?.skill).toBe('vocab');
    expect(parseChapterRef('unknown_subject_01')).toBeNull();
  });

  it('1日あたりの推奨ノルマ計算・残数消化・上限クランプが正確に動く', () => {
    // 30問残り・残り5日 → 自動日割り6問。今日2問解いたら残り4問
    // ※ remaining は「現時点の残り」なので今日2問解いて28問残っていれば、朝時点30問÷5日＝6問目標 → 今日あと4問
    expect(computeTodayQuota({ remaining: 28, daysLeft: 5, doneToday: 2 })).toBe(4);
    // 先生が1日5問を指定済み、今日5問解いた → 今日の残り 0（追い立てない）
    expect(computeTodayQuota({ remaining: 20, daysLeft: 4, plannedQuota: 5, doneToday: 5 })).toBe(0);
    // 全問完了時は 0
    expect(computeTodayQuota({ remaining: 0, daysLeft: 3, plannedQuota: 8, doneToday: 0 })).toBe(0);
  });

  it('buildHomeworkTask: 未完了の先頭単元へのワンタップ遷移先・進捗率・まとめ解き検知を正しく算出する', () => {
    const now = new Date(2026, 10, 20, 18, 0, 0).getTime(); // 2026-11-20 18:00
    const dueAt = endOfDayKey('2026-11-25');
    const totals = {
      eiken_2_written_01_short: 17,
      eiken_2_written_01_reading: 10,
      eiken_2_listening_r01_part1: 15,
    };

    // 第1章（17問）をすべて過去に完了済み、第2章を今日2問だけ解いた状態
    const solved: Record<string, number> = {};
    for (let i = 1; i <= 17; i += 1) {
      solved[`eiken_2_written_01_short::q${i}`] = now - 2 * 86_400_000;
    }
    solved['eiken_2_written_01_reading::q1'] = now - 1000;
    solved['eiken_2_written_01_reading::q2'] = now - 500;

    const task = buildHomeworkTask({
      assignment: {
        id: 'asg-1',
        classId: 'cls-sugoroku',
        title: '英検2級 第1週 標準ルート',
        chapterIds: [
          'eiken_2_written_01_short',
          'eiken_2_written_01_reading',
          'eiken_2_listening_r01_part1',
        ],
        dueAt,
      },
      className: 'すごろく高2クラス',
      plan: normalizePlan({
        id: 'asg-1',
        classId: 'cls-sugoroku',
        dailyQuotaProblems: 5,
        presetId: 'eiken2-12w',
        presetWeek: 1,
      }),
      totals,
      solved,
      now,
    });

    expect(task.total).toBe(42);
    expect(task.solved).toBe(19);
    expect(task.remaining).toBe(23);
    expect(task.nextChapterId).toBe('eiken_2_written_01_reading');
    expect(task.todayQuota).toBe(5);
    expect(task.todayDone).toBe(2);
    expect(task.todayRemaining).toBe(3);
    expect(task.daysLeft).toBe(daysLeftIncludingToday(dueAt, now));
    expect(task.skillBreakdown).toEqual({
      vocab: 17,
      reading: 10,
      listening: 15,
    });
    expect(estimateMinutes(task.todayRemaining)).toBeGreaterThan(0);

    // 1日で15問一気に解いた場合、overPacedToday が true になり分散定着メッセージに切り替わる
    for (let i = 3; i <= 15; i += 1) {
      solved[`eiken_2_listening_r01_part1::q${i}`] = now - 200;
    }
    const crammed = buildHomeworkTask({
      assignment: {
        id: 'asg-1',
        classId: 'cls-sugoroku',
        title: '英検2級 第1週 標準ルート',
        chapterIds: [
          'eiken_2_written_01_short',
          'eiken_2_written_01_reading',
          'eiken_2_listening_r01_part1',
        ],
        dueAt,
      },
      className: 'すごろく高2クラス',
      plan: normalizePlan({
        id: 'asg-1',
        classId: 'cls-sugoroku',
        dailyQuotaProblems: 5,
      }),
      totals,
      solved,
      now,
    });
    expect(crammed.overPacedToday).toBe(true);
    expect(crammed.message).toContain('まとめ解き');
  });

  it('実データの索引（SUBJECT_INDEX）から英検2級・準2級プラス・準2級の12週標準ルートが10単元以内で構築できる', () => {
    const totals = chapterTotals();
    expect(Object.keys(totals).length).toBeGreaterThan(50);

    for (const preset of HOMEWORK_PRESETS) {
      const gradeChapters = chapterIdsOfGrade(preset.grade);
      expect(gradeChapters.length).toBeGreaterThan(0);

      const routes = buildWeeklyRoute(preset.grade, gradeChapters, 12, totals);
      expect(routes).toHaveLength(12);
      routes.forEach((r) => {
        expect(r.chapterIds.length).toBeGreaterThan(0);
        expect(r.chapterIds.length).toBeLessThanOrEqual(10); // 既存 firestore.rules の上限厳守
        expect(r.recommendedDailyQuota).toBeGreaterThanOrEqual(3);
        expect(chapterTitleOf(r.chapterIds[0])).toBeTruthy();
      });
    }

    const sampleCounts = countBySkill(chapterIdsOfGrade('eiken_2').slice(0, 5), totals);
    const compact = compactSkillBreakdown(sampleCounts);
    expect(Object.values(compact).every((v) => (v ?? 0) > 0)).toBe(true);

    // アプリ内の回数（第1回〜第15回）指定で筆記＋リスニングの全該当単元を取得できる
    for (const grade of ['eiken_2', 'eiken_pre2plus', 'eiken_pre2', 'eiken_3', 'eiken_4', 'eiken_5', 'eiken_pre1', 'eiken_1']) {
      const avail = chapterIdsOfGrade(grade);
      const r1 = chapterIdsOfAppRound(grade, 1, avail);
      expect(r1.length).toBeGreaterThanOrEqual(4);
      expect(r1.length).toBeLessThanOrEqual(10);
      expect(r1.some((id) => id.includes('_written_01_'))).toBe(true);
      expect(r1.some((id) => id.includes('_listening_r01_'))).toBe(true);
    }

    // 目標周回数（targetLaps）と講師メモ（coachInstruction）が task に透過伝搬される
    const nowMs = Date.now();
    const lapTask = buildHomeworkTask({
      assignment: {
        id: 'lap-1',
        classId: 'cls-1',
        title: '英検2級 アプリ第1回（2周）',
        chapterIds: ['eiken_2_written_01_short'],
        dueAt: nowMs + 7 * 86_400_000,
      },
      className: 'すごろく塾',
      plan: normalizePlan({
        id: 'lap-1',
        classId: 'cls-1',
        dailyQuotaProblems: 6,
        targetLaps: 2,
        coachInstruction: '間違えた問題は音読2回！',
      }),
      totals,
      solved: {},
      now: nowMs,
    });
    expect(lapTask.targetLaps).toBe(2);
    expect(lapTask.coachInstruction).toBe('間違えた問題は音読2回！');
  });

  it('pickPrimaryTask & sortHomeworkTasks: 未完了かつ期限超過・締切間近の宿題を最優先でピン留めする', () => {
    const now = 1_760_000_000_000;
    const base = {
      classId: 'c1',
      className: '塾',
      chapterIds: ['eiken_2_written_01_short'],
      nextChapterId: 'eiken_2_written_01_short',
      total: 10,
      percent: 50,
      daysLeft: 2,
      todayQuota: 3,
      todayDone: 0,
      todayRemaining: 3,
      perDayNeeded: 3,
      message: 'msg',
    };
    const doneTask = {
      ...base,
      assignmentId: 'done-1',
      title: '完了済み',
      dueAt: now + 86_400_000,
      solved: 10,
      remaining: 0,
      status: 'done' as const,
      overdue: false,
    };
    const futureTask = {
      ...base,
      assignmentId: 'open-later',
      title: '来週締切',
      dueAt: now + 5 * 86_400_000,
      solved: 2,
      remaining: 8,
      status: 'ahead' as const,
      overdue: false,
    };
    const overdueTask = {
      ...base,
      assignmentId: 'overdue-1',
      title: '期限超過の未完了',
      dueAt: now - 86_400_000,
      solved: 4,
      remaining: 6,
      status: 'behind' as const,
      overdue: true,
    };

    const sorted = sortHomeworkTasks([doneTask, futureTask, overdueTask], now);
    expect(sorted.map((t) => t.assignmentId)).toEqual(['overdue-1', 'open-later', 'done-1']);
    expect(pickPrimaryTask([doneTask, futureTask, overdueTask], now)?.assignmentId).toBe('overdue-1');

    // 全級一括ルーム向けカタログが5級〜1級の全単元を横断して返すことを検証
    const allCatalog = allEikenChapterCatalog();
    expect(allCatalog.length).toBeGreaterThan(200);
    expect(allCatalog.some((c) => c.id.startsWith('eiken_5_'))).toBe(true);
    expect(allCatalog.some((c) => c.id.startsWith('eiken_2_'))).toBe(true);
    expect(allCatalog.some((c) => c.id.startsWith('eiken_1_'))).toBe(true);
  });
});

describe('AI 2: 分野別アクティブ学習時間計測（timelogCore & timelogStore）', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    resetSyncGuardForTests();
  });

  it('1分間（60,000ms）無操作を過ぎた区間を正確に除外する', () => {
    const t0 = 1_000_000;
    // 操作から15秒後 → 15秒すべて有効
    expect(activeSeconds(t0, t0 + 15_000, t0, IDLE_MS)).toBe(15);
    // 最後の操作が t0、そこから 90秒後に tick が走った → 有効なのは t0 + 60秒までの 60秒のみ
    expect(activeSeconds(t0, t0 + 90_000, t0, IDLE_MS)).toBe(60);
    // すでに1分以上無操作のまま次の15秒区間 [t0+75s, t0+90s] に入った → 0秒（完全停止）
    expect(activeSeconds(t0 + 75_000, t0 + 90_000, t0, IDLE_MS)).toBe(0);
  });

  it('画面コンテキスト（単元ID・ライティング・語彙固め・模試）から級×技能バケットを正確に解決する', () => {
    expect(resolveStudyBucket({ chapterId: 'eiken_2_listening_r03_part2' })).toBe('eiken_2:listening');
    expect(resolveStudyBucket({ chapterId: 'eiken_2_written_02_short' })).toBe('eiken_2:vocab');
    expect(resolveStudyBucket({ chapterId: 'eiken_2_written_02_cloze' })).toBe('eiken_2:reading');
    expect(resolveStudyBucket({ screenKey: 'writing', subjectId: 'eiken_2' })).toBe('eiken_2:writing');
    expect(
      resolveStudyBucket({ screenKey: 'foundation', subjectId: 'eiken_pre2plus', foundationTab: 'words' }),
    ).toBe('eiken_pre2plus:vocab');
    expect(
      resolveStudyBucket({ screenKey: 'mock', subjectId: 'eiken_2', mockKind: 'listening' }),
    ).toBe('eiken_2:listening');
    expect(resolveStudyBucket({ screenKey: 'home' })).toBe(OTHER_BUCKET);
  });

  it('90秒ステップ上限・12時間日次上限・同一区間の二重計上防止・dirtyDateKeys 管理が機能する', () => {
    const now = new Date(2026, 10, 20, 20, 0, 0).getTime();
    const key = dayKeyOf(now);
    let ledger = emptyLedger();

    // 300秒渡しても 1 tick 上限（90秒）にクランプされる
    const r1 = addSeconds({
      ledger,
      seconds: 300,
      to: now,
      bucket: 'eiken_2:listening',
      solved: 3,
    });
    expect(r1.added).toBe(STEP_CAP_SECONDS);
    expect(r1.ledger.days[key].byGradeSkill['eiken_2:listening']).toBe(90);
    expect(r1.ledger.dirtyDateKeys).toContain(key);

    // 同じ終端時刻 `to: now` は二重加算を拒否する
    const dup = addSeconds({
      ledger: r1.ledger,
      seconds: 15,
      to: now,
      bucket: 'eiken_2:listening',
    });
    expect(dup.added).toBe(0);
    expect(dup.changed).toBe(false);

    // 同期完了マークで dirtyDateKeys が空になる
    ledger = markDatesSynced(r1.ledger, [key]);
    expect(ledger.dirtyDateKeys).toEqual([]);

    // 12時間上限近くでは残り枠だけ加算される
    ledger.days[key].totalActiveSeconds = DAY_CAP_SECONDS - 10;
    const capped = addSeconds({
      ledger,
      seconds: 45,
      to: now + 15_000,
      bucket: 'eiken_2:reading',
    });
    expect(capped.added).toBe(10);
    expect(capped.ledger.days[key].totalActiveSeconds).toBe(DAY_CAP_SECONDS);
  });

  it('recordTick → localStorage 永続化 → summarize / buildStudySummaryDoc の一貫集計が通る', () => {
    const uid = 'student-west-01';
    const t1 = new Date(2026, 10, 20, 19, 0, 0).getTime();

    const a = recordTick({
      uid,
      seconds: 45,
      to: t1,
      chapterId: 'eiken_2_listening_r01_part1',
      solved: 2,
    });
    expect(a).toEqual({ added: 45, bucket: 'eiken_2:listening' });

    const b = recordTick({
      uid,
      seconds: 30,
      to: t1 + 15_000,
      chapterId: 'eiken_2_written_01_short',
      solved: 4,
    });
    expect(b).toEqual({ added: 30, bucket: 'eiken_2:vocab' });

    const summary = summarize(uid, t1 + 15_000);
    expect(summary.todaySeconds).toBe(75);
    expect(summary.weekSeconds).toBe(75);
    expect(summary.todaySolved).toBe(6);
    expect(summary.pendingSyncCount).toBe(1);
    expect(summary.breakdown[0]).toEqual({
      key: 'eiken_2:listening',
      label: '2級 リスニング',
      seconds: 45,
    });

    const ledger = readLedger(uid);
    const week = sumRecentDays(ledger, t1 + 15_000, 7);
    expect(skillTotals(week.byGradeSkill)).toMatchObject({
      listening: 45,
      vocab: 30,
      reading: 0,
    });

    const summaryDoc = buildStudySummaryDoc(uid, ledger, t1 + 15_000);
    expect(summaryDoc.totalActiveSeconds).toBe(75);
    expect(summaryDoc.solvedTotal).toBe(6);
    expect(labelOfBucket('eiken_pre2plus:reading')).toBe('準2級プラス リーディング');
    expect(formatDuration(3900)).toBe('1時間5分');
  });
});
