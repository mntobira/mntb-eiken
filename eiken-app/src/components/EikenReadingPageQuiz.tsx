/**
 * 英検「長文読解（内容一致選択・基礎読解）」「長文の語句空所補充」専用：
 * 1本文＋全設問一体型リーディング演習画面
 *
 * 解決する課題（モバイル見切れ・操作性）：
 *   1. 旧来の化学・数学向け上下2分割（上ペイン max-h-[50%] の「設問一覧」重複表示＋
 *      下ペインの左右矢印 w-7×2＝56px による横幅圧迫＋設問英文の欠落）を撤廃。
 *   2. TOEIC Part 6/7（ToeicPageQuiz）の文書×設問レイアウトと、英検のウォームペーパーデザイン
 *      （EikenClozePageQuiz / EikenMockExam）を融合：
 *      - PC（1024px以上）：左に sticky 本文カード、右に全設問カードを並べる2カラム表示
 *      - スマホ：上部ワンタップ切替（「通し表示」／「上下2分割」／「本文のみ」／「設問のみ」）に対応し、
 *        短い掲示文は1画面にすっきり収まり、2級〜1級の長文も上下独立スクロールや集中モードで快適に読める
 *   3. 本文カードは Eメールヘッダー（From/To/Date/Subject）構造化・下線強調（__...__）・
 *      長文空所 `( 21 )` の選択語句リアルタイム埋め込み＆タップで該当設問へジャンプに対応。
 *   4. 各設問カードに英文の問い全文＋本物の <button> 選択肢（2×2／長文選択肢は1列）＋消去法スラッシュを搭載。
 *   5. 採点・進捗台帳・復習リスト・XP/マナコイン・保存キー（quiz_answers_* / quiz_run_* / quiz_index_*）は
 *      既存の createScoreCurrentQuestion / createQuizStepActions / EikenStepExplanationView と100%互換。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns2,
  FileText,
  ListChecks,
  Mail,
  Rows2,
  Slash,
  X,
} from 'lucide-react';
import type { Chapter, Problem, SubQuestion } from '../types/curriculum';
import { subjectTheme } from '../data/subjectTheme';
import { calcQuestionTimeLimit, type ScoreBreakdown } from '../utils/scoring';
import { loadRun, type ChapterRunState } from '../utils/quizRunState';
import { resolveQuizRange } from '../utils/quizRange';
import { quizAnswersKey, quizExplKey, quizIndexKey, quizStepKey } from '../utils/quizStorageKeys';
import { parseStoredNonNegativeInteger, parseStoredStringRecord } from '../utils/progress';
import { safeGetItem } from '../utils/safeLocalStorage';
import { safeSetItem } from '../utils/storageGuard';
import { createScoreCurrentQuestion } from '../utils/quizScoring';
import { createQuizStepActions } from '../utils/quizNavigationActions';
import { useElimination } from '../hooks/useElimination';
import { useLatest } from '../hooks/useLatest';
import { formatText } from '../utils/textFormatter';
import { logRejection } from '../utils/reportError';
import { FloatingScoreAnimation } from './FloatingScoreAnimation';
import { QuizEmptyState } from './QuizEmptyState';
import { EikenStepExplanationView } from './EikenWrittenResultView';
import {
  extractEikenGradeFromChapterId,
  prefersSingleColumnChoices,
} from './eikenClozePageModel';
import { parsePassageEmailAndParagraphs } from './eikenStudyHelpers';
import './eiken-cloze-page.css';
import './eiken-reading-page.css';

export interface EikenReadingPageQuizProps {
  mode: 'mini_test' | 'practice';
  chapter: Chapter;
  onFinish: (answers: Record<string, string>, result?: ChapterRunState) => void;
  onBack: () => void;
  onReturnToBattle?: () => void;
  isGuest: boolean;
  isMobileView?: boolean;
  onExplanationChange?: (isExplanation: boolean) => void;
  onScored?: (breakdown: ScoreBreakdown, meta: { timeLimit: number; timeUsed: number; questionId: string }) => void;
  questionRange?: { startIndex: number; endIndex: number } | null;
}

type MobileReadingView = 'flow' | 'split' | 'doc' | 'q';

const MARK_KEYS: Record<string, number> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  a: 0,
  b: 1,
  c: 2,
  d: 3,
};

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface ParsedReadingPassage {
  title: string;
  genreLabel: string;
  isEmail: boolean;
  isCloze: boolean;
  headers: { key: string; value: string }[];
  paragraphs: string[];
}

export function parseEikenReadingPassage(problem: Problem, chapterId: string): ParsedReadingPassage {
  const rawText = String(problem.text || '').trim();
  const titleMatch = rawText.match(/^【([^】]+)】\s*\n([\s\S]*)$/);
  const title = titleMatch ? titleMatch[1].trim() : String(problem.title || 'Passage').trim();
  const body = titleMatch ? titleMatch[2].trim() : rawText;

  const parsedEmail = parsePassageEmailAndParagraphs(body);
  const isEmail = parsedEmail.headers.length >= 2;
  const isCloze =
    /_cloze$/.test(chapterId) ||
    /\(\s*\d+\s*\)/.test(body) ||
    String(problem.category || '').includes('空所');

  const lowerTitle = title.toLowerCase();
  const genreLabel = isCloze
    ? '長文の語句空所補充'
    : isEmail
    ? 'Eメール'
    : /notice|board|poster|schedule|guide|sign|event|club|workshop|library|menu|sale/.test(lowerTitle)
    ? '掲示・案内'
    : '説明文・評論文';

  return {
    title,
    genreLabel,
    isEmail,
    isCloze,
    headers: parsedEmail.headers,
    paragraphs: parsedEmail.paragraphs,
  };
}

export interface ReadingQuestionItem {
  sq: SubQuestion;
  displayNo: number;
  prompt: string;
  isClozeSlot: boolean;
}

export function buildReadingQuestionItems(problem: Problem): ReadingQuestionItem[] {
  const subs = problem.subQuestions || [];
  return subs.map((sq, idx) => {
    const labelStr = String(sq.label || '');
    const noMatch = labelStr.match(/問\s*(\d+)/);
    const displayNo = noMatch ? Number(noMatch[1]) : idx + 1;
    const strippedLabel = labelStr.replace(/^問\s*\d+\s*/, '').trim();
    const rawPrompt = String(sq.blankHint || strippedLabel || `設問 ${displayNo}`).trim();
    const isClozeSlot = /^空所\s*\(/.test(rawPrompt) || /^\(\s*\d+\s*\)$/.test(strippedLabel);
    const prompt = /^\(\s*\d+\s*\)$/.test(rawPrompt)
      ? `空所 ( ${displayNo} ) に入る最も適切な語句を選びなさい`
      : rawPrompt;
    return {
      sq,
      displayNo,
      prompt,
      isClozeSlot,
    };
  });
}

