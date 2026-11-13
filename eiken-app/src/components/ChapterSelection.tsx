import React, { useEffect, useMemo, useRef, useState } from 'react';
// 教科ごとの parts は data/allChapters.ts から引く
// （以前はこのファイルで6教科ぶんを個別に import していた）
import { type SubjectKey } from '../data/allChapters';
import { ChevronRight, ArrowLeft, X, Headphones, PenLine, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DoorMascot } from './DoorMascot';
import { subjectTheme } from '../data/subjectTheme';
import { ListeningAudioPlayer } from './ListeningAudioPlayer';
import type { Chapter } from '../types/curriculum';
import { buildListeningRounds } from '../utils/listeningRounds';
import { TOEIC_DISCLAIMER } from '../data/toeic/toeicPart5Kit';
import { problemKey, readSolvedMap } from '../utils/progress';
// 章 × モードごとの保存キー名は utils/quizStorageKeys.ts が唯一の定義
import {
  quizAnswersKey,
  quizExplKey,
  quizIndexKey,
  quizRunKey,
} from '../utils/quizStorageKeys';
import { auth } from '../firebase';
import { buildUnitSections } from '../data/unitSections';
import { UnitCard } from './UnitCard';
import { ListeningTechniqueCard } from './ListeningTechniqueCard';
import './unit-select.css';
import { accuracyOf, readUnitStats } from '../utils/unitStats';
import { STAGE_CLEAR_PERFECTS, isStageCleared, readStageRecords, stageKey } from '../utils/stageRecords';
import { safeGetItem, safeLocalStorage, safeParseJson } from '../utils/safeLocalStorage';
import { getChapterGroups, getGrammarPartGroups, collectAudioSets, splitTabTitle } from '../utils/chapterGroups';
import type { EikenGrade } from '../eiken/config';
import { EIKEN_UNITS } from '../eiken/questions';
import { bookletWritingTasks, getGradeDaimonSpecs } from '../eiken/writtenPractice';
import { emptyWriting, parseWriting, wordCount, writingKey } from '../eiken/writingProgress';

interface ChapterSelectionProps {
  mode: 'mini_test' | 'practice';
  onSelectChapter: (
    id: string,
    questionIndex?: number,
    resume?: boolean,
    range?: { startIndex: number; endIndex: number } | null,
  ) => void;
  onBack: () => void;
  onChangeSubject?: () => void;
  rememberedGroup?: string;
  onGroupChange?: (group: string) => void;
  backLabel?: string;
  subject?: SubjectKey;
  /** 英検の級別画面から、その級の「一次筆記 通し模試」を直接開く */
  onOpenMock?: () => void;
  /** 英検の級別大問タブ（大問4・5 ライティング）から特定の回・課題を直接開く */
  onOpenWriting?: (taskKey: string) => void;
}

function splitEikenTabTitle(title: string, index: number): { kicker: string; label: string } {
  const daimonMatch = title.match(/^(大問\d+)\s*(.*)$/);
  if (daimonMatch) {
    return { kicker: daimonMatch[1], label: daimonMatch[2] || title };
  }
  if (title === 'リスニング練習') {
    return { kicker: 'リスニング', label: title };
  }
  if (title === '読解 基礎練習') {
    return { kicker: '基礎準備', label: title };
  }
  return splitTabTitle(title, index);
}

const EIKEN_GRADE_ORDER = ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1'] as const;

