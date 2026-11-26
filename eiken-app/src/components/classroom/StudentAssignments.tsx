import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardList,
  Flame,
  MessageCircle,
  Play,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { auth } from '../../firebase';
import { fetchAssignments } from '../../utils/classAssignments';
import { formatDue, type AssignmentDoc } from '../../utils/classAssignmentsCore';
import { readSolvedMap } from '../../utils/progress';
import type { MembershipDetail } from '../../utils/classroom';
import { subjectOfChapterId } from '../../data/subjects';
import {
  buildHomeworkTask,
  estimateMinutes,
  sortHomeworkTasks,
} from '../../sugoroku/homework/homeworkCore';
import {
  fetchHomeworkPlans,
  subscribeHomeworkChanges,
} from '../../sugoroku/homework/homeworkStore';
import {
  chapterTitleOf,
  chapterTotals,
} from '../../sugoroku/homework/chapterTotals';
import type { SugorokuHomeworkPlan } from '../../sugoroku/shared/types';

/**
 * 生徒側：クラス画面（設定 ＞ クラス）で見る「今日の課題・今週の課題」カード群。
 *   - 先生が配信した課題（class_assignments ＋ sugoroku_homework_plans ＋ サブコレクション assignments）を統合表示
 *   - 「今日あと○問（目安○分）」「目標○周」「全○問中の完了率バー」「先生からの指示メモ」を一目で可視化
 *   - 「今日の分を解く」ボタンで未完了単元へワンタップ直行（全級横断の課題でも対象級を自動解決）
 */
