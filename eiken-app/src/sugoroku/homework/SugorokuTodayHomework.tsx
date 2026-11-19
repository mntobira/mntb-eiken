/**
 * ===================================================================
 * 生徒ホーム最上部「今日の宿題」カード
 * ===================================================================
 *
 * ■ この画面が解く課題（すごろく様の要望）
 *   「運動部で自発的に勉強しない生徒が、1日まとめ解きや直前放置をしないよう、
 *     アプリを開いた最初のトップ画面に宿題を出したい」
 *
 * ■ 設計の要点
 *   1. 塾クラス（plan === 'juku'）に参加している生徒にだけ出す。
 *      一般ユーザーのホームは1ピクセルも変えない（AI 2 の禁止事項）。
 *   2. 通信は「クラス数 × 2」だけ。開くたびに生徒一覧を読むようなことはしない。
 *   3. 読めなかった場合は静かに消える。宿題が出せないことで
 *      学習そのものを止めない（既存の ClassPanel と同じ姿勢）。
 *   4. 「今すぐ解く」は未完了の先頭の章へ1タップで飛ぶ。
 *
 * ■ 再計算の考え方
 *   solved 台帳（localStorage）は他の画面が随時書き換える。
 *   表示は「1分ごと」と「宿題の読み込み直後」に作り直す。
 *   宿題そのもの（課題・プラン）は滅多に変わらないので、通信は読み込み時だけ。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Flame, Timer } from 'lucide-react';
import { auth } from '../../firebase';
import { readSolvedMap } from '../../utils/progress';
import { loadJukuMemberships, subscribeJukuMemberships } from '../../utils/classAssignments';
import { fetchMyHomeworkAssignments } from './homeworkStore';
import { buildHomeworkTask, estimateMinutes, pickPrimaryTask, sortHomeworkTasks } from './homeworkCore';
import { chapterTitleOf, chapterTotals } from './chapterTotals';
import type { SugorokuHomeworkPlan, SugorokuHomeworkTask } from '../shared/types';
import './homework.css';

/** 残り問数を作り直す間隔（ms）。開きっぱなしでも日付・残数が古くならないように。 */
const REFRESH_MS = 60_000;

/** 通信で取ってきた「変わりにくい」部分 */
interface HomeworkSource {
  id: string;
  classId: string;
  className: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  plan: SugorokuHomeworkPlan | null;
}

function formatDueLabel(dueAt: number, now: number): string {
  if (!Number.isFinite(dueAt) || dueAt <= 0) return '';
  const d = new Date(dueAt);
  const w = '日月火水木金土'[d.getDay()];
  const base = `${d.getMonth() + 1}/${d.getDate()}（${w}）`;
  return dueAt < now ? `${base} 締切を過ぎています` : `${base} まで`;
}

