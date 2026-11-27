/**
 * ===================================================================
 * 生徒ホーム最上部「今日の宿題」ピン留めカード（マナトビ純正 UI/UX 対応）
 * ===================================================================
 *
 * ■ この画面が解く課題（すごろく様の要望）
 *   「運動部で自発的に勉強しない生徒が、1日まとめ解きや直前放置をしないよう、
 *     アプリを開いた最初のトップ画面の最上部に今日の宿題を出したい」
 *
 * ■ 厳守事項（AI 2 禁止事項＆品質基準）
 *   1. 塾クラス（plan === 'juku'）に参加している生徒にだけ表示する。
 *      未参加の一般ユーザーのホーム画面は 1px も変更しない（通信もゼロ）。
 *   2. マナトビ純正デザインシステム（KineticText / ScoreRing / CountUp /
 *      .mt-progress 光沢シャインバー / タップ44px以上 / 横はみ出しゼロ）を採用。
 *   3. 今週の分野別アクティブ学習時間（2級リスニング ○分・語彙 ○分 等）も
 *      その場でセルフ確認でき、生徒のスクリーンショット送信作業を完全に不要にする。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Flame,
  Headphones,
  MessageCircle,
  RefreshCw,
  Repeat,
  Sparkles,
  Timer,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import { KineticText, ScoreRing } from '../../motion';
import { CountUp } from '../../components/ui/CountUp';
import { readSolvedMap } from '../../utils/progress';
import { loadJukuMemberships, subscribeJukuMemberships } from '../../utils/classAssignments';
import { fetchMyHomeworkAssignments, subscribeHomeworkChanges } from './homeworkStore';
import {
  buildHomeworkTask,
  estimateMinutes,
  pickPrimaryTask,
  sortHomeworkTasks,
} from './homeworkCore';
import { chapterTitleOf, chapterTotals, isValidEikenChapterId } from './chapterTotals';
import { formatDuration } from '../timelog/timelogCore';
import { subscribeTimelogChanges, summarize } from '../timelog/timelogStore';
import { ClassChatModal, subscribeUserChatInbox } from '../chat';
import type { SugorokuHomeworkPlan, SugorokuHomeworkTask } from '../shared/types';
import './homework.css';

/** 日付変更や経過時間を追随させる定期リフレッシュ間隔（60秒） */
const REFRESH_MS = 60_000;

interface HomeworkSource {
  id: string;
  classId: string;
  className: string;
  title: string;
  chapterIds: string[];
  dueAt: number;
  plan: SugorokuHomeworkPlan | null;
}

function formatDueLabel(dueAt: number, daysLeft: number, now: number): string {
  if (!Number.isFinite(dueAt) || dueAt <= 0) return '';
  const d = new Date(dueAt);
  const w = '日月火水木金土'[d.getDay()];
  const base = `${d.getMonth() + 1}/${d.getDate()}(${w})`;
  if (dueAt < now) return `${base} 締切超過`;
  if (daysLeft === 1) return `今日 ${base} 締切`;
  return `${base}まで（残り${daysLeft}日）`;
}