export function StudentAssignments({
  membership,
  onStartChapter,
  onOpenChat,
}: {
  membership: MembershipDetail;
  onStartChapter?: (chapterId: string, subject: MembershipDetail['subject']) => void;
  /** この課題について先生に1対1質問・相談トークを開く */
  onOpenChat?: () => void;
}) {
  const [items, setItems] = useState<Array<{ doc: AssignmentDoc; plan: SugorokuHomeworkPlan | null }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const myUid = auth.currentUser?.uid || '';

    const loadAll = async () => {
      try {
        const [legacyList, plansMap] = await Promise.all([
          fetchAssignments(membership.classId).catch(() => [] as AssignmentDoc[]),
          fetchHomeworkPlans(membership.classId).catch(() => ({} as Record<string, SugorokuHomeworkPlan>)),
        ]);
        if (!alive) return;

        const merged = new Map<string, { doc: AssignmentDoc; plan: SugorokuHomeworkPlan | null }>();
        for (const a of legacyList) {
          const p = plansMap[a.id] ?? null;
          if (
            p?.targetStudentUids &&
            p.targetStudentUids.length > 0 &&
            myUid &&
            !p.targetStudentUids.includes(myUid)
          ) {
            continue;
          }
          merged.set(a.id, { doc: a, plan: p });
        }

        for (const p of Object.values(plansMap)) {
          if (merged.has(p.id) || p.chapterIds.length === 0 || !p.dueAt) continue;
          if (
            p.targetStudentUids &&
            p.targetStudentUids.length > 0 &&
            myUid &&
            !p.targetStudentUids.includes(myUid)
          ) {
            continue;
          }
          merged.set(p.id, {
            doc: {
              id: p.id,
              classId: membership.classId,
              teacherUid: p.teacherUid || membership.teacherUid,
              title: p.title,
              chapterIds: p.chapterIds,
              dueAt: p.dueAt,
            },
            plan: p,
          });
        }

        setItems([...merged.values()]);
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoaded(true);
      }
    };

    void loadAll();
    const off = subscribeHomeworkChanges(() => {
      setTick((n) => n + 1);
      void loadAll();
    });
    return () => {
      alive = false;
      off();
    };
  }, [membership.classId, membership.teacherUid]);

  const totals = useMemo(() => chapterTotals(), []);
  const solved = useMemo(() => readSolvedMap(auth.currentUser?.uid), [tick, items.length]);
  const now = Date.now();

  const tasks = useMemo(() => {
    const built = items.map(({ doc, plan }) =>
      buildHomeworkTask({
        assignment: doc,
        className: membership.className,
        plan,
        totals,
        solved,
        now,
      }),
    );
    return sortHomeworkTasks(built, now);
  }, [items, membership.className, totals, solved, now]);

  if (!loaded) return <p className="mt-2 text-xs text-gray-400">今日の課題を読み込んでいます…</p>;
  if (failed) return <p className="mt-2 text-xs text-gray-400">課題を読み込めませんでした。</p>;

  return (
    <div className="mt-2.5 border-t border-gray-200 pt-2.5 space-y-2" data-testid="student-assignments">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#1C4687]">
          <ClipboardList size={14} />
          今日の課題・今週の宿題
        </p>
        {tasks.length > 0 && (
          <span className="text-[11px] font-bold text-[#5A6573]">
            全{tasks.length}件
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-gray-500 py-1">いま出ている課題はありません。</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const finished = t.remaining === 0;
            const quotaClearedToday = !finished && t.todayRemaining === 0 && t.todayDone > 0;
            const estMin = estimateMinutes(
              t.todayRemaining > 0 ? t.todayRemaining : Math.min(5, t.remaining),
            );
            const nextTitle = t.nextChapterId ? chapterTitleOf(t.nextChapterId) : '';
            const targetSubject =
              (t.nextChapterId ? subjectOfChapterId(t.nextChapterId) : null) || membership.subject;

            return (
              <li
                key={t.assignmentId}
                className={`rounded-2xl border p-3 space-y-2 shadow-xs ${
                  finished || quotaClearedToday
                    ? 'bg-[#F6FBF8] border-[#BFE0CF]'
                    : t.overdue
                      ? 'bg-[#FFF9F2] border-[#F0CFA4]'
                      : 'bg-white border-[#D6E2F0]'
                }`}
              >
                {/* 上段：ステータスバッジ ＋ 締切 */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {t.isPersonalized && (
                      <span
                        data-testid="student-assignment-personalized"
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-extrabold"
                      >
                        あなたへの個別課題
                      </span>
                    )}
                    {finished ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#1F7A4D] text-[11px] font-extrabold">
                        <Check size={11} />
                        全問クリア
                      </span>
                    ) : quotaClearedToday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#1F7A4D] text-[11px] font-extrabold">
                        <Sparkles size={11} />
                        今日のノルマ達成！
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FDF0DB] border border-[#F2D4A7] text-[#8A4B00] text-[11px] font-extrabold">
                        <Flame size={11} className="text-[#D97E06]" />
                        今日あと {t.todayRemaining}問（目安{estMin}分）
                      </span>
                    )}

                    {t.targetLaps && t.targetLaps >= 2 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#2458A6] text-[11px] font-extrabold">
                        <Repeat size={11} />
                        目標 {t.targetLaps}周
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-bold ${
                      t.overdue && !finished ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    締切 {formatDue(t.dueAt)}
                  </span>
                </div>

                {/* タイトル＆進捗バー */}
                <div>
                  <p className="text-sm font-extrabold text-[#1C2A39] leading-snug">
                    {t.title}
                  </p>
                  <div className="flex items-center justify-between text-xs font-bold text-[#3E4C5B] mt-1">
                    <span>
                      進捗 <strong className="text-[#1C2A39]">{t.solved}</strong> / {t.total}問（{t.percent}%）
                    </span>
                    {!finished && (
                      <span>1日目安 {t.todayQuota}問ペース</span>
                    )}
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-[#E6ECF2] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        finished || quotaClearedToday ? 'bg-[#1F7A4D]' : 'bg-[#2458A6]'
                      }`}
                      style={{ width: `${t.percent}%` }}
                    />
                  </div>
                </div>

                {/* 単元一覧 */}
                <p className="text-[11px] text-gray-500 leading-snug">
                  範囲：{t.chapterIds.map((id) => chapterTitleOf(id)).join(' ／ ')}
                </p>

                {/* 先生からの一言メモ */}
                {t.coachInstruction && (
                  <p className="rounded-xl bg-[#FFF8E8] border border-[#F2DFB6] px-2.5 py-1.5 text-xs font-bold text-[#7A4B00] leading-snug">
                    先生メモ：{t.coachInstruction}
                  </p>
                )}

                {/* ワンタップ開始ボタン ＋ 先生に質問ボタン */}
                {((!finished && onStartChapter && t.nextChapterId) || onOpenChat) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!finished && onStartChapter && t.nextChapterId && (
                      <button
                        type="button"
                        onClick={() =>
                          onStartChapter(
                            t.nextChapterId,
                            targetSubject as MembershipDetail['subject'],
                          )
                        }
                        className="flex-1 min-w-[180px] flex min-h-[44px] items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#2458A6] hover:bg-[#1C4687] text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Play size={14} />
                          {quotaClearedToday ? '続けて次の問題を解く' : '今日の課題を今すぐ解く'}
                        </span>
                        {nextTitle && (
                          <span className="text-[11px] font-semibold text-blue-100 truncate max-w-[44%]">
                            {nextTitle}
                          </span>
                        )}
                      </button>
                    )}

                    {onOpenChat && (
                      <button
                        type="button"
                        onClick={onOpenChat}
                        className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-xl border border-[#BBE5CD] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#047857] text-xs font-extrabold cursor-pointer shrink-0"
                      >
                        <MessageCircle size={14} />
                        {finished ? '完了報告・相談' : '先生に質問'}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
