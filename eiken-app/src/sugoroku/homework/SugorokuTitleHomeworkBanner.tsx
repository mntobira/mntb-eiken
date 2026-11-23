import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flame,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { auth, FIREBASE_CONFIGURED } from '../../firebase';
import { readSolvedMap } from '../../utils/progress';
import { formatDue } from '../../utils/classAssignmentsCore';
import { subscribeJukuMemberships } from '../../utils/classAssignments';
import {
  buildHomeworkTask,
  estimateMinutes,
  pickPrimaryTask,
} from './homeworkCore';
import {
  fetchMyHomeworkAssignments,
  subscribeHomeworkChanges,
} from './homeworkStore';
import { chapterTitleOf, chapterTotals } from './chapterTotals';
import type { SugorokuHomeworkPlan } from '../shared/types';

interface TitleHomeworkSource {
  id: string;
  classId: string;
  className: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  plan: SugorokuHomeworkPlan | null;
}

/**
 * タイトル画面（LaunchScreen）の「はじめる」ボタン直上に表示する「今日の課題」カード。
 * - ログイン済み＆クラスで課題が出ている生徒にだけ表示（一般ユーザー・未ログイン時は一切非表示）
 * - タップするとそのままアプリへ入り、今日の未完了単元の演習画面へ直行できる
 */
export function SugorokuTitleHomeworkBanner({
  onStartChapter,
}: {
  onStartChapter?: (chapterId: string) => void;
}) {
  const [uid, setUid] = useState(() => auth.currentUser?.uid || '');
  const [sources, setSources] = useState<TitleHomeworkSource[]>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const myUid = auth.currentUser?.uid || '';
      if (!alive) return;
      setUid(myUid);
      if (!myUid || !FIREBASE_CONFIGURED) {
        setSources([]);
        return;
      }
      try {
        const list = await fetchMyHomeworkAssignments(myUid);
        if (!alive) return;
        setSources(
          list.map((a) => ({
            id: a.id,
            classId: a.classId,
            className: '',
            title: a.title,
            chapterIds: a.chapterIds,
            dueAt: a.dueAt,
            plan: a.plan,
          })),
        );
      } catch {
        if (alive) setSources([]);
      }
    };

    void load();
    let offAuth: () => void = () => {};
    try {
      offAuth = onAuthStateChanged(auth, () => {
        void load();
      });
    } catch {
      /* ignore in mock env */
    }
    const offJuku = subscribeJukuMemberships(() => void load());
    const offHw = subscribeHomeworkChanges(() => void load());
    return () => {
      alive = false;
      offAuth();
      offJuku();
      offHw();
    };
  }, []);

  const primaryInfo = useMemo(() => {
    if (!uid || sources.length === 0) return null;
    const now = Date.now();
    const totals = chapterTotals();
    const solved = readSolvedMap(uid);
    const built = sources.map((s) =>
      buildHomeworkTask({
        assignment: {
          id: s.id,
          classId: s.classId,
          title: s.title,
          chapterIds: s.chapterIds,
          dueAt: s.dueAt,
        },
        className: s.className,
        plan: s.plan,
        totals,
        solved,
        now,
      }),
    );
    const picked = pickPrimaryTask(built, now);
    if (!picked) return null;
    return {
      task: picked,
      nextTitle: picked.nextChapterId ? chapterTitleOf(picked.nextChapterId) : '',
    };
  }, [uid, sources]);

  if (!primaryInfo) return null;

  const { task, nextTitle } = primaryInfo;
  const complete = task.remaining === 0;
  const quotaDoneToday = !complete && task.todayRemaining === 0 && task.todayDone > 0;
  const minutes = estimateMinutes(
    task.todayRemaining > 0 ? task.todayRemaining : Math.min(5, task.remaining),
  );

  return (
    <div
      className="launch-today-homework"
      data-testid="launch-today-homework"
      data-complete={complete || quotaDoneToday || undefined}
    >
      <div className="launch-today-hw-top">
        <span className="launch-today-hw-kicker">
          <ClipboardList size={13} aria-hidden="true" />
          今日の課題
        </span>

        <div className="launch-today-hw-pills">
          {complete ? (
            <span className="launch-today-hw-badge" data-tone="done">
              <CheckCircle2 size={12} aria-hidden="true" />
              今週クリア
            </span>
          ) : quotaDoneToday ? (
            <span className="launch-today-hw-badge" data-tone="done">
              <Sparkles size={12} aria-hidden="true" />
              本日達成！
            </span>
          ) : (
            <span className="launch-today-hw-badge" data-tone="pace">
              <Flame size={12} aria-hidden="true" />
              今日あと {task.todayRemaining}問（約{minutes}分）
            </span>
          )}
          {task.targetLaps && task.targetLaps >= 2 && (
            <span className="launch-today-hw-badge" data-tone="lap">
              <Repeat size={11} aria-hidden="true" />
              {task.targetLaps}周
            </span>
          )}
        </div>
      </div>

      <p className="launch-today-hw-title">{task.title}</p>

      <div className="launch-today-hw-meta">
        <span>
          進捗 <b>{task.solved}</b>/{task.total}問（{task.percent}%）
        </span>
        {task.dueAt > 0 && <span>・締切 {formatDue(task.dueAt)}</span>}
      </div>

      <div className="launch-today-hw-bar" aria-hidden="true">
        <i style={{ width: `${task.percent}%` }} />
      </div>

      {!complete && onStartChapter && task.nextChapterId && (
        <button
          type="button"
          className="launch-today-hw-cta"
          onClick={() => onStartChapter(task.nextChapterId)}
        >
          <span>
            {quotaDoneToday ? '課題の続きを解く' : '今日の課題をすぐ始める'}
            {nextTitle ? `（${nextTitle}）` : ''}
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