export function SugorokuTodayHomework({
  onStartChapter,
}: {
  /** 未完了の先頭単元へワンタップ直行 */
  onStartChapter?: (chapterId: string) => void;
}) {
  const [uid, setUid] = useState(auth.currentUser?.uid || '');
  const [hasJukuMembership, setHasJukuMembership] = useState<boolean>(() => {
    const u = auth.currentUser?.uid || '';
    return u ? loadJukuMemberships(u).length > 0 : false;
  });
  const [sources, setSources] = useState<HomeworkSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [toastText, setToastText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnreadByClass, setChatUnreadByClass] = useState<Record<string, number>>({});

  const load = useCallback(async (silent = false) => {
    const me = auth.currentUser;
    const myUid = me?.uid || '';
    setUid(myUid);
    if (!myUid) {
      setHasJukuMembership(false);
      setSources([]);
      setLoaded(true);
      return;
    }
    const memberships = loadJukuMemberships(myUid);
    if (memberships.length === 0) {
      setHasJukuMembership(false);
      setSources([]);
      setLoaded(true);
      return;
    }
    setHasJukuMembership(true);
    if (!silent) setLoading(true);
    try {
      const list = await fetchMyHomeworkAssignments(myUid);
      const classNameOf = (classId: string) =>
        memberships.find((m) => m.classId === classId)?.className || '';
      setSources(
        list.map((assignment) => ({
          id: assignment.id,
          classId: assignment.classId,
          className: classNameOf(assignment.classId),
          title: assignment.title,
          chapterIds: assignment.chapterIds,
          dueAt: assignment.dueAt,
          plan: assignment.plan,
        })),
      );
    } catch (error) {
      console.warn('[sugoroku/homework] 宿題を読み込めませんでした', error);
      setSources([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  // Auth状態変化・塾クラス参加変化・講師による宿題追加をすべて購読
  useEffect(() => {
    void load();
    let offAuth: () => void = () => {};
    try {
      offAuth = onAuthStateChanged(auth, () => {
        void load(true);
      });
    } catch {
      /* テスト環境等で auth モックが簡易な場合でも安全に続行 */
    }
    const offJuku = subscribeJukuMemberships(() => {
      void load(true);
    });
    const offHw = subscribeHomeworkChanges(() => {
      void load(true);
    });
    const offTimelog = subscribeTimelogChanges(() => {
      setRevision((n) => n + 1);
    });
    return () => {
      offAuth();
      offJuku();
      offHw();
      offTimelog();
    };
  }, [load]);

  // 1分ごとの自動再評価＋画面復帰時の再評価
  useEffect(() => {
    const id = window.setInterval(() => setRevision((n) => n + 1), REFRESH_MS);
    const onFocus = () => setRevision((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(''), 2400);
    return () => window.clearTimeout(t);
  }, [toastText]);

  // 塾クラス参加生徒のみ、先生からの新着トーク未読バッジを購読
  useEffect(() => {
    if (!uid || !hasJukuMembership) {
      setChatUnreadByClass({});
      return;
    }
    return subscribeUserChatInbox({
      uid,
      onSummary: (summary) => {
        const next: Record<string, number> = {};
        Object.entries(summary.studentThreadsByClassId).forEach(([cid, t]) => {
          next[cid] = Math.max(0, t.unreadByStudent || 0);
        });
        setChatUnreadByClass(next);
      },
    });
  }, [uid, hasJukuMembership]);

  const tasks: Array<{ task: SugorokuHomeworkTask; nextTitle: string }> = useMemo(() => {
    if (sources.length === 0) return [];
    const now = Date.now();
    const totals = chapterTotals();
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

  const timelogSummary = useMemo(() => {
    if (!uid || !hasJukuMembership) return null;
    return summarize(uid, Date.now());
  }, [uid, hasJukuMembership, revision]);

  // 塾クラス未参加なら何も描かない（一般ユーザーのホーム画面完全保護）
  if (!uid || !hasJukuMembership) return null;

  // 初回ロード中スケルトン（CLS防止・塾生のみ）
  if (!loaded && loading) {
    return (
      <section className="sgr-homework sgr-homework-skeleton" aria-label="宿題を読み込み中">
        <div className="mt-skeleton-row">
          <i className="mt-skeleton-dot" />
          <span>
            <i style={{ width: '48%' }} />
            <i style={{ width: '82%' }} />
          </span>
        </div>
      </section>
    );
  }

  if (tasks.length === 0) return null;

  const now = Date.now();
  const pickedTask = pickPrimaryTask(
    tasks.map((r) => r.task),
    now,
  );
  const primaryRow = pickedTask
    ? tasks.find((r) => r.task.assignmentId === pickedTask.assignmentId)
    : undefined;
  if (!primaryRow) return null;

  const primary = primaryRow.task;
  const others = sortHomeworkTasks(
    tasks.map((r) => r.task).filter((t) => t.assignmentId !== primary.assignmentId),
    now,
  );
  const complete = primary.remaining === 0;
  const quotaDoneToday = !complete && primary.todayRemaining === 0 && primary.todayDone > 0;
  const minutes = estimateMinutes(
    primary.todayRemaining > 0 ? primary.todayRemaining : Math.min(5, primary.remaining),
  );
  const dueLabel = formatDueLabel(primary.dueAt, primary.daysLeft, now);
  const ringTone = complete || quotaDoneToday ? 'done' : primary.overdue ? 'warn' : 'brand';
  const breakdown = primary.skillBreakdown || {};
  const jukuMemberships = loadJukuMemberships(uid);
  const chatTarget =
    jukuMemberships.find((m) => m.classId === primary.classId) || jukuMemberships[0] || null;
  const chatUnread = chatTarget ? chatUnreadByClass[chatTarget.classId] || 0 : 0;
  const studentDisplayName = auth.currentUser?.displayName || '生徒';

  const handleRefresh = async () => {
    await load(true);
    setRevision((n) => n + 1);
    setToastText('最新の宿題・学習時間を更新しました');
  };

  return (
    <section
      className="sgr-homework"
      aria-label="今日の宿題"
      data-testid="sugoroku-today-homework"
      data-status={primary.status}
    >
      {/* 上段：クラス名 Kicker ＋ 締切・状態ピル ＋ 再読込 */}
      <div className="sgr-homework-head">
        <p className="sgr-homework-eyebrow">
          <ClipboardList size={14} aria-hidden="true" />
          <span>{primary.className ? `${primary.className}・今日の宿題` : '今日の宿題'}</span>
        </p>

        <div className="sgr-homework-badges">
          {primary.isPersonalized && (
            <span
              className="sgr-homework-flag"
              data-testid="homework-personalized-badge"
              style={{ background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe' }}
            >
              個別課題
            </span>
          )}
          {primary.overdue ? (
            <span className="sgr-homework-flag" data-tone="warn" role="status">
              <AlertTriangle size={12} aria-hidden="true" />
              締切超過
            </span>
          ) : complete ? (
            <span className="sgr-homework-flag" data-tone="done" role="status">
              <CheckCircle2 size={12} aria-hidden="true" />
              全問達成
            </span>
          ) : quotaDoneToday ? (
            <span className="sgr-homework-flag" data-tone="done" role="status">
              <Sparkles size={12} aria-hidden="true" />
              本日クリア
            </span>
          ) : (
            <span className="sgr-homework-flag" data-tone="pace">
              <Flame size={12} aria-hidden="true" />
              今日あと {primary.todayRemaining}問
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            aria-label="宿題の状態を更新"
            className="sgr-homework-refresh"
          >
            <RefreshCw size={13} className={loading ? 'sgr-spin' : undefined} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 中段：ScoreRing 円グラフ ＋ KineticText 見出し ＋ CountUp 進捗数値 */}
      <div className="sgr-homework-main">
        <div className="sgr-homework-ring" aria-hidden="true">
          <ScoreRing rate={primary.percent / 100} size={50} stroke={6} tone={ringTone} />
          <span className="sgr-homework-ring-num">
            <CountUp value={primary.percent} fromZero duration={850} delay={150} />
            <small>%</small>
          </span>
        </div>

        <div className="sgr-homework-info">
          <h2 className="sgr-homework-title">
            <KineticText text={primary.title} max={26} step={24} />
          </h2>

          <p className="sgr-homework-count">
            <strong>
              <CountUp value={primary.solved} fromZero duration={750} delay={120} />
            </strong>
            <span> / {primary.total} 問完了</span>
            {!complete && (
              <>
                <span className="sgr-homework-sep" aria-hidden="true">・</span>
                <span>
                  残り <strong>{primary.remaining}</strong> 問
                </span>
              </>
            )}
          </p>

          <p className="sgr-homework-meta">
            <Timer size={13} aria-hidden="true" />
            <span>
              {complete
                ? '今週のノルマ達成！'
                : quotaDoneToday
                  ? `今日 ${primary.todayDone}問クリア済`
                  : `今日の目安 約${minutes}分（${primary.todayQuota}問/日ペース）`}
            </span>
            {dueLabel && (
              <>
                <span className="sgr-homework-sep" aria-hidden="true">／</span>
                <span>{dueLabel}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* マナトビ共通 光沢シャイン進捗バー (.mt-progress) */}
      <div
        className="mt-progress sgr-homework-bar"
        role="progressbar"
        aria-label="宿題の進み具合"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={primary.percent}
      >
        <i style={{ width: `${primary.percent}%` }} />
      </div>

      {/* 技能別内訳ピル（リーディング・リスニング・語彙・周回数） */}
      {(breakdown.vocab || breakdown.reading || breakdown.listening || (primary.targetLaps && primary.targetLaps >= 2)) && (
        <div className="sgr-homework-skills" aria-label="分野別の問題数">
          {primary.targetLaps && primary.targetLaps >= 2 ? (
            <span className="sgr-skill-chip" style={{ background: '#e6f4ec', borderColor: '#b5dec6', color: '#1f7a4d' }}>
              <Repeat size={12} aria-hidden="true" />
              目標 {primary.targetLaps}周
            </span>
          ) : null}
          {breakdown.vocab ? (
            <span className="sgr-skill-chip">単語・語彙 {breakdown.vocab}問</span>
          ) : null}
          {breakdown.reading ? (
            <span className="sgr-skill-chip">
              <BookOpen size={12} aria-hidden="true" />
              読解 {breakdown.reading}問
            </span>
          ) : null}
          {breakdown.listening ? (
            <span className="sgr-skill-chip">
              <Headphones size={12} aria-hidden="true" />
              リスニング {breakdown.listening}問
            </span>
          ) : null}
        </div>
      )}

      {/* 先生からの一言・やり方メモ */}
      {primary.coachInstruction && (
        <p className="sgr-homework-msg" style={{ background: '#fff8e8', color: '#7a4b00' }}>
          先生メモ：{primary.coachInstruction}
        </p>
      )}

      {/* ペースメーカー声掛けメッセージ（まとめ解き抑制・未着手励まし） */}
      <p className="sgr-homework-msg" data-overpaced={primary.overPacedToday || undefined}>
        {primary.message}
      </p>

      {/* アクションボタン（「今すぐ解く」ワンタップ直行 ＋ 先生に質問・相談トーク） */}
      <div className="sgr-homework-actions">
        {!complete && onStartChapter && primary.nextChapterId && (
          <button
            type="button"
            className="sgr-homework-start"
            onClick={() => onStartChapter(primary.nextChapterId)}
          >
            <span className="sgr-homework-start-main">
              {quotaDoneToday ? 'もう少し進める' : '今日の宿題を今すぐ解く'}
            </span>
            {primaryRow.nextTitle && (
              <small className="sgr-homework-start-sub">次：{primaryRow.nextTitle}</small>
            )}
            <ChevronRight size={18} className="sgr-homework-start-arrow" aria-hidden="true" />
          </button>
        )}

        {chatTarget && (
          <button
            type="button"
            className="sgr-homework-chat-btn"
            data-testid="homework-open-chat-btn"
            onClick={() => setChatOpen(true)}
            aria-label={`先生に質問・相談トークを開く${chatUnread > 0 ? `（未読${chatUnread}件）` : ''}`}
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>{complete ? '先生に完了報告・相談' : '先生に質問・相談'}</span>
            {chatUnread > 0 && (
              <span className="sgr-homework-chat-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
            )}
          </button>
        )}
      </div>

      {/* 今週の有効学習時間ミニストリップ（スクショ報告不要化の実感フィードバック） */}
      {timelogSummary && timelogSummary.weekSeconds > 0 && (
        <div className="sgr-homework-timelog" aria-label="今週の有効学習時間">
          <Clock size={13} aria-hidden="true" />
          <span>
            今日 <strong>{formatDuration(timelogSummary.todaySeconds)}</strong> ／ 今週{' '}
            <strong>{formatDuration(timelogSummary.weekSeconds)}</strong>
          </span>
          {timelogSummary.breakdown[0] && (
            <span className="sgr-homework-timelog-top">
              （{timelogSummary.breakdown[0].label}{' '}
              {formatDuration(timelogSummary.breakdown[0].seconds)}）
            </span>
          )}
        </div>
      )}

      {/* 他に配信されている宿題がある場合の折りたたみリスト（ホーム1画面圧迫防止） */}
      {others.length > 0 && (
        <div className="sgr-homework-more-wrap">
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="sgr-homework-more-toggle"
          >
            <span>ほかの宿題（{others.length}件）</span>
            <ChevronDown
              size={15}
              className={showMore ? 'sgr-rot-180' : undefined}
              aria-hidden="true"
            />
          </button>
          {showMore && (
            <ul className="sgr-homework-more" aria-label="ほかの宿題">
              {others.slice(0, 4).map((t) => (
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
                      {t.remaining === 0 ? '完了' : `残り ${t.remaining}問`}
                    </span>
                    {t.remaining > 0 && <ChevronRight size={14} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {chatOpen && chatTarget && (
        <ClassChatModal
          open={true}
          classId={chatTarget.classId}
          className={chatTarget.className}
          teacherUid={chatTarget.teacherUid}
          studentUid={uid}
          studentName={studentDisplayName}
          viewerRole="student"
          viewerName={studentDisplayName}
          defaultGrade={chatTarget.subject}
          onStartChapter={
            onStartChapter
              ? (chapterId) => {
                  if (!isValidEikenChapterId(chapterId)) return;
                  setChatOpen(false);
                  onStartChapter(chapterId);
                }
              : undefined
          }
          onClose={() => setChatOpen(false)}
        />
      )}

      {toastText && (
        <div className="mt-toast app-toast" role="status" onClick={() => setToastText('')}>
          {toastText}
        </div>
      )}
    </section>
  );
}
