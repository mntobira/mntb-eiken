import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Trash2, RefreshCw, MessageSquareText, ClipboardList, Info, ChevronDown, Route } from 'lucide-react';
import { type ClassroomDoc } from '../../utils/classroomCore';
import { fetchClassRawProgress, type StudentRawProgress } from '../../utils/classroom';
import {
  createAssignment,
  deleteAssignment,
  fetchAssignments,
  fetchClassReasons,
} from '../../utils/classAssignments';
import {
  computeAssignmentProgress,
  countStatuses,
  formatDue,
  groupReasonsByQuestion,
  isJukuPlan,
  reasonHeading,
  sortAssignments,
  STATUS_LABELS,
  type AnswerReasonDoc,
  type AssignmentDoc,
  type AssignmentStatus,
} from '../../utils/classAssignmentsCore';
import { getChapterCatalog } from '../../data/chapterCatalog';
import { confirmAction } from '../../utils/dialog';
import type { ThemeShape } from './teacherTheme';
import {
  attachPlanToAssignment,
  deleteHomeworkPlan,
  fetchHomeworkPlans,
} from '../../sugoroku/homework/homeworkStore';
import {
  SugorokuHomeworkComposerModal,
  SugorokuPlanBadges,
} from '../../sugoroku/homework/SugorokuHomeworkComposer';
import type { SugorokuHomeworkPlan } from '../../sugoroku/shared/types';

// ===================================================================
// 課題・理由タブ（塾向け・plan == 'juku' のクラスだけ）
// ===================================================================

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  done: 'bg-[#F5FCFA] text-[#2F7C74] border-[#A9E0D8]',
  late: 'bg-[#FAF8F2] text-[#6B7280] border-[#E0E1DD]',
  in_progress: 'bg-[#F4F7FA] text-[#3C5A6E] border-[#D9E4EC]',
  not_started: 'bg-[#FDECEA] text-[#96342B] border-[#F5C6C0]',
};

