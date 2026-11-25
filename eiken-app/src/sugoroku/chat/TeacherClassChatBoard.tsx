/**
 * ============================================================================
 * 先生・管理者用：LINE公式アカウント風 生徒トーク管理ボード（スマホ1カラム切替 ⇄ PC 2ペイン）
 * ============================================================================
 *
 * ■ 特徴
 * - 左ペイン（スマホでは一覧画面）：
 *   1) 「すべて / 未読あり / 相談中 / 要フォロー生徒」ワンタップ絞り込み＋生徒名・本文検索
 *   2) 未読がある生徒 → 相談中（open）の生徒 → 最新メッセージ順 → 停滞アラート順で自動整列
 *   3) 各行にアバター・目標級・相談トピックピル・時刻・最新プレビュー・未読バッジを表示
 * - 右ペイン（スマホではトーク画面にスムーズ切替、「＜」で一覧へ戻る）：
 *   1) LINE本格仕様の `ClassChatView` をフル高さ表示
 *   2) 上部ミニカルテから「＋ この生徒に課題を出す」「詳細カルテを開く」「今週の約束ピン留め」が1タップ完結
 */

import { useMemo, useState } from 'react';
import { Flame, MessageCircle, Search, X } from 'lucide-react';
import { formatDurationJa, getGradeLabel, type SugorokuStudentOverview } from '../admin/adminAnalytics';
import { ClassChatView } from './ClassChatView';
import { CHAT_TOPIC_META, type ClassChatThreadDoc } from './chatTypes';
import './class-chat.css';

type InboxFilter = 'all' | 'unread' | 'open' | 'alert';

interface TeacherClassChatBoardProps {
  classId: string;
  className: string;
  schoolName?: string;
  teacherUid: string;
  teacherName: string;
  students: readonly SugorokuStudentOverview[];
  threadsByUid?: Record<string, ClassChatThreadDoc>;
  selectedStudentUid?: string | null;
  onSelectStudentUid?: (uid: string) => void;
  onIssueHomeworkForStudent: (student: SugorokuStudentOverview) => void;
  onOpenStudentDetail: (studentUid: string) => void;
  isDemoMode?: boolean;
}