function renderRichInlineText(text: string): React.ReactNode {
  if (!text.includes('__')) {
    return formatText(text, [], { prose: true, noMath: true });
  }
  const segments = text.split(/(__[^_]+__)/g);
  return segments.map((seg, idx) => {
    if (seg.startsWith('__') && seg.endsWith('__') && seg.length > 4) {
      return (
        <u key={idx} className="erp-underline">
          {formatText(seg.slice(2, -2), [], { prose: true, noMath: true })}
        </u>
      );
    }
    return <React.Fragment key={idx}>{formatText(seg, [], { prose: true, noMath: true })}</React.Fragment>;
  });
}

function RichPassageBody({
  passage,
  items,
  answers,
  activeSqId,
  onSelectSlot,
}: {
  passage: ParsedReadingPassage;
  items: readonly ReadingQuestionItem[];
  answers: Record<string, string>;
  activeSqId: string | null;
  onSelectSlot: (item: ReadingQuestionItem) => void;
}) {
  const itemByNo = useMemo(() => {
    const map = new Map<number, ReadingQuestionItem>();
    for (const item of items) map.set(item.displayNo, item);
    return map;
  }, [items]);

  return (
    <>
      {passage.headers.length > 0 && (
        <dl className="erp-email-headers" lang="en" aria-label="メールヘッダー">
          {passage.headers.map((h, i) => (
            <div key={i} className="erp-email-row">
              <dt>{h.key}:</dt>
              <dd>{formatText(h.value, [], { prose: true, noMath: true })}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="erp-doc-body" lang="en">
        {passage.paragraphs.map((para, pIdx) => {
          if (!passage.isCloze) {
            return (
              <p key={pIdx} className="erp-doc-para">
                {renderRichInlineText(para)}
              </p>
            );
          }

          const parts = para.split(/(\(\s*\d+\s*\))/g);
          return (
            <p key={pIdx} className="erp-doc-para">
              {parts.map((part, idx) => {
                const m = part.match(/^\(\s*(\d+)\s*\)$/);
                if (!m) {
                  return <React.Fragment key={idx}>{renderRichInlineText(part)}</React.Fragment>;
                }
                const slotNo = Number(m[1]);
                const target = itemByNo.get(slotNo);
                if (!target) {
                  return (
                    <span key={idx} className="erp-cloze-slot">
                      <span className="erp-cloze-slot-no">({slotNo})</span>
                    </span>
                  );
                }
                const chosen = answers[target.sq.id] || '';
                const chosenIdx = chosen ? target.sq.options.indexOf(chosen) : -1;
                const word = chosenIdx >= 0 ? target.sq.optionTexts?.[chosenIdx] ?? chosen : '';
                return (
                  <button
                    key={idx}
                    type="button"
                    className="erp-cloze-slot"
                    data-filled={word ? true : undefined}
                    data-active={activeSqId === target.sq.id ? true : undefined}
                    data-eiken-cloze-slot={slotNo}
                    onClick={() => onSelectSlot(target)}
                    title={word ? `空所(${slotNo})：${word}（タップで問${slotNo}へ）` : `タップして問${slotNo}へ移動`}
                  >
                    <span className="erp-cloze-slot-no">({slotNo})</span>
                    {word && (
                      <span className="erp-cloze-slot-word">
                        {formatText(word, [], { prose: true, noMath: true })}
                      </span>
                    )}
                  </button>
                );
              })}
            </p>
          );
        })}
      </div>
    </>
  );
}

export function EikenReadingPageQuiz({
  mode,
  chapter,
  onFinish,
  onBack,
  onReturnToBattle,
  isGuest,
  onExplanationChange,
  onScored,
  questionRange,
}: EikenReadingPageQuizProps) {
  const questions: Problem[] = mode === 'mini_test' ? chapter.miniTest || [] : chapter.practiceProblems || [];
  const gradeId = useMemo(() => extractEikenGradeFromChapterId(chapter.id), [chapter.id]);
  const theme = subjectTheme(gradeId);

  const [run, setRun] = useState<ChapterRunState>(() => loadRun(chapter.id, mode));
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    parseStoredStringRecord(safeGetItem(quizAnswersKey(chapter.id, mode))),
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() =>
    parseStoredNonNegativeInteger(safeGetItem(quizIndexKey(chapter.id, mode)), Math.max(0, questions.length - 1)),
  );
  const [showingExplanation, setShowingExplanation] = useState(
    () => safeGetItem(quizExplKey(chapter.id, mode)) === 'true',
  );
  const [stepIndex, setStepIndex] = useState(() =>
    parseStoredNonNegativeInteger(safeGetItem(quizStepKey(chapter.id, mode))),
  );

  const { rangeStart, rangeEnd, rangeCount, rangePosition } = resolveQuizRange(
    questions.length,
    questionRange,
    currentQuestionIndex,
  );
  const safeIndex = Math.min(Math.max(rangeStart, currentQuestionIndex), Math.max(0, rangeEnd));
  useEffect(() => {
    if (safeIndex !== currentQuestionIndex && questions.length > 0) {
      setCurrentQuestionIndex(safeIndex);
    }
  }, [safeIndex, currentQuestionIndex, questions.length]);

  const currentQuestion = questions[safeIndex];
  const isLastQuestion = safeIndex >= rangeEnd;
  const canGoPrevious = safeIndex > rangeStart;

  const passage = useMemo(
    () => (currentQuestion ? parseEikenReadingPassage(currentQuestion, chapter.id) : null),
    [currentQuestion, chapter.id],
  );
  const items = useMemo(
    () => (currentQuestion ? buildReadingQuestionItems(currentQuestion) : []),
    [currentQuestion],
  );

  const { isEliminated, restoreOption, strikeOptionAnimated } = useElimination(chapter.id, mode);

  const [mobileView, setMobileView] = useState<MobileReadingView>('flow');
  const [activeSqId, setActiveSqId] = useState<string | null>(null);
  const [showScoreAnimation, setShowScoreAnimation] = useState(false);
  const [scoreAnimationData, setScoreAnimationData] = useState<{
    breakdown: ScoreBreakdown;
    totalScore: number;
  } | null>(null);

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const passagePaneRef = useRef<HTMLDivElement | null>(null);
  const questionsPaneRef = useRef<HTMLDivElement | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollMemoryRef = useRef<{ doc: number; q: number }>({ doc: 0, q: 0 });

  // タイマー計測（問題単位）
  const questionTimeLimit = useMemo(() => {
    if (!currentQuestion) return 120;
    const explicit = Number(currentQuestion.timeLimitSec);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
    return Math.max(90, calcQuestionTimeLimit(currentQuestion.subQuestions || []));
  }, [currentQuestion]);

  const [elapsedSec, setElapsedSec] = useState(0);
  const timeUsedRef = useRef(0);
  const lastScoredQuestionRef = useRef<string | null>(null);
  const prevQuestionIndexRef = useRef(safeIndex);

  useEffect(() => {
    void import('../battle/data/growthStore')
      .then(({ resetStudySession }) => resetStudySession())
      .catch(logRejection('growth.resetStudySession'));
  }, [chapter.id, mode]);

  useEffect(() => {
    safeSetItem(quizAnswersKey(chapter.id, mode), JSON.stringify(answers));
  }, [answers, chapter.id, mode]);

  useEffect(() => {
    safeSetItem(quizStepKey(chapter.id, mode), String(stepIndex));
  }, [stepIndex, chapter.id, mode]);

  useEffect(() => {
    safeSetItem(quizIndexKey(chapter.id, mode), String(safeIndex));
  }, [safeIndex, chapter.id, mode]);

  useEffect(() => {
    safeSetItem(quizExplKey(chapter.id, mode), String(showingExplanation));
  }, [showingExplanation, chapter.id, mode]);

  const onExplanationChangeRef = useLatest(onExplanationChange);
  useEffect(() => {
    onExplanationChangeRef.current?.(showingExplanation);
  }, [showingExplanation, onExplanationChangeRef]);

  const clearAnswersForQuestionIfUnscored = (qIndex: number) => {
    const q = questions[qIndex];
    if (!q) return;
    const scoredAsQuestion = Boolean(run.perQuestion[q.id]);
    const scoredAsStep = Object.keys(run.perStep || {}).some(k => k.startsWith(`${q.id}::`));
    if (scoredAsQuestion || scoredAsStep) return;
    const subIds = (q.subQuestions || []).map(sq => sq.id);
    if (subIds.length === 0) return;
    setAnswers(prev => {
      let changed = false;
      const next = { ...prev };
      for (const id of subIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    setElapsedSec(0);
    timeUsedRef.current = 0;
    lastScoredQuestionRef.current = null;
    setActiveSqId(null);
    scrollMemoryRef.current = { doc: 0, q: 0 };
    workspaceRef.current?.scrollTo({ top: 0 });
    passagePaneRef.current?.scrollTo({ top: 0 });
    questionsPaneRef.current?.scrollTo({ top: 0 });

    const leftIdx = prevQuestionIndexRef.current;
    if (leftIdx !== safeIndex) {
      clearAnswersForQuestionIfUnscored(leftIdx);
      prevQuestionIndexRef.current = safeIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex]);

  useEffect(() => {
    if (showingExplanation || !currentQuestion) return undefined;
    const id = window.setInterval(() => {
      setElapsedSec(prev => {
        const next = prev + 1;
        timeUsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [showingExplanation, currentQuestion]);

  const scoreCurrentQuestionIfNeeded = createScoreCurrentQuestion({
    currentQuestion,
    perStep: false,
    activeStepSub: null,
    activeStepSubs: currentQuestion?.subQuestions || [],
    run,
    setRun,
    lastScoredQuestionRef,
    timeUsedRef,
    answers,
    questionTimeLimit,
    chapter,
    mode,
    isGuest,
    currentQuestionIndex: safeIndex,
    onScored,
  });

  const { handleNext, handlePrevious } = createQuizStepActions({
    chapter,
    mode,
    isGuest,
    questions,
    answers,
    questionRange,
    rangeStart,
    rangeEnd,
    currentQuestionIndex: safeIndex,
    perStep: false,
    isLastStep: true,
    isLastQuestion,
    safeStepIndex: 0,
    showingExplanation,
    scoreCurrentQuestionIfNeeded,
    setScoreAnimationData,
    setShowScoreAnimation,
    setShowingExplanation,
    setStepIndex,
    setCurrentQuestionIndex,
    onExplanationChange,
    onFinish,
  });

  const handleExit = () => {
    if (!showingExplanation) {
      clearAnswersForQuestionIfUnscored(safeIndex);
    }
    onBack();
  };

  const switchMobileView = (next: MobileReadingView) => {
    const ws = workspaceRef.current;
    if (ws) {
      if (mobileView === 'doc') scrollMemoryRef.current.doc = ws.scrollTop;
      if (mobileView === 'q') scrollMemoryRef.current.q = ws.scrollTop;
    }
    setMobileView(next);
    window.requestAnimationFrame(() => {
      const el = workspaceRef.current;
      if (!el) return;
      if (next === 'doc') el.scrollTop = scrollMemoryRef.current.doc;
      else if (next === 'q') el.scrollTop = scrollMemoryRef.current.q;
    });
  };

  const jumpToQuestion = (sqId: string) => {
    setActiveSqId(sqId);
    const scrollCard = () => {
      const card = document.getElementById(`erp-item-${sqId}`);
      card?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      groupRefs.current[sqId]?.focus({ preventScroll: true });
    };
    if (mobileView === 'doc') {
      switchMobileView('q');
      window.requestAnimationFrame(() => window.requestAnimationFrame(scrollCard));
      return;
    }
    scrollCard();
  };

  const selectChoice = (sq: SubQuestion, mark: string) => {
    const isSelected = answers[sq.id] === mark;
    const struck = isEliminated(sq.id, mark);
    setActiveSqId(sq.id);

    if (struck) {
      restoreOption(sq.id, mark);
    }
    setAnswers(prev => {
      const next = { ...prev };
      if (isSelected) delete next[sq.id];
      else next[sq.id] = mark;
      return next;
    });
  };

  const toggleEliminateChoice = (sq: SubQuestion, mark: string) => {
    const struck = isEliminated(sq.id, mark);
    if (struck) {
      restoreOption(sq.id, mark);
      return;
    }
    if (answers[sq.id] === mark) {
      setAnswers(prev => {
        const next = { ...prev };
        delete next[sq.id];
        return next;
      });
    }
    strikeOptionAnimated(sq.id, mark);
  };

  const onGroupKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, sq: SubQuestion, idx: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const digitFromCode = e.code.startsWith('Digit') ? e.code.slice(5) : '';
    const k = (digitFromCode || e.key).toLowerCase();
    if (k in MARK_KEYS) {
      const mark = sq.options[MARK_KEYS[k]];
      if (mark) {
        e.preventDefault();
        if (e.shiftKey) toggleEliminateChoice(sq, mark);
        else selectChoice(sq, mark);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const target = items[idx + (e.key === 'ArrowDown' ? 1 : -1)];
      if (target) {
        e.preventDefault();
        groupRefs.current[target.sq.id]?.focus();
      }
    } else if (e.key === 'Enter') {
      const unanswered = items.filter(it => !answers[it.sq.id]);
      if (unanswered.length === 0) {
        e.preventDefault();
        handleNext();
      }
    }
  };

  if (questions.length === 0 || !currentQuestion || !passage) {
    return <QuizEmptyState abstractTitle={chapter.abstractTitle} onBack={onBack} />;
  }

  if (showingExplanation) {
    return (
      <EikenStepExplanationView
        mode={mode}
        chapter={chapter}
        answers={answers}
        isGuest={isGuest}
        currentQuestion={currentQuestion}
        currentQuestionIndex={safeIndex}
        totalQuestions={questions.length}
        isLastQuestion={isLastQuestion}
        run={run}
        handleNext={handleNext}
        onBackFromExplanation={() => {
          setShowingExplanation(false);
          onExplanationChange?.(false);
        }}
        onExit={handleExit}
        onReturnToBattle={onReturnToBattle}
        scoreAnimationData={scoreAnimationData}
        showScoreAnimation={showScoreAnimation}
      />
    );
  }

  const answeredInPassage = items.filter(it => Boolean(answers[it.sq.id])).length;
  const unansweredItems = items.filter(it => !answers[it.sq.id]);
  const unansweredCount = unansweredItems.length;
  const remainingSec = questionTimeLimit - elapsedSec;
  const timerState = remainingSec < 0 ? 'over' : remainingSec < questionTimeLimit * 0.2 ? 'low' : 'run';
  const timerPct = Math.max(0, Math.min(100, (elapsedSec / questionTimeLimit) * 100));

  const headerTitle = chapter.realTitle
    ? `${chapter.realTitle.replace(/^大問\d+\s*/, '')}｜${chapter.abstractTitle}`
    : chapter.abstractTitle;

  const qRangeLabel =
    items.length > 1
      ? `問${items[0].displayNo}〜問${items[items.length - 1].displayNo}（全${items.length}問）`
      : items.length === 1
      ? `問${items[0].displayNo}`
      : '';

  return (
    <div
      className="ecp-root erp-root"
      data-eiken-reading-quiz
      style={theme.accent ? ({ '--ecp-accent': theme.accent } as React.CSSProperties) : undefined}
    >
      {scoreAnimationData && (
        <FloatingScoreAnimation
          breakdown={scoreAnimationData.breakdown}
          totalScore={scoreAnimationData.totalScore}
          isVisible={showScoreAnimation}
        />
      )}

      {onReturnToBattle && (
        <button type="button" onClick={onReturnToBattle} className="ecp-battle-return">
          バトル結果・解説に戻る
        </button>
      )}

      {/* 上部ウォームクリームヘッダー */}
      <header className="ecp-head" data-quiz-header>
        <button
          type="button"
          className="ecp-back"
          onClick={handleExit}
          aria-label="単元選択に戻る"
          title="単元選択に戻る"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <span className="ecp-mode">{mode === 'mini_test' ? '小テスト' : '演習'}</span>
        <h2 className="ecp-title">{headerTitle}</h2>

        <dl className="ecp-stats">
          <div title="いまの長文／全体の長文数">
            <dt>
              <FileText size={14} aria-hidden="true" />
              <span className="ecp-sr">本文</span>
            </dt>
            <dd data-eiken-passage-pos>
              <b>{rangePosition}</b>/{rangeCount}
              <small>本文</small>
            </dd>
          </div>
          <div title="この長文で回答済みの設問数">
            <dt>
              <ListChecks size={14} aria-hidden="true" />
              <span className="ecp-sr">回答済み</span>
            </dt>
            <dd data-eiken-answered>
              <b>{answeredInPassage}</b>/{items.length}
              <small>問</small>
            </dd>
          </div>
        </dl>
      </header>

      {/* タイマー＆設問クイックジャンプドット */}
      <div className="ecp-subbar" data-state={timerState}>
        <div className="ecp-subbar-row">
          <p className="ecp-timer-label" role="timer">
            <Clock size={13} aria-hidden="true" />
            <span>
              {timerState === 'over'
                ? `経過 ${fmtClock(elapsedSec)}（目安 ${fmtClock(questionTimeLimit)} 超過）`
                : `経過 ${fmtClock(elapsedSec)} ・ 残り ${fmtClock(remainingSec)}`}
            </span>
            {timerState !== 'over' && <span className="ecp-timer-limit">／ {fmtClock(questionTimeLimit)}</span>}
          </p>

          <ol className="ecp-q-dots" aria-label="この長文の設問へ移動">
            {items.map(item => {
              const chosen = answers[item.sq.id] || '';
              const hasElim = item.sq.options.some(m => isEliminated(item.sq.id, m));
              const qState = chosen ? 'answered' : hasElim ? 'working' : 'todo';
              return (
                <li key={item.sq.id}>
                  <button
                    type="button"
                    className="ecp-q-dot"
                    data-qstate={qState}
                    onClick={() => jumpToQuestion(item.sq.id)}
                    title={`問${item.displayNo}へ移動`}
                  >
                    <span>問{item.displayNo}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <span className="ecp-elim-tip">
            <Slash size={11} aria-hidden="true" />
            <span>右クリック・×で選択肢を消去</span>
          </span>
        </div>

        <div className="ecp-timer-track" aria-hidden="true">
          <div className="ecp-timer-fill" style={{ width: `${timerPct}%` }} />
        </div>
      </div>

      {/* スマホ専用：長文の長さに合わせて切り替えられる4モードバー */}
      <div className="erp-mobile-bar" role="region" aria-label="スマホ表示切替">
        <div className="erp-view-tabs" role="tablist" aria-label="本文と設問の表示方法">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'flow'}
            className="erp-view-tab"
            data-active={mobileView === 'flow' || undefined}
            onClick={() => switchMobileView('flow')}
          >
            <Columns2 size={13} aria-hidden="true" />
            <span>通し</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'split'}
            className="erp-view-tab"
            data-active={mobileView === 'split' || undefined}
            onClick={() => switchMobileView('split')}
          >
            <Rows2 size={13} aria-hidden="true" />
            <span>2分割</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'doc'}
            className="erp-view-tab"
            data-active={mobileView === 'doc' || undefined}
            onClick={() => switchMobileView('doc')}
          >
            <BookOpen size={13} aria-hidden="true" />
            <span>本文</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'q'}
            className="erp-view-tab"
            data-active={mobileView === 'q' || undefined}
            onClick={() => switchMobileView('q')}
          >
            <span>設問</span>
            <span className="erp-view-tab-badge">
              {answeredInPassage}/{items.length}
            </span>
          </button>
        </div>
      </div>

      {/* メイン領域：PC は左右2カラム（sticky 本文＋設問一覧）、スマホは選択モードで快適表示 */}
      <div className="erp-workspace" data-view={mobileView} ref={workspaceRef}>
        <div className="erp-grid">
          {/* 左（上）：長文パッセージカード */}
          <div className="erp-passage-pane" ref={passagePaneRef}>
            <section className="erp-doc-card" aria-label={`本文：${passage.title}`} data-eiken-passage>
              <div className="erp-doc-meta">
                <div className="erp-doc-badges">
                  <span className="erp-doc-genre">
                    {passage.isEmail ? <Mail size={12} aria-hidden="true" /> : <BookOpen size={12} aria-hidden="true" />}
                    <span>{passage.genreLabel}</span>
                  </span>
                  {qRangeLabel && <span className="erp-doc-qrange">{qRangeLabel}</span>}
                </div>
              </div>

              <h3 className="erp-doc-title" lang="en">
                {formatText(passage.title, [], { prose: true, noMath: true })}
              </h3>

              <RichPassageBody
                passage={passage}
                items={items}
                answers={answers}
                activeSqId={activeSqId}
                onSelectSlot={item => jumpToQuestion(item.sq.id)}
              />

              <button
                type="button"
                className="erp-pane-next-btn"
                onClick={() => switchMobileView('q')}
              >
                <span>設問・選択肢へ進む</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </section>
          </div>

          {/* 右（下）：全設問カード一覧（横矢印を撤廃し、画面幅いっぱいに選択肢を表示） */}
          <div className="erp-questions-pane" ref={questionsPaneRef}>
            <div className="erp-peek-doc-bar">
              <span className="erp-peek-doc-title" lang="en">
                {passage.title}
              </span>
              <button
                type="button"
                className="erp-peek-doc-btn"
                onClick={() => switchMobileView('doc')}
              >
                <BookOpen size={12} aria-hidden="true" />
                <span>本文を見る</span>
              </button>
            </div>

            {items.map((item, idx) => {
              const { sq, displayNo, prompt, isClozeSlot } = item;
              const chosen = answers[sq.id] || '';
              const texts = sq.optionTexts || [];
              const singleCol = prefersSingleColumnChoices(texts);
              const labelId = `erp-q-label-${sq.id}`;
              const status = chosen ? 'answered' : 'todo';

              return (
                <article
                  key={sq.id}
                  id={`erp-item-${sq.id}`}
                  className="ecp-item erp-q-card"
                  data-status={status}
                  data-eiken-question={displayNo}
                >
                  <div className="erp-q-head" id={labelId}>
                    <span className="ecp-no" aria-hidden="true">
                      {displayNo}
                    </span>
                    <span className="ecp-sr">問{displayNo}　</span>
                    <p className="erp-q-prompt" lang={isClozeSlot ? 'ja' : 'en'}>
                      {formatText(prompt, [], { prose: true, noMath: true })}
                    </p>
                  </div>

                  <div
                    role="group"
                    aria-labelledby={labelId}
                    tabIndex={0}
                    ref={el => {
                      groupRefs.current[sq.id] = el;
                    }}
                    onKeyDown={e => onGroupKeyDown(e, sq, idx)}
                    className={`ecp-choices${singleCol ? ' is-single' : ''}`}
                  >
                    {sq.options.map((mark, optIdx) => {
                      const checked = chosen === mark;
                      const struck = isEliminated(sq.id, mark);
                      const text = texts[optIdx] ?? mark;
                      const stateNote = struck
                        ? '消去済み。タップで元に戻します'
                        : checked
                        ? '選択中'
                        : '未選択';

                      return (
                        <div
                          key={mark}
                          className="erp-choice-row"
                          data-checked={checked || undefined}
                        >
                          <button
                            type="button"
                            aria-pressed={checked}
                            aria-label={`${mark} ${text} ／${stateNote}`}
                            className="ecp-choice erp-choice-btn"
                            data-checked={checked || undefined}
                            data-eliminated={struck || undefined}
                            onClick={() => selectChoice(sq, mark)}
                            onContextMenu={e => {
                              e.preventDefault();
                              toggleEliminateChoice(sq, mark);
                            }}
                          >
                            <span className="ecp-bubble" aria-hidden="true">
                              {mark}
                            </span>
                            <span className="ecp-choice-body" aria-hidden="true">
                              <span className="ecp-choice-text" lang="en">
                                {formatText(text, [], { prose: true, noMath: true })}
                              </span>
                            </span>
                            {checked && (
                              <Check size={17} strokeWidth={3} className="ecp-choice-check" aria-hidden="true" />
                            )}
                          </button>

                          {!checked && (
                            <button
                              type="button"
                              className="erp-elim-overlay"
                              data-active={struck || undefined}
                              aria-label={`選択肢${mark}を${struck ? '消去解除' : '消去する'}`}
                              title={struck ? '消去メモを解除' : 'この選択肢を消去（右クリックでも可）'}
                              tabIndex={-1}
                              onClick={e => {
                                e.stopPropagation();
                                toggleEliminateChoice(sq, mark);
                              }}
                            >
                              <X size={13} strokeWidth={2.5} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* 下部固定フッター */}
      <footer className="ecp-foot">
        <button
          type="button"
          className="ecp-btn ecp-btn-sub"
          onClick={handlePrevious}
          disabled={!canGoPrevious}
          aria-label="前の問題へ"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          <span>前へ</span>
        </button>

        {unansweredCount > 0 ? (
          <button
            type="button"
            className="ecp-unanswered ecp-unanswered-btn"
            onClick={() => {
              const first = unansweredItems[0];
              if (first) jumpToQuestion(first.sq.id);
            }}
            title="最初の未回答問題へ移動"
            data-eiken-unanswered-count
          >
            未回答 {unansweredCount}問
          </button>
        ) : (
          <span className="ecp-unanswered is-complete" aria-live="polite" data-eiken-unanswered-count>
            <Check size={14} strokeWidth={3} aria-hidden="true" />
            <span>全問回答済</span>
          </span>
        )}

        <button
          type="button"
          className="ecp-btn ecp-btn-main"
          data-ready={unansweredCount === 0 ? true : undefined}
          onClick={handleNext}
          data-eiken-reading-submit
        >
          <span>解答と解説を見る</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