function StatusChip({ status, children }: { status: AssignmentStatus; children: ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs border ${STATUS_STYLE[status]}`}>{children}</span>;
}

function EmptyCard({ icon: Icon, title, children }: { icon: typeof Info; title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E0E1DD] p-7 text-center">
      <Icon className="w-10 h-10 mx-auto mb-3 text-[#9BA3AE]" />
      <h2 className="text-base font-bold text-[#1B2631] mb-2">{title}</h2>
      <p className="text-sm text-[#4B5563] leading-relaxed">{children}</p>
    </div>
  );
}

export function JukuTab({ activeClass, theme }: { activeClass: ClassroomDoc | null; theme: ThemeShape }) {
  const [view, setView] = useState<'assign' | 'reasons'>('assign');
  const [assignments, setAssignments] = useState<AssignmentDoc[]>([]);
  const [plans, setPlans] = useState<Record<string, SugorokuHomeworkPlan>>({});
  const [students, setStudents] = useState<StudentRawProgress[]>([]);
  const [reasons, setReasons] = useState<AnswerReasonDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState('');

  const juku = isJukuPlan(activeClass?.plan);
  const classId = activeClass?.id || '';
  const catalog = useMemo(() => (activeClass ? getChapterCatalog(activeClass.subject) : []), [activeClass]);
  const totals = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c.totalProblems])), [catalog]);
  const titles = useMemo(() => Object.fromEntries(catalog.map((c) => [c.id, c.title])), [catalog]);
  const names = useMemo(() => Object.fromEntries(students.map((s) => [s.uid, s.displayName])), [students]);

  const load = useCallback(async () => {
    if (!classId || !juku) return;
    setLoading(true);
    setError('');
    try {
      const [list, rows, rs, planMap] = await Promise.all([
        fetchAssignments(classId),
        fetchClassRawProgress(classId),
        fetchClassReasons(classId).catch(() => [] as AnswerReasonDoc[]),
        fetchHomeworkPlans(classId),
      ]);
      setAssignments(sortAssignments(list));
      setStudents(rows);
      setReasons(rs);
      setPlans(planMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [classId, juku]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeClass) return null;

  if (!juku) {
    return (
      <div data-testid="juku-locked">
        <EmptyCard icon={Info} title="課題の配信・選んだ理由は、塾向けのクラスで使えます">
          いまは試験導入中の塾のクラスだけで使えるようにしています。
          <br />
          生徒の学習機能（問題・音声・復習・対戦）は、どのクラスでもそのまま無料で使えます。
        </EmptyCard>
      </div>
    );
  }

  const handleDelete = async (a: AssignmentDoc) => {
    if (!confirmAction(`課題「${a.title}」を消します。生徒の画面からも消えます。よろしいですか？`)) return;
    try {
      await deleteAssignment(a.id);
      await deleteHomeworkPlan(a.id, classId);
      setAssignments((prev) => prev.filter((r) => r.id !== a.id));
      setPlans((prev) => {
        const next = { ...prev };
        delete next[a.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '課題の削除に失敗しました。');
    }
  };

  const groups = groupReasonsByQuestion(reasons);

  return (
    <div className="space-y-4" data-testid="juku-tab">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 bg-[#F1EFE9] rounded-xl" role="group" aria-label="表示の切り替え">
          {([
            { id: 'assign' as const, label: `宿題・ペース管理（${assignments.length}）` },
            { id: 'reasons' as const, label: `選んだ理由（${reasons.length}）` },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={`min-h-[44px] px-3 sm:px-4 rounded-lg text-sm transition-colors ${
                view === item.id ? 'bg-white font-bold text-[#1B2631] shadow-sm' : 'text-[#4B5563]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm border border-[#E0E1DD] bg-white text-[#4B5563] hover:bg-[#FAF8F2] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
        {view === 'assign' && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white transition-transform active:scale-95"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4" />
            <Route className="w-4 h-4" />
            宿題・12週ルートを出す
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          onClick={() => setNotice('')}
          className="p-3 rounded-xl bg-[#EEF6FC] border border-[#C6DCF0] text-xs font-bold text-[#2458A6] leading-relaxed cursor-pointer"
        >
          {notice}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-[#FDECEA] border border-[#F5C6C0] text-sm text-[#96342B] leading-relaxed">{error}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-[#6B7280]">読み込んでいます…</div>
      ) : view === 'assign' ? (
        assignments.length === 0 ? (
          <EmptyCard icon={ClipboardList} title="まだ宿題は配信されていません">
            「宿題・12週ルートを出す」から『英検2級3か月標準ルート』または任意の単元と1日推奨問数を選ぶと、生徒のホーム画面最上部にピン留め表示されます。
          </EmptyCard>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const plan = plans[a.id] || null;
              const targetStudents =
                plan?.targetStudentUids && plan.targetStudentUids.length > 0
                  ? students.filter((s) => plan.targetStudentUids!.includes(s.uid))
                  : students;
              const rows = targetStudents.map((s) => ({ s, p: computeAssignmentProgress(a, s.solved, totals) }));
              const counts = countStatuses(rows.map((r) => r.p));
              const opened = openId === a.id;
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-[#E0E1DD] p-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#6B7280]">締切 {formatDue(a.dueAt)}</p>
                      <p className="text-base font-bold text-[#1B2631] truncate">{a.title}</p>
                      <p className="text-xs text-[#6B7280] truncate">{a.chapterIds.map((id) => titles[id] || id).join('、')}</p>
                      <SugorokuPlanBadges plan={plan} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(a)}
                      aria-label={`課題「${a.title}」を消す`}
                      className="shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E0E1DD] text-[#6B7280] hover:bg-[#FAF8F2] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(Object.keys(STATUS_LABELS) as AssignmentStatus[]).map((k) => (
                      <span key={k}>
                        <StatusChip status={k}>{`${STATUS_LABELS[k]} ${counts[k]}`}</StatusChip>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(opened ? '' : a.id)}
                    aria-expanded={opened}
                    className="mt-2 flex min-h-[44px] items-center gap-1 text-xs font-bold text-[#4B5563]"
                  >
                    生徒ごとに見る
                    <ChevronDown className={`w-4 h-4 transition-transform ${opened ? 'rotate-180' : ''}`} />
                  </button>
                  {opened && (
                    <div className="border-t border-[#F1EFE9] pt-2 space-y-1.5">
                      {rows.length === 0 && <p className="text-xs text-[#6B7280]">対象生徒がいません。</p>}
                      {rows.map(({ s, p }) => (
                        <div key={s.uid} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate text-[#1B2631]">{s.displayName}</span>
                          <span className="text-xs text-[#6B7280]">{p.solved}/{p.total}問</span>
                          <StatusChip status={p.status}>{STATUS_LABELS[p.status]}</StatusChip>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : groups.length === 0 ? (
        <EmptyCard icon={MessageSquareText} title="まだ届いていません">
          生徒が解説画面で「この答えを選んだ理由を先生に送る」から送ると、ここに問題ごとに並びます。
        </EmptyCard>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3.5 rounded-xl bg-[#F4F7FA] border border-[#D9E4EC] text-xs text-[#3C5A6E] leading-relaxed">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>生徒が自分で「先生に送る」を押した理由だけが並びます。生徒はいつでも取り消せます。</span>
          </div>
          {groups.map((g) => (
            <div key={`${g.chapterId}::${g.questionId}`} className="bg-white rounded-2xl border border-[#E0E1DD] p-4">
              <p className="text-xs text-[#6B7280] truncate">{titles[g.chapterId] || g.chapterId}</p>
              <p className="text-base font-bold text-[#1B2631] mb-2">
                {reasonHeading(g)}
                <span className="ml-1.5 text-xs font-normal text-[#6B7280]">{g.rows.length}件</span>
              </p>
              <div className="space-y-2">
                {g.rows.map((r) => (
                  <div key={r.uid} className="rounded-xl bg-[#FAF8F2] border border-[#E0E1DD] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#1B2631] mb-1">
                      {names[r.uid] || '（退出した生徒）'}
                      {typeof r.correct === 'boolean' && (
                        <StatusChip status={r.correct ? 'done' : 'not_started'}>{r.correct ? '正解' : '不正解'}</StatusChip>
                      )}
                    </p>
                    <p className="text-sm text-[#4B5563] leading-relaxed whitespace-pre-wrap break-words">{r.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <SugorokuHomeworkComposerModal
          subject={activeClass.subject}
          catalog={catalog}
          students={students}
          accent={theme.accent}
          onClose={() => setShowCreate(false)}
          onSubmit={async (payload) => {
            const created = await createAssignment(classId, {
              title: payload.title,
              chapterIds: payload.chapterIds,
              dueDate: payload.dueDate,
            });
            const planRes = await attachPlanToAssignment(created, {
              dailyQuotaProblems: payload.dailyQuotaProblems,
              skillBreakdown: payload.skillBreakdown,
              targetStudentUids: payload.targetStudentUids,
              presetId: payload.presetId,
              presetWeek: payload.presetWeek,
              startAt: payload.startAt,
            });
            const refreshedPlans = await fetchHomeworkPlans(classId);
            setPlans(refreshedPlans);
            setAssignments((prev) => sortAssignments([...prev, created]));
            setNotice(
              planRes.warning ||
                `宿題「${created.title}」を配信しました（生徒のホーム最上部に1日${payload.dailyQuotaProblems || 5}問ペースで表示されます）。`,
            );
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