function formatListTime(ms: number | undefined): string {
  if (!ms || ms <= 0) return '';
  const d = new Date(ms);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TeacherClassChatBoard({
  classId,
  className,
  schoolName,
  teacherUid,
  teacherName,
  students,
  threadsByUid = {},
  selectedStudentUid = null,
  onSelectStudentUid,
  onIssueHomeworkForStudent,
  onOpenStudentDetail,
  isDemoMode = false,
}: TeacherClassChatBoardProps) {
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [internalSelectedUid, setInternalSelectedUid] = useState<string | null>(selectedStudentUid);
  const effectiveSelectedUid = selectedStudentUid ?? internalSelectedUid;
  const [mobilePane, setMobilePane] = useState<'list' | 'room'>(() =>
    selectedStudentUid ? 'room' : 'list',
  );

  const counts = useMemo(() => {
    let unread = 0;
    let open = 0;
    let alert = 0;
    for (const s of students) {
      const t = threadsByUid[s.uid];
      if ((t?.unreadByTeacher || 0) > 0) unread += 1;
      if (t?.resolutionStatus === 'open') open += 1;
      if (s.alerts.length > 0) alert += 1;
    }
    return { unread, open, alert };
  }, [students, threadsByUid]);

  const sortedFilteredStudents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const filtered = students.filter((s) => {
      const t = threadsByUid[s.uid];
      if (filter === 'unread' && (t?.unreadByTeacher || 0) === 0) return false;
      if (filter === 'open' && t?.resolutionStatus !== 'open') return false;
      if (filter === 'alert' && s.alerts.length === 0) return false;
      if (q) {
        const hay = `${s.rosterName} ${t?.lastMessageText || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const ta = threadsByUid[a.uid];
      const tb = threadsByUid[b.uid];
      const ua = ta?.unreadByTeacher || 0;
      const ub = tb?.unreadByTeacher || 0;
      if ((ua > 0) !== (ub > 0)) return ub > 0 ? 1 : -1;

      const oa = ta?.resolutionStatus === 'open' ? 1 : 0;
      const ob = tb?.resolutionStatus === 'open' ? 1 : 0;
      if (oa !== ob) return ob - oa;

      const ma = ta?.lastMessageAt || 0;
      const mb = tb?.lastMessageAt || 0;
      if (ma !== mb) return mb - ma;

      return b.alerts.length - a.alerts.length;
    });
  }, [students, threadsByUid, filter, keyword]);

  const activeStudent = useMemo(() => {
    if (effectiveSelectedUid) {
      const exact = students.find((s) => s.uid === effectiveSelectedUid);
      if (exact) return exact;
    }
    return sortedFilteredStudents[0] ?? students[0] ?? null;
  }, [students, sortedFilteredStudents, effectiveSelectedUid]);

  const handlePickStudent = (uid: string) => {
    setInternalSelectedUid(uid);
    onSelectStudentUid?.(uid);
    setMobilePane('room');
  };

  return (
    <div
      className="cchat-board"
      data-mobile-pane={mobilePane}
      data-testid="teacher-class-chat-board"
    >
      {/* 左ペイン：LINE公式アカウント風トークルーム一覧 */}
      <div className="cchat-room-list" role="listbox" aria-label="生徒トーク一覧">
        <div className="space-y-2 pb-1 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <strong className="text-sm font-extrabold text-[#1B2631] inline-flex items-center gap-1.5">
              <MessageCircle size={16} className="text-[#06C755]" />
              生徒トーク一覧（{students.length}名）
            </strong>
            {counts.unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#06C755] text-white text-[11px] font-extrabold">
                未読 {counts.unread}名
              </span>
            )}
          </div>

          {/* 生徒名・メッセージ検索 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="生徒名・相談内容で検索"
              aria-label="トーク一覧を検索"
              className="flex-1 min-w-0 bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                aria-label="検索クリア"
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* 4種フィルタピル */}
          <div className="flex flex-wrap gap-1" role="group" aria-label="トーク絞り込み">
            {(
              [
                { id: 'all', label: `すべて (${students.length})` },
                { id: 'unread', label: `未読 (${counts.unread})` },
                { id: 'open', label: `相談中 (${counts.open})` },
                { id: 'alert', label: `学習遅れ (${counts.alert})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#1e293b] text-white border-[#1e293b]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* トークリスト本体 */}
        {sortedFilteredStudents.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400 font-bold">
            該当する生徒のトークがありません
          </p>
        ) : (
          <div className="space-y-1">
            {sortedFilteredStudents.map((st) => {
              const thread = threadsByUid[st.uid];
              const selected = activeStudent?.uid === st.uid;
              const unread = thread?.unreadByTeacher || 0;
              const shortName = st.rosterName.split('（')[0] || st.rosterName;
              const initial = shortName.trim()[0] || '生';
              const topicMeta = thread?.lastTopic ? CHAT_TOPIC_META[thread.lastTopic] : null;
              const isOpen = thread?.resolutionStatus === 'open';

              return (
                <button
                  key={st.uid}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="cchat-room-item"
                  onClick={() => handlePickStudent(st.uid)}
                >
                  <span className="cchat-room-avatar" aria-hidden="true">
                    {initial}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-[13px] font-extrabold text-[#1B2631] truncate">
                          {shortName}
                        </strong>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-extrabold shrink-0">
                          {getGradeLabel(st.targetGrade).replace('英検', '')}
                        </span>
                        {isOpen && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold shrink-0">
                            相談中
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] font-bold text-slate-400 shrink-0">
                        {formatListTime(thread?.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 truncate flex-1">
                        {topicMeta && (
                          <b
                            className="mr-1 text-[10.5px]"
                            style={{ color: topicMeta.fg }}
                          >
                            [{topicMeta.shortLabel}]
                          </b>
                        )}
                        {thread?.lastMessageText
                          ? thread.lastMessageText
                          : st.alerts[0]
                            ? `⚠ ${st.alerts[0].label}（タップして声掛け）`
                            : 'タップして最初のメッセージを送る'}
                      </span>

                      {unread > 0 ? (
                        <span className="cchat-unread-pill">{unread}</span>
                      ) : st.alerts.length > 0 ? (
                        <Flame size={13} className="text-amber-500 shrink-0" aria-label="要フォロー" />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 右ペイン：選択した生徒とのLINEトークルーム */}
      <div className="cchat-room-pane min-w-0">
        {activeStudent && (
          <ClassChatView
            classId={classId}
            className={className}
            schoolName={schoolName}
            teacherUid={teacherUid}
            studentUid={activeStudent.uid}
            studentName={activeStudent.rosterName}
            viewerRole="teacher"
            viewerName={teacherName}
            defaultGrade={activeStudent.targetGrade}
            studentPulse={{
              targetGradeLabel: `目標 ${getGradeLabel(activeStudent.targetGrade)}`,
              weeklyTimeLabel: formatDurationJa(activeStudent.weeklyActiveSeconds),
              homeworkPct: activeStudent.homework.completionRate,
              homeworkCountLabel:
                activeStudent.homework.totalProblems > 0
                  ? `${activeStudent.homework.completedProblems}/${activeStudent.homework.totalProblems}問`
                  : undefined,
            }}
            isDemoMode={isDemoMode}
            onBackToList={() => setMobilePane('list')}
            onIssueHomework={() => onIssueHomeworkForStudent(activeStudent)}
            onOpenStudentDetail={() => onOpenStudentDetail(activeStudent.uid)}
            embedded={true}
          />
        )}
      </div>
    </div>
  );
}