export function SugorokuTodayHomework({
  onStartChapter,
}: {
  /** 未完了の単元を開く（App 側で級を切り替えてから演習へ） */
  onStartChapter?: (chapterId: string) => void;
}) {
  const [uid, setUid] = useState(auth.currentUser?.uid || '');
  const [sources, setSources] = useState<HomeworkSource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async () => {
    const me = auth.currentUser;
    const myUid = me?.uid || '';
    setUid(myUid);
    if (!myUid) {
      setSources([]);
      setLoaded(true);
      return;
    }
    // 塾クラスに入っていない生徒には通信しない（一般ユーザーの負担を増やさない）
    const memberships = loadJukuMemberships(myUid);
    if (memberships.length === 0) {
      setSources([]);
      setLoaded(true);
      return;
    }
    try {
      const list = await fetchMyHomeworkAssignments(myUid);
      const classNameOf = (classId: string) => memberships.find((m) => m.classId === classId)?.className || '';
      setSources(list.map((assignment) => ({
        id: assignment.id,
        classId: assignment.classId,
        className: classNameOf(assignment.classId),
        title: assignment.title,
        chapterIds: assignment.chapterIds,
        dueAt: assignment.dueAt,
        plan: assignment.plan,
      })));
    } catch (error) {
      // 読めないときはカードを出さない（学習は止めない）
      console.warn('[sugoroku/homework] 宿題を読み込めませんでした', error);
      setSources([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  // 参加・退出・ログイン切替で読み直す
  useEffect(() => {
    void load();
    const off = subscribeJukuMemberships(() => {
      void load();
    });
    return off;
  }, [load]);

  // 日付が変わった・残り問数が変わったときに表示を追随させる
  useEffect(() => {
    const id = window.setInterval(() => setRevision((n) => n + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const tasks: Array<{ task: SugorokuHomeworkTask; nextTitle: string }> = useMemo(() => {
    if (sources.length === 0) return [];
    const now = Date.now();
    const totals = chapterTotals();
    // solved 台帳は他の画面が書き換えるので、作り直すたびに読み直す
    const solved = readSolvedMap(uid);
    return sources.map((source) => {
      const task = buildHomeworkTask({
        assignment: {
          id: source.id,
          classId: source.classId,
          title: source.title,
          chapterIds: source.chapterIds,
          dueAt: source.dueAt,
        },
        className: source.className,
        plan: source.plan,
        totals,
        solved,
        now,
      });
      return { task, nextTitle: chapterTitleOf(task.nextChapterId) };
    });
  }, [sources, uid, revision]);

  if (!loaded || !uid || tasks.length === 0) return null;

  const now = Date.now();
  const primaryRow = pickPrimaryTask(tasks.map((r) => r.task), now)
    ? tasks.find((r) => r.task.assignmentId === pickPrimaryTask(tasks.map((r) => r.task), now)?.assignmentId)
    : undefined;
  if (!primaryRow) return null;

  const primary = primaryRow.task;
  const others = sortHomeworkTasks(
    tasks.map((r) => r.task).filter((t) => t.assignmentId !== primary.assignmentId),
    now,
  );
  const complete = primary.remaining === 0;
  const minutes = estimateMinutes(primary.todayRemaining);
  const dueLabel = formatDueLabel(primary.dueAt, now);

  return (
    <section
      className="sgr-homework"
      aria-label="今日の宿題"
      data-testid="sugoroku-today-homework"
      data-status={primary.status}
    >
      <div className="sgr-homework-head">
        <p className="sgr-homework-eyebrow">
          <ClipboardList size={14} aria-hidden="true" />
          {primary.className ? `${primary.className}の宿題` : '今日の宿題'}
        </p>
        {primary.overdue && (
          <span className="sgr-homework-flag" role="status">
            <AlertTriangle size={12} aria-hidden="true" /> 締切を過ぎています
          </span>
        )}
      </div>

      <h2 className="sgr-homework-title">{primary.title}</h2>

      <div
        className="sgr-homework-bar"
        role="progressbar"
        aria-label="宿題の進み具合"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={primary.percent}
      >
        <i style={{ width: `${primary.percent}%` }} />
      </div>

      <p className="sgr-homework-count">
        <strong>{primary.solved}</strong> / {primary.total} 問
        <span className="sgr-homework-sep" aria-hidden="true">・</span>
        {complete ? (
          <span className="sgr-homework-done">
            <CheckCircle2 size={13} aria-hidden="true" /> 完了
          </span>
        ) : (
          <>
            のこり <strong>{primary.remaining}</strong> 問
          </>
        )}
        {!complete && primary.todayRemaining > 0 && (
          <>
            <span className="sgr-homework-sep" aria-hidden="true">・</span>
            <span className="sgr-homework-today">
              <Flame size={13} aria-hidden="true" /> 今日あと {primary.todayRemaining} 問
            </span>
          </>
        )}
      </p>

      <p className="sgr-homework-meta">
        <Timer size={13} aria-hidden="true" />
        {complete ? 'この宿題はおしまい。おつかれさま！' : `目安 ${minutes}分`}
        {dueLabel && <> ／ {dueLabel}</>}
      </p>

      <p className="sgr-homework-msg">{primary.message}</p>

      {!complete && (
        <button
          type="button"
          className="sgr-homework-start"
          onClick={() => {
            if (primary.nextChapterId && onStartChapter) onStartChapter(primary.nextChapterId);
          }}
        >
          今すぐ解く
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      {others.length > 0 && (
        <ul className="sgr-homework-more" aria-label="ほかの宿題">
          {others.slice(0, 3).map((t) => (
            <li key={t.assignmentId}>
              <button
                type="button"
                onClick={() => {
                  if (t.nextChapterId && onStartChapter) onStartChapter(t.nextChapterId);
                }}
                disabled={t.remaining === 0 || !onStartChapter}
              >
                <span className="sgr-homework-more-title">{t.title}</span>
                <span className="sgr-homework-more-count">
                  {t.remaining === 0 ? '完了' : `のこり ${t.remaining} 問`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