export function ChapterSelection({
  mode,
  onSelectChapter,
  onBack,
  subject = 'english_listening',
  rememberedGroup,
  onGroupChange,
  backLabel = '戻る',
  onOpenMock,
  onOpenWriting,
}: ChapterSelectionProps) {
  const isEiken = subject.startsWith('eiken_');
  const isToeic = subject === 'toeic_part5';
  const isGrammar = subject === 'english_grammar';
  const theme = subjectTheme(subject);

  // 英検のライティング大問タブ（3級〜準1級の大問4・大問5）を本番大問構成どおり組み立てる
  const writingDaimonGroups = useMemo(() => {
    if (!isEiken) return [];
    const grade = subject as EikenGrade;
    const specs = getGradeDaimonSpecs(grade).filter(s => s.kind === 'writing');
    if (specs.length === 0) return [];
    const allBookletWriting = bookletWritingTasks().filter(t => t.grade === grade);
    const gradeIdx = EIKEN_GRADE_ORDER.indexOf(grade as (typeof EIKEN_GRADE_ORDER)[number]);
    const unitWriting = gradeIdx >= 0 ? EIKEN_UNITS[gradeIdx]?.writing ?? [] : [];

    return specs.map((spec, idx) => {
      const roundTasks = allBookletWriting
        .filter(t => t.section === spec.section)
        .sort((a, b) => a.round - b.round);
      const basicTasks = unitWriting
        .filter(t => {
          if (spec.section === 'email') return t.id.includes('email') || t.title.includes('メール');
          if (spec.section === 'summary') return t.id.includes('summary') || t.title.includes('要約');
          if (spec.section === 'essay') return t.id.includes('essay') || t.title.includes('意見') || idx === specs.length - 1;
          return false;
        })
        .map(t => ({
          key: `${grade}_writing_${t.id}`,
          title: t.title,
          target: t.target,
        }));
      return {
        title: spec.tabTitle,
        partId: `${grade}_${spec.section}`,
        partTitle: `${theme.label}｜${spec.tabTitle}（全${roundTasks.length}回収録）`,
        chapters: [] as Chapter[],
        kicker: `大問${spec.daimonNo}`,
        label: spec.shortLabel,
        writingTasks: {
          roundTasks,
          basicTasks,
        },
      };
    });
  }, [isEiken, subject, theme.label]);

  const groups = useMemo(() => {
    if (isGrammar) return getGrammarPartGroups();
    const base = getChapterGroups(subject);
    if (!isEiken) return base;
    const grade = subject as EikenGrade;
    const allSpecs = getGradeDaimonSpecs(grade);

    // 各グループの partTitle も大問ごとの明確な案内文に整え、大問1 → 大問2 → … → 読解基礎 → リスニング の本番順に並べる
    const enrichedChoice = base.map(g => {
      const spec = allSpecs.find(s => s.tabTitle === g.title);
      if (spec) {
        const roundCount = g.chapters.filter(c => /_written_\d+_/.test(c.id)).length;
        return {
          ...g,
          partTitle: `${theme.label}｜${spec.tabTitle}（1回${spec.countPerRound}問・全${roundCount}回収録）`,
        };
      }
      if (g.title === '読解 基礎練習') {
        return {
          ...g,
          partTitle: `${theme.label}｜読解 基礎練習（4級長文への準備・2本文）`,
        };
      }
      return g;
    });

    const combined = [...enrichedChoice, ...writingDaimonGroups];
    const orderWeight = (title: string): number => {
      const m = title.match(/^大問(\d+)/);
      if (m) return Number(m[1]);
      if (title === '読解 基礎練習') return 80;
      if (title === 'リスニング練習') return 90;
      return 50;
    };
    return combined.sort((a, b) => orderWeight(a.title) - orderWeight(b.title));
  }, [isGrammar, isEiken, subject, theme.label, writingDaimonGroups]);

  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [openAudioSetId, setOpenAudioSetId] = useState<string | null>(null);
  const [activeGroupTitle, setActiveGroupTitle] = useState(
    groups.some(g => g.title === rememberedGroup) ? rememberedGroup! : groups[0]?.title || '',
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const uid = auth.currentUser?.uid || 'guest';
  const [solvedMap] = useState(() => readSolvedMap(uid));
  const [stageRecords] = useState(() => readStageRecords(uid));
  const [unitStats] = useState(() => readUnitStats(uid));
  const [writingProgress] = useState(() => {
    try {
      const ls = safeLocalStorage();
      return ls ? parseWriting(ls.getItem(writingKey(uid))) : emptyWriting();
    } catch {
      return emptyWriting();
    }
  });

  useEffect(() => {
    setActiveGroupTitle(groups.some(g => g.title === rememberedGroup) ? rememberedGroup! : groups[0]?.title || '');
    setExpandedChapterId(null);
    setOpenAudioSetId(null);
  }, [groups, rememberedGroup]);

  useEffect(() => {
    tabRefs.current[activeGroupTitle]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeGroupTitle]);

  const activeGroup = groups.find(group => group.title === activeGroupTitle) || groups[0];
  const activeWritingGroup = writingDaimonGroups.find(g => g.title === activeGroup?.title);
  const isListening = isEiken && activeGroup?.chapters.some(chapter => chapter.id.includes('_listening_')) === true;
  const isRounds = isListening || isToeic;
  const toeicTabs = isToeic && groups.length > 1;
  const toeicSub = activeGroup?.title === 'Part 7'
    ? 'Part 7 読解・1回7セット24問・4択'
    : activeGroup?.title === 'Part 6'
    ? 'Part 6 長文穴埋め・1回16問・4択'
    : 'Part 5 短文穴埋め・1回30問・4択';

  /** 英検は大問タブごとに 01. から回番号が素直に並ぶようにし、他教科は科目通し番号を保つ */
  const chapterNumberById = useMemo(() => {
    const m = new Map<string, number>();
    if (isEiken) {
      for (const g of groups) {
        g.chapters.forEach((c, i) => m.set(c.id, i));
      }
      return m;
    }
    groups.flatMap(g => g.chapters).forEach((c, i) => m.set(c.id, i));
    return m;
  }, [groups, isEiken]);

  const unitSections = useMemo(() => {
    const chapters = activeGroup?.chapters ?? [];
    if (isEiken) {
      const booklet = chapters.filter(c => /_written_\d+_/.test(c.id));
      const warmup = chapters.filter(c => !/_written_\d+_/.test(c.id));
      const out: { key: string | null; label: string | null; chapters: Chapter[] }[] = [];
      if (booklet.length > 0) {
        out.push({
          key: 'eiken:booklet',
          label: '回別 大問通し演習（印刷冊子・通し模試と共通）',
          chapters: booklet,
        });
      }
      if (warmup.length > 0) {
        out.push({
          key: 'eiken:warmup',
          label: booklet.length > 0 ? '基礎ウォームアップ演習' : '基礎練習',
          chapters: warmup,
        });
      }
      return out;
    }
    return buildUnitSections<Chapter>(subject, chapters, c =>
      (mode === 'mini_test' ? c.miniTest || [] : c.practiceProblems || []).length,
    );
  }, [isEiken, subject, activeGroup, mode]);
  const orderedChapters = useMemo(() => unitSections.flatMap(sec => sec.chapters), [unitSections]);
  const unitSectionByChapter = useMemo(() => {
    const m = new Map<string, (typeof unitSections)[number]>();
    for (const sec of unitSections) for (const c of sec.chapters) m.set(c.id, sec);
    return m;
  }, [unitSections]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="mtb-page chapter-route flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-0 w-full flex-col overflow-hidden notebook-paper p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(5.75rem+env(safe-area-inset-bottom))] relative font-handwriting">
      <header className="chapter-route-heading unit-head shrink-0">
        <button type="button" onClick={onBack} className="unit-head-back" aria-label={`${backLabel}へ戻る`}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <div className="unit-head-title">
          <h2 style={{ color: theme.accent }}>
            {isEiken ? `${theme.label} 大問別演習` : isGrammar ? '英文法' : isToeic ? 'TOEIC' : theme.label}
          </h2>
          <p>
            {mode === 'mini_test'
              ? '小テスト'
              : isListening
              ? '会話・説明文の重点練習／本試験1回分ではありません'
              : isEiken
              ? '本番の大問ごとに第1回〜順番に通して演習できます'
              : isToeic
              ? toeicTabs
                ? toeicSub
                : '1回30問・4択（短文穴埋め）'
              : isGrammar
              ? '単元別の4択演習'
              : '単元を選ぶ'}
          </p>
        </div>
        {isEiken && onOpenMock && (
          <button
            type="button"
            onClick={onOpenMock}
            className="shrink-0 rounded-xl border border-[#1e3a5f]/25 bg-[#1e3a5f] px-3 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-[#162c49] cursor-pointer"
            data-chapter-open-mock
          >
            通し模試へ
          </button>
        )}
        <DoorMascot subject={subject} showSpeech={false} size="mini" className="unit-head-mascot w-auto" />
      </header>

      <div
        className={`chapter-workspace flex min-h-0 flex-1 flex-col font-handwriting ${
          isEiken ? 'lg:!flex-col lg:!gap-2.5' : ''
        }`}
      >
        {(!isToeic || toeicTabs) && (
          <div
            className={`chapter-index mb-3 shrink-0 border-b border-slate-200/80 ${
              isEiken ? 'lg:!w-full lg:!pr-0 lg:!mb-1 lg:!border-r-0' : ''
            }`}
            data-few-tabs={groups.length <= 3 || undefined}
          >
            <div
              role="tablist"
              aria-label="章を選択"
              className={`flex touch-pan-x snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 pb-2 [scrollbar-width:thin] sm:grid sm:overflow-x-visible sm:overscroll-auto ${
                isEiken
                  ? groups.length >= 7
                    ? 'sm:grid-cols-4 lg:!grid lg:!grid-cols-7'
                    : groups.length === 6
                    ? 'sm:grid-cols-3 lg:!grid lg:!grid-cols-6'
                    : groups.length === 5
                    ? 'sm:grid-cols-3 lg:!grid lg:!grid-cols-5'
                    : 'sm:grid-cols-2 lg:!grid lg:!grid-cols-4'
                  : 'sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {groups.map((group, index) => {
                const isActive = group.title === activeGroup?.title;
                const wGroup = writingDaimonGroups.find(wg => wg.title === group.title);
                const { kicker: chapterNumber, label: shortTitle } = isToeic
                  ? { kicker: String(group.chapters[0]?.abstractTitle || '').replace(/^Part \d+\s*/, ''), label: group.title }
                  : wGroup
                  ? { kicker: `${wGroup.kicker}・${wGroup.writingTasks.roundTasks.length}回`, label: wGroup.label }
                  : isEiken
                  ? (() => {
                      const sp = splitEikenTabTitle(group.title, index);
                      const roundCount = group.chapters.filter(c => /_written_\d+_/.test(c.id)).length;
                      return {
                        kicker: roundCount > 0 ? `${sp.kicker}・${roundCount}回` : sp.kicker,
                        label: sp.label,
                      };
                    })()
                  : group.kicker
                  ? { kicker: `${group.kicker}・${group.chapters.length}単元`, label: group.label as string }
                  : splitTabTitle(group.title, index);

                return (
                  <React.Fragment key={group.title}>
                    <button
                      ref={element => {
                        tabRefs.current[group.title] = element;
                      }}
                      id={`chapter-tab-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="chapter-tab-panel"
                      onClick={() => {
                        setActiveGroupTitle(group.title);
                        onGroupChange?.(group.title);
                        setExpandedChapterId(null);
                        setOpenAudioSetId(null);
                        document.getElementById('chapter-tab-panel')?.scrollTo({ top: 0 });
                      }}
                      className={`flex h-full min-h-[3rem] w-[42vw] min-w-[8.5rem] max-w-[11rem] shrink-0 snap-center flex-col justify-center rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer sm:w-auto sm:min-w-0 sm:max-w-none sm:shrink ${
                        isActive
                          ? 'border-[#A9CCE3] bg-[#2C3E50] text-white shadow-sm'
                          : 'border-slate-200 bg-white/75 text-slate-600 hover:border-[#A9CCE3] hover:bg-white'
                      }`}
                    >
                      <span
                        className="block text-xs font-bold leading-none"
                        style={{ color: isActive ? theme.accentSoft : theme.accent }}
                      >
                        {chapterNumber}
                      </span>
                      <span className="mt-1 block text-xs sm:text-sm font-bold leading-snug break-words [overflow-wrap:anywhere]">
                        {shortTitle}
                      </span>
                      {(() => {
                        if (wGroup) return null;
                        const ready = group.chapters.filter(
                          c => ((mode === 'mini_test' ? c.miniTest : c.practiceProblems) || []).length > 0,
                        ).length;
                        if (isRounds || ready === group.chapters.length) return null;
                        return (
                          <span className="chapter-tab-status" data-ready={ready > 0}>
                            {ready === 0 ? '準備中' : `${ready}/${group.chapters.length}単元`}
                          </span>
                        );
                      })()}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {activeGroup && (
          <section
            id="chapter-tab-panel"
            role="tabpanel"
            aria-labelledby={isToeic && !toeicTabs ? undefined : `chapter-tab-${groups.indexOf(activeGroup)}`}
            aria-label={isToeic && !toeicTabs ? 'TOEIC の回一覧' : undefined}
            tabIndex={0}
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white/35 p-3 pb-6 sm:p-4 sm:pb-6 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
          >
            {!isToeic && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: theme.accent }}>
                    {activeGroup.partTitle}
                  </p>
                </div>
              </div>
            )}

            {activeWritingGroup ? (
              <div className="space-y-4" data-eiken-writing-daimon>
                <div className="chapter-route-list unit-card-list xl:!grid-cols-2">
                  <h4 className="math-stage-heading col-span-full flex items-center justify-between gap-2" data-stage="booklet">
                    <span>回別 ライティング演習（印刷冊子・通し模試と共通）</span>
                    <small className="shrink-0 whitespace-nowrap">{activeWritingGroup.writingTasks.roundTasks.length}回</small>
                  </h4>
                  {activeWritingGroup.writingTasks.roundTasks.map((wTask, idx) => {
                    const draft = writingProgress.drafts[wTask.key];
                    const reviewed = Boolean(draft?.reviewed);
                    const words = draft?.text ? wordCount(draft.text) : 0;
                    const number = String(idx + 1).padStart(2, '0');
                    return (
                      <article
                        key={wTask.key}
                        className="unit-card"
                        data-status={reviewed ? 'done' : words > 0 ? 'doing' : 'todo'}
                        data-writing-round-card={wTask.key}
                        style={theme.accent ? ({ '--unit-accent': theme.accent } as React.CSSProperties) : undefined}
                      >
                        <div className="unit-card-row">
                          <div className="unit-card-main" style={{ cursor: 'default' }}>
                            <span className="unit-card-title">
                              <b>{number}.</b> 第{wTask.round}回（{activeWritingGroup.label}）
                            </span>
                            <span className="unit-card-meta">
                              <span className="mt-status" data-status={reviewed ? 'done' : words > 0 ? 'doing' : 'todo'}>
                                {reviewed ? '点検済' : words > 0 ? `下書き ${words}語` : '未着手'}
                              </span>
                              <span className="unit-card-acc">{wTask.target.replace(/（.*）/, '')}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            className="unit-card-primary"
                            onClick={() => onOpenWriting?.(wTask.key)}
                          >
                            {reviewed ? <CheckCircle2 size={15} aria-hidden="true" /> : <PenLine size={15} aria-hidden="true" />}
                            {words > 0 ? '続きを書く' : '演習開始'}
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {activeWritingGroup.writingTasks.basicTasks.length > 0 && (
                    <>
                      <h4 className="math-stage-heading col-span-full flex items-center justify-between gap-2" data-stage="warmup">
                        <span>基礎ウォームアップ演習</span>
                        <small className="shrink-0 whitespace-nowrap">{activeWritingGroup.writingTasks.basicTasks.length}題</small>
                      </h4>
                      {activeWritingGroup.writingTasks.basicTasks.map((bTask, bIdx) => {
                        const draft = writingProgress.drafts[bTask.key];
                        const reviewed = Boolean(draft?.reviewed);
                        const words = draft?.text ? wordCount(draft.text) : 0;
                        const number = String(activeWritingGroup.writingTasks.roundTasks.length + bIdx + 1).padStart(2, '0');
                        return (
                          <article
                            key={bTask.key}
                            className="unit-card"
                            data-status={reviewed ? 'done' : words > 0 ? 'doing' : 'todo'}
                            style={theme.accent ? ({ '--unit-accent': theme.accent } as React.CSSProperties) : undefined}
                          >
                            <div className="unit-card-row">
                              <div className="unit-card-main" style={{ cursor: 'default' }}>
                                <span className="unit-card-title">
                                  <b>{number}.</b> 基礎練習：{bTask.title}
                                </span>
                                <span className="unit-card-meta">
                                  <span className="mt-status" data-status={reviewed ? 'done' : words > 0 ? 'doing' : 'todo'}>
                                    {reviewed ? '点検済' : words > 0 ? `下書き ${words}語` : '未着手'}
                                  </span>
                                  <span className="unit-card-acc truncate max-w-[16rem]">
                                    {bTask.target.replace(/。.*$/, '')}
                                  </span>
                                </span>
                              </div>
                              <button
                                type="button"
                                className="unit-card-primary"
                                onClick={() => onOpenWriting?.(bTask.key)}
                              >
                                <PenLine size={15} aria-hidden="true" />
                                {words > 0 ? '続きを書く' : '演習開始'}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            ) : isRounds ? (
              <div className="space-y-5" data-listening-rounds data-toeic-rounds={isToeic || undefined}>
                {activeGroup.chapters.map(chapter => {
                  const questions = mode === 'mini_test' ? chapter.miniTest || [] : chapter.practiceProblems || [];
                  const rounds = buildListeningRounds(questions);
                  const audioSets = collectAudioSets(chapter);

                  return (
                    <div key={chapter.id}>
                      {isListening && <ListeningTechniqueCard chapterId={chapter.id} />}
                      <div className="mb-2.5">
                        {chapter.topics && chapter.topics.length > 0 && (
                          <p className="text-xs font-bold leading-relaxed text-slate-600">{chapter.topics.join(' ・ ')}</p>
                        )}
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          {rounds.length > 0
                            ? `全${rounds.length}回 ／ 達成 ${
                                rounds.filter(r => isStageCleared(stageRecords[stageKey(chapter.id, r.questionId)])).length
                              }回（満点${STAGE_CLEAR_PERFECTS}回で達成）`
                            : 'この大問の問題は準備中です'}
                        </p>
                        {isToeic && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-600" data-toeic-disclaimer>
                            {TOEIC_DISCLAIMER}
                          </p>
                        )}
                      </div>

                      {rounds.length > 0 ? (
                        <div className="round-grid grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {rounds.map(round => {
                            const roundStage = stageRecords[stageKey(chapter.id, round.questionId)];
                            const solved = isStageCleared(roundStage);
                            const tried = !!solvedMap[problemKey(chapter.id, round.questionId)] || !!roundStage;
                            const audio = audioSets.find(s => s.id === round.questionId);
                            return (
                              <div
                                key={round.questionId}
                                data-round
                                data-status={solved ? 'done' : 'todo'}
                                className={`round-card flex items-stretch gap-1.5 rounded-xl border p-1.5 text-left shadow-xs transition-all ${
                                  solved
                                    ? 'border-[#5BC0BE]/60 bg-[#EAF9F6]'
                                    : 'border-yellow-200/80 bg-[#FFFDF2]/90'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectChapter(chapter.id, round.index, false, {
                                      startIndex: round.index,
                                      endIndex: round.index,
                                    })
                                  }
                                  className="round-main flex min-h-[48px] min-w-0 flex-1 flex-col justify-center items-start px-1.5 text-left cursor-pointer"
                                  title={`${round.roundLabel}${round.detail && !isToeic ? ` ／ ${round.detail}` : ''}`}
                                >
                                  <span className="flex w-full items-center justify-between gap-1">
                                    <span className="round-title font-bold text-[#2C3E50]">{round.roundLabel}</span>
                                    {solved ? (
                                      <span className="round-done mt-status shrink-0" data-status="done">
                                        達成
                                      </span>
                                    ) : tried && !isToeic ? (
                                      <span className="round-done mt-status shrink-0" data-status="doing">
                                        満点 {roundStage?.p ?? 0}/{STAGE_CLEAR_PERFECTS}
                                      </span>
                                    ) : (
                                      <ChevronRight size={13} className="shrink-0 text-[#A9CCE3]" />
                                    )}
                                  </span>
                                  {round.detail && !isToeic && (
                                    <span className="round-detail mt-0.5 line-clamp-1 font-bold leading-snug text-slate-600">
                                      {round.detail}
                                    </span>
                                  )}
                                </button>

                                {audio && (
                                  <button
                                    type="button"
                                    onClick={() => setOpenAudioSetId(openAudioSetId === audio.id ? null : audio.id)}
                                    aria-expanded={openAudioSetId === audio.id}
                                    aria-label={`${round.roundLabel} の音源だけを聞く`}
                                    className={`round-audio inline-flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 font-bold transition-colors cursor-pointer ${
                                      openAudioSetId === audio.id
                                        ? 'border-[#3E9C93] bg-[#3E9C93] text-white'
                                        : 'border-[#5BC0BE]/60 bg-white text-[#2F7C74] hover:bg-[#D8F3EE]'
                                    }`}
                                    title={`${round.roundLabel} の音源だけを聞く`}
                                  >
                                    <Headphones size={16} aria-hidden="true" />
                                    <span>音源</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-center text-xs font-bold text-slate-400">
                          準備中（問題は順次追加しています）
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`chapter-route-list unit-card-list ${isEiken ? 'xl:!grid-cols-2' : ''}`}>
                {orderedChapters.map((chapter, routeIndex) => {
                  const questions = mode === 'mini_test' ? chapter.miniTest || [] : chapter.practiceProblems || [];
                  const hasQuestions = questions.length > 0;
                  const savedIndex = Math.max(
                    0,
                    Math.min(
                      questions.length - 1,
                      parseInt(safeGetItem(quizIndexKey(chapter.id, mode)) || '0', 10) || 0,
                    ),
                  );
                  const hasSavedProgress =
                    hasQuestions &&
                    (savedIndex > 0 ||
                      safeGetItem(quizExplKey(chapter.id, mode)) === 'true' ||
                      !!safeGetItem(quizRunKey(chapter.id, mode)) ||
                      Object.keys(safeParseJson<object>(safeGetItem(quizAnswersKey(chapter.id, mode)), {}) ?? {})
                        .length > 0);
                  const audioSets = isListening || isGrammar ? collectAudioSets(chapter) : [];
                  const solvedCount = questions.filter(q => solvedMap[problemKey(chapter.id, q.id)]).length;
                  const stat = unitStats[chapter.id];
                  const stage = stageRecords[stageKey(chapter.id)];
                  const roundCleared = isGrammar
                    ? questions.map(q => isStageCleared(stageRecords[stageKey(chapter.id, q.id)]))
                    : [];
                  const clearedRounds = roundCleared.filter(Boolean).length;
                  const nextRound = isGrammar ? Math.max(0, roundCleared.findIndex((c: boolean) => !c)) : 0;
                  const roundTried = isGrammar && questions.some(q => stageRecords[stageKey(chapter.id, q.id)]);
                  const grammarTarget = isGrammar
                    ? Math.min(Math.max(0, questions.length - 1), hasSavedProgress ? savedIndex : nextRound)
                    : 0;
                  const status = isGrammar
                    ? questions.length > 0 && clearedRounds === questions.length
                      ? 'done'
                      : solvedCount > 0 || hasSavedProgress || !!stat || roundTried
                      ? 'doing'
                      : 'todo'
                    : isStageCleared(stage)
                    ? 'done'
                    : solvedCount > 0 || hasSavedProgress || !!stat || !!stage
                    ? 'doing'
                    : 'todo';

                  const section = unitSectionByChapter.get(chapter.id);
                  const prevSection = routeIndex > 0 ? unitSectionByChapter.get(orderedChapters[routeIndex - 1].id) : undefined;
                  const stageHeading =
                    section?.label && section !== prevSection ? (
                      <h4
                        className="math-stage-heading col-span-full flex items-center justify-between gap-2"
                        data-stage={section.key?.split(':')[1] ?? section.key ?? ''}
                      >
                        <span>{section.label}</span>
                        <small className="shrink-0 whitespace-nowrap">
                          {section.chapters.length}{isEiken ? '回' : '単元'}
                        </small>
                      </h4>
                    ) : null;
                  const expanded = expandedChapterId === chapter.id;
                  const totalSubQuestions = questions.reduce((sum, q) => sum + (q.subQuestions?.length || 1), 0);

                  return (
                    <React.Fragment key={chapter.id}>
                      {stageHeading}
                      <div data-unit-id={chapter.id} data-unit-full-title={chapter.title}>
                        <UnitCard
                          index={chapterNumberById.get(chapter.id) ?? routeIndex}
                          title={chapter.abstractTitle}
                          topics={chapter.topics}
                          questionCount={questions.length}
                          countLabel={isEiken ? `この大問 全${totalSubQuestions}問を通して演習` : undefined}
                          status={status}
                          accuracy={accuracyOf(stat)}
                          perfects={isGrammar ? undefined : stage?.p ?? 0}
                          progressLabel={
                            isGrammar && status === 'doing' ? `達成 ${clearedRounds}/${questions.length}回` : undefined
                          }
                          hasSavedProgress={hasSavedProgress}
                          expanded={expanded}
                          accent={theme.accent}
                          primaryLabel={
                            isGrammar && hasQuestions
                              ? hasSavedProgress
                                ? `第${grammarTarget + 1}回の続き`
                                : clearedRounds === questions.length
                                ? `第${grammarTarget + 1}回をもう一度`
                                : `第${grammarTarget + 1}回を始める`
                              : isEiken && hasQuestions
                              ? hasSavedProgress
                                ? '続きから'
                                : '通しで解く'
                              : undefined
                          }
                          roundsMode={isGrammar && hasQuestions}
                          onToggle={() => setExpandedChapterId(expanded ? null : chapter.id)}
                          onStart={() =>
                            isGrammar
                              ? onSelectChapter(chapter.id, grammarTarget, false, {
                                  startIndex: grammarTarget,
                                  endIndex: grammarTarget,
                                })
                              : onSelectChapter(chapter.id, 0, false)
                          }
                          onResume={() =>
                            isGrammar
                              ? onSelectChapter(chapter.id, grammarTarget, false, {
                                  startIndex: grammarTarget,
                                  endIndex: grammarTarget,
                                })
                              : onSelectChapter(chapter.id, savedIndex, true)
                          }
                          onAudio={
                            audioSets.length > 0
                              ? () => setOpenAudioSetId(openAudioSetId === audioSets[0].id ? null : audioSets[0].id)
                              : undefined
                          }
                          audioOpen={audioSets.length > 0 && openAudioSetId === audioSets[0].id}
                        >
                          {isGrammar && hasQuestions && (
                            <div className="grammar-rounds" data-grammar-rounds>
                              <p className="grammar-rounds-head">
                                <span>全{questions.length}回（1回5問）</span>
                                <span
                                  className="grammar-rounds-meter"
                                  aria-label={`達成 ${clearedRounds}/${questions.length}回`}
                                >
                                  {roundCleared.map((c, i) => (
                                    <i key={i} data-on={c || undefined} data-next={i === grammarTarget || undefined} />
                                  ))}
                                </span>
                                <b>
                                  達成 {clearedRounds}/{questions.length}
                                </b>
                              </p>
                              <ol className="grammar-rounds-list">
                                {questions.map((question, questionIndex: number) => {
                                  const rec = stageRecords[stageKey(chapter.id, question.id)];
                                  const cleared = roundCleared[questionIndex];
                                  const isNext = questionIndex === grammarTarget;
                                  const state = cleared ? 'done' : rec ? 'doing' : 'todo';
                                  const label = String(question.category || question.title || '').replace(
                                    /^第\d+回\s*/,
                                    '',
                                  );
                                  return (
                                    <li key={question.id}>
                                      <button
                                        type="button"
                                        className="grammar-round"
                                        data-round={questionIndex}
                                        data-state={state}
                                        data-next={isNext || undefined}
                                        data-cleared={cleared || undefined}
                                        aria-label={`第${questionIndex + 1}回 ${label}（${
                                          cleared ? '達成' : rec ? `最高${rec.b}%` : 'まだ'
                                        }）を始める`}
                                        onClick={() =>
                                          onSelectChapter(chapter.id, questionIndex, false, {
                                            startIndex: questionIndex,
                                            endIndex: questionIndex,
                                          })
                                        }
                                      >
                                        <span className="grammar-round-no" aria-hidden="true">
                                          {questionIndex + 1}
                                        </span>
                                        <span className="grammar-round-body">
                                          {isNext && (
                                            <em className="grammar-round-next">
                                              {hasSavedProgress ? 'つづき' : 'つぎ'}
                                            </em>
                                          )}
                                          <span className="grammar-round-title">{label || `第${questionIndex + 1}回`}</span>
                                        </span>
                                        <span className="grammar-round-state">
                                          {cleared ? (
                                            <span className="unit-round-done">達成</span>
                                          ) : rec ? (
                                            <span className="grammar-round-best">最高 {rec.b}%</span>
                                          ) : (
                                            <span className="grammar-round-todo">まだ</span>
                                          )}
                                        </span>
                                        <ChevronRight size={16} aria-hidden="true" />
                                      </button>
                                    </li>
                                  );
                                })}
                              </ol>
                            </div>
                          )}
                          {!isGrammar && hasQuestions && questions.length > 1 && (
                            <div className="chapter-question-list unit-card-questions">
                              {questions.map((question, questionIndex: number) => (
                                <button
                                  key={question.id}
                                  type="button"
                                  onClick={() => onSelectChapter(chapter.id, questionIndex, false)}
                                >
                                  <span>
                                    {isEiken
                                      ? question.title || `問 ${questionIndex + 1}`
                                      : question.category || `問 ${questionIndex + 1}`}
                                  </span>
                                  <ChevronRight size={14} aria-hidden="true" />
                                </button>
                              ))}
                            </div>
                          )}
                        </UnitCard>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {(isListening || isGrammar) && (
              <AnimatePresence initial={false}>
                {(() => {
                  const sets = activeGroup.chapters.flatMap(c => collectAudioSets(c));
                  const target = sets.find(s => s.id === openAudioSetId);
                  if (!target) return null;
                  return (
                    <motion.div
                      key={target.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p
                            className={
                              isGrammar ? 'text-xs font-bold text-[#9D5C24]' : 'text-xs font-bold text-[#2F7C74]'
                            }
                          >
                            復習用音源 ／ {target.title}
                          </p>
                          <button
                            type="button"
                            onClick={() => setOpenAudioSetId(null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer"
                          >
                            <X size={11} />
                            閉じる
                          </button>
                        </div>
                        <ListeningAudioPlayer
                          tracks={target.tracks}
                          mode="review"
                          tone="light"
                          readCount={target.readCount}
                          title="復習用の音源を聞く（問題を解かずに音声だけ再生）"
                        />
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
