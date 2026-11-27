/**
 * 英検（筆記・語彙・読解）専用：問題画面と完全一体型のコンパクト解説・結果画面
 *
 * 解決する課題：
 *   1. 問題画面（EikenClozePageQuiz の白カード＋話者ピル A/B＋2×2選択肢＋Interゴシック）と、
 *      結果・解説画面のデザイン・フォントが乖離していた問題を解消し、問題画面そのままのカードで答え合わせできるようにする。
 *   2. Cambria Math やセリフ斜体 A:/B: を一切排除し、`var(--font-modern)` + `formatText(..., { prose: true, noMath: true })` に完全統一。
 *   3. 重複していた「完成文の再掲」「あなたの解答: 2 / 正解: 4 の番号だけ表示」「4選択肢の縦長再掲」「3段フッター」を撤去し、
 *      問題文の空所内に `[誤答 → 正解]` を直接埋め込み、直下にコンパクトな「和訳」「要点」＋折りたたみ「選択肢の理由」だけを配置してスクロール量を大幅に削減する。
 *
 * 継承保護ファイル（Explanation.tsx / QuizScreens.tsx / ExplanationScreen.tsx）は一切変更しない。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  FileSearch,
  Home,
  MinusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { auth } from '../firebase';
import { findChapterById, getChaptersOfSubject } from '../data/allChapters';
import { subjectTheme } from '../data/subjectTheme';
import type { Chapter, Problem, SubQuestion } from '../types/curriculum';
import { applyReviewFocus, readReviewFocus, type ReviewTargetItem } from '../utils/reviewFocus';
import { isAnswerCorrect } from '../utils/answerJudge';
import { saveQuestionNote } from '../utils/questionNote';
import { notify } from '../utils/dialog';
import { formatText } from '../utils/textFormatter';
import { logRejection } from '../utils/reportError';
import { showInterstitialAd } from '../utils/adService';
import { FloatingScoreAnimation } from './FloatingScoreAnimation';
import { CorrectBurst } from './fx/CorrectBurst';
import { ScreenUnavailable } from './ScreenStatus';
import type { ChapterRunState } from '../utils/quizRunState';
import type { ScoreBreakdown } from '../utils/scoring';
import {
  extractEikenGradeFromChapterId,
  prefersSingleColumnChoices,
} from './eikenClozePageModel';
import { parsePassageEmailAndParagraphs } from './eikenStudyHelpers';
import { EikenQuestionStem } from './EikenClozePageQuiz';
import { StudentBatchResultSubmitBar } from '../sugoroku/homework/StudentBatchResultSubmitBar';
import './eiken-cloze-page.css';
import './eiken-written-result.css';

function fmtDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const s = Math.max(1, Math.round(sec));
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`;
}

interface ParsedSubReview {
  sq: SubQuestion;
  displayNo: number;
  stem: string;
  orderTokens: string[];
  chosen: string;
  status: 'correct' | 'wrong' | 'blank';
  filledWord: string;
  correctWord: string;
  translation: string;
  why: string;
  evidencePhrases: string[];
  choices: {
    mark: string;
    text: string;
    correct: boolean;
    picked: boolean;
    reason: string;
  }[];
}

interface ParsedPassageBlock {
  title: string;
  body: string;
  headers: { key: string; value: string }[];
  paragraphs: string[];
  translationLabel: string;
  translation: string;
}

function extractEvidenceSnippets(why: string, body: string): string[] {
  if (!why || !body) return [];
  const candidates: string[] = [];

  const evLine = why.match(/根拠[：:]\s*(.+)/);
  if (evLine?.[1]) {
    candidates.push(evLine[1].trim());
  }

  for (const qm of why.matchAll(/["“'「『]([A-Za-z0-9][^"”'」』]{3,120})["”'」』]/g)) {
    candidates.push(qm[1].trim());
  }

  for (const run of why.matchAll(/[A-Za-z][A-Za-z0-9,'’\-. ]{6,110}[A-Za-z0-9.!]/g)) {
    candidates.push(run[0].trim());
  }

  const hits: string[] = [];
  const lowerBody = body.toLowerCase();
  for (const raw of candidates) {
    const cleaned = raw.replace(/[.。,、]+$/g, '').trim();
    if (cleaned.length < 4) continue;
    const idx = lowerBody.indexOf(cleaned.toLowerCase());
    if (idx >= 0) {
      const exactSlice = body.slice(idx, idx + cleaned.length);
      if (!hits.includes(exactSlice)) {
        hits.push(exactSlice);
      }
    }
  }
  return hits;
}

function renderPassageTextWithEvidence(text: string, evidences: readonly string[]): React.ReactNode {
  const renderStyled = (chunk: string, keyPrefix: string): React.ReactNode => {
    if (!chunk.includes('__')) {
      return formatText(chunk, [], { prose: true, noMath: true });
    }
    return chunk.split(/(__[^_]+__)/g).map((seg, i) => {
      if (seg.startsWith('__') && seg.endsWith('__') && seg.length > 4) {
        return (
          <u key={`${keyPrefix}-u-${i}`} className="ewr-passage-underline">
            {formatText(seg.slice(2, -2), [], { prose: true, noMath: true })}
          </u>
        );
      }
      return (
        <React.Fragment key={`${keyPrefix}-t-${i}`}>
          {formatText(seg, [], { prose: true, noMath: true })}
        </React.Fragment>
      );
    });
  };

  const validEvs = evidences.filter(Boolean);
  if (validEvs.length === 0) {
    return renderStyled(text, 'plain');
  }

  const nodes: React.ReactNode[] = [];
  let rest = text;
  let seq = 0;
  while (rest.length > 0) {
    let bestIdx = -1;
    let bestEv = '';
    const lowerRest = rest.toLowerCase();
    for (const ev of validEvs) {
      const found = lowerRest.indexOf(ev.toLowerCase());
      if (found >= 0 && (bestIdx < 0 || found < bestIdx || (found === bestIdx && ev.length > bestEv.length))) {
        bestIdx = found;
        bestEv = rest.slice(found, found + ev.length);
      }
    }
    if (bestIdx < 0) {
      nodes.push(<React.Fragment key={`tail-${seq}`}>{renderStyled(rest, `tail-${seq}`)}</React.Fragment>);
      break;
    }
    if (bestIdx > 0) {
      nodes.push(
        <React.Fragment key={`pre-${seq}`}>
          {renderStyled(rest.slice(0, bestIdx), `pre-${seq}`)}
        </React.Fragment>,
      );
    }
    nodes.push(
      <mark key={`ev-${seq}`} className="ewr-ev-mark" data-eiken-ev>
        {renderStyled(bestEv, `ev-${seq}`)}
      </mark>,
    );
    rest = rest.slice(bestIdx + bestEv.length);
    seq += 1;
  }
  return nodes;
}

function extractPassageBlock(problem: Problem): ParsedPassageBlock | null {
  const isPassage = (problem.subQuestions?.length || 0) > 1 || /^【.+】\n/.test(problem.text || '');
  if (!isPassage) return null;

  const rawText = String(problem.text || '').trim();
  const titleMatch = rawText.match(/^【([^】]+)】\s*\n([\s\S]*)$/);
  const title = titleMatch ? titleMatch[1].trim() : problem.title || '長文';
  const body = titleMatch ? titleMatch[2].trim() : rawText;
  const parsedEmail = parsePassageEmailAndParagraphs(body);

  const trackTr = problem.explanationTracks?.[0]?.translation?.trim() || '';
  const rawExp = String(problem.explanation || '');
  const fullTrMatch = rawExp.match(/【(全文和訳|本文の和訳)】\s*\n([\s\S]*?)(?:\n\n<!--|\n<!--|$)/);
  const translationLabel = fullTrMatch?.[1] || '本文の和訳';
  const translation = (fullTrMatch?.[2] || trackTr).trim();

  return {
    title,
    body,
    headers: parsedEmail.headers.length >= 2 ? parsedEmail.headers : [],
    paragraphs: parsedEmail.headers.length >= 2 ? parsedEmail.paragraphs : body.split(/\n{2,}/).filter(Boolean),
    translationLabel,
    translation,
  };
}

/** 長文本文中の `( 21 )` 等の空所に採点後の語句バッジを埋め込み、さらに選択中の根拠箇所を黄色マーカーで強調描画 */
function PassageBodyWithAnswers({
  passage,
  subs,
  activeEvidences = [],
}: {
  passage: ParsedPassageBlock;
  subs: readonly ParsedSubReview[];
  activeEvidences?: readonly string[];
}) {
  const byNo = useMemo(() => {
    const map = new Map<number, ParsedSubReview>();
    for (const s of subs) map.set(s.displayNo, s);
    return map;
  }, [subs]);

  return (
    <div className="ewr-passage-en" lang="en">
      {passage.headers.length > 0 && (
        <dl className="ewr-email-headers" aria-label="メールヘッダー">
          {passage.headers.map((h, i) => (
            <div key={i} className="ewr-email-row">
              <dt>{h.key}:</dt>
              <dd>{renderPassageTextWithEvidence(h.value, activeEvidences)}</dd>
            </div>
          ))}
        </dl>
      )}

      {passage.paragraphs.map((para, pIdx) => {
        const parts = para.split(/(\(\s*\d+\s*\))/g);
        return (
          <p key={pIdx} className="ewr-passage-para">
            {parts.map((part, idx) => {
              const m = part.match(/^\(\s*(\d+)\s*\)$/);
              if (!m) {
                return (
                  <React.Fragment key={idx}>
                    {renderPassageTextWithEvidence(part, activeEvidences)}
                  </React.Fragment>
                );
              }
              const no = Number(m[1]);
              const hit = byNo.get(no);
              if (!hit) {
                return (
                  <span key={idx} className="ewr-inline-slot">
                    ({no})
                  </span>
                );
              }
              return (
                <span key={idx} className="ewr-inline-slot" data-status={hit.status}>
                  <b className="ewr-slot-no">({no})</b>
                  {hit.status === 'wrong' && hit.filledWord && (
                    <>
                      <span className="ewr-slot-wrong">
                        {formatText(hit.filledWord, [], { prose: true, noMath: true })}
                      </span>
                      <span className="ewr-slot-arrow" aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
                  <span className="ewr-slot-right">
                    {formatText(hit.correctWord, [], { prose: true, noMath: true })}
                  </span>
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

function parseProblemSubReviews(
  problem: Problem,
  answers: Record<string, string>,
  fallbackIndex: number,
  hasPassage: boolean,
  passageBody = '',
): ParsedSubReview[] {
  const subs = problem.subQuestions || [];
  const rawExpLines = String(problem.explanation || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let problemTranslation = '';
  for (const line of rawExpLines) {
    if (line.startsWith('【訳】')) {
      problemTranslation = line.replace(/^【訳】\s*/, '').trim();
      break;
    }
  }
  if (!problemTranslation && !hasPassage) {
    const tr = problem.explanationTracks?.[0]?.translation?.trim() || '';
    if (tr && !tr.startsWith('手がかり：')) {
      problemTranslation = tr;
    }
  }

  // 単問（短文・会話・整序・基礎語彙）の本文と並べ替え語群を分解
  let baseStem = String(problem.text || '').trim();
  let orderTokens: string[] = [];
  if (!hasPassage) {
    const lines = baseStem
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length >= 2 && /^1\.\s+\S+.*／\s*2\.\s+/.test(lines[lines.length - 1])) {
      const tokenLine = lines.pop()!;
      orderTokens = tokenLine
        .split(/\s*／\s*/)
        .map(s => s.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      baseStem = lines.join('\n');
    }
    baseStem = baseStem.replace(/^問\s*\d+[\s　]+/, '').trim();
  }

  return subs.map((sq, sIdx) => {
    const labelStr = String(sq.label || problem.title || '');
    const noMatch = labelStr.match(/問\s*(\d+)/);
    const displayNo = noMatch ? Number(noMatch[1]) : fallbackIndex + sIdx + 1;

    const chosen = answers[sq.id] || '';
    const ok = Boolean(chosen) && isAnswerCorrect(sq, chosen);
    const status: 'correct' | 'wrong' | 'blank' = !chosen ? 'blank' : ok ? 'correct' : 'wrong';

    const texts = sq.optionTexts || [];
    const chosenIdx = chosen ? sq.options.indexOf(chosen) : -1;
    const correctIdx = Math.max(0, sq.options.indexOf(sq.correctAnswer));
    const filledWord = chosenIdx >= 0 ? texts[chosenIdx] ?? chosen : '';
    const correctWord = texts[correctIdx] ?? sq.correctAnswer;

    const stem = hasPassage
      ? (sq.blankHint || labelStr.replace(/^問\s*\d+\s*/, '').trim() || `空所 ( ${displayNo} )`)
      : baseStem;

    const why = String(sq.explainJa || '').trim();
    const trackEvs = (problem.explanationTracks?.[0]?.keyPhrases || [])
      .filter(kp => String(kp.meaning || '').includes(`問${displayNo}`) && String(kp.meaning || '').includes('根拠'))
      .map(kp => String(kp.phrase || '').trim())
      .filter(Boolean);
    const extractedEvs = hasPassage ? extractEvidenceSnippets(why, passageBody) : [];
    const evidencePhrases = Array.from(new Set([...trackEvs, ...extractedEvs])).filter(
      ev => ev.length >= 4 && passageBody.toLowerCase().includes(ev.toLowerCase()),
    );

    const distractors = sq.distractors || [];
    const choices = sq.options.map((mark, idx) => ({
      mark,
      text: texts[idx] ?? mark,
      correct: mark === sq.correctAnswer,
      picked: mark === chosen,
      reason: distractors.find(d => d.no === idx + 1)?.why ?? '',
    }));

    return {
      sq,
      displayNo,
      stem,
      orderTokens: sIdx === 0 ? orderTokens : [],
      chosen,
      status,
      filledWord,
      correctWord,
      translation: sIdx === 0 ? problemTranslation : '',
      why,
      evidencePhrases,
      choices,
    };
  });
}

function SubReviewCard({
  problem,
  chapter,
  sub,
  hasPassage,
  isOpen,
  onToggleOpen,
  saved,
  onSaveNote,
  evidenceActive,
  onShowEvidence,
}: {
  problem: Problem;
  chapter: Chapter;
  sub: ParsedSubReview;
  hasPassage: boolean;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  saved: boolean;
  onSaveNote: () => void;
  evidenceActive?: boolean;
  onShowEvidence?: () => void;
}) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const { sq, displayNo, stem, orderTokens, status, filledWord, correctWord, translation, why, evidencePhrases, choices } = sub;
  const singleCol = prefersSingleColumnChoices(choices.map(c => c.text));
  const labelId = `ewr-q-${sq.id}`;
  const isClozeSlotPrompt = hasPassage && /^空所\s*\(/.test(stem);

  return (
    <article
      id={`ewr-item-${sq.id}`}
      className="ecp-item ewr-card"
      data-status={status}
      data-eiken-question={displayNo}
    >
      {hasPassage ? (
        <div className="ewr-sub-prompt" id={labelId}>
          <span className="ecp-no" aria-hidden="true">
            {displayNo}
          </span>
          <span className="ecp-sr">問{displayNo}　</span>
          <p className="ewr-sub-prompt-text" lang={isClozeSlotPrompt ? 'ja' : 'en'}>
            {formatText(stem, [], { prose: true, noMath: true })}
          </p>
          {status === 'blank' && (
            <span className="ecp-tag" data-eiken-unanswered>
              未回答
            </span>
          )}
        </div>
      ) : (
        <EikenQuestionStem
          displayNo={displayNo}
          stem={stem}
          filled={status === 'correct' ? correctWord : filledWord}
          correctWord={correctWord}
          result={status === 'correct' ? 'right' : status === 'wrong' ? 'wrong' : 'blank'}
          unansweredTag={status === 'blank'}
          skillLabel={problem.category || chapter.realTitle}
          orderTokens={orderTokens}
          labelId={labelId}
        />
      )}

      {/* 問題画面そのままの 2×2 / 1列 選択肢カード */}
      <div
        role="group"
        aria-labelledby={labelId}
        aria-disabled="true"
        className={`ecp-choices is-scored${singleCol ? ' is-single' : ''}`}
      >
        {choices.map(c => {
          const tone = c.correct ? 'right' : c.picked ? 'wrong' : undefined;
          return (
            <div
              key={c.mark}
              className="ecp-choice"
              data-checked={c.picked || undefined}
              data-result={tone}
            >
              <span className="ecp-bubble" aria-hidden="true">
                {c.mark}
              </span>
              <span className="ecp-choice-body">
                <span className="ecp-choice-text" lang="en">
                  {formatText(c.text, [], { prose: true, noMath: true })}
                </span>
              </span>
              {(c.correct || c.picked) && (
                <span className="ecp-choice-badge" data-tone={c.correct ? 'right' : 'wrong'}>
                  {c.correct && c.picked ? 'あなた・正解' : c.correct ? '正解' : 'あなた'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 超コンパクトな正誤バー＋和訳・要点・折りたたみ選択肢理由 */}
      <div className="ecp-compact-review">
        <div className="ewr-review-bar">
          <button
            type="button"
            className="ewr-disclosure-btn"
            aria-label="解説"
            aria-expanded={isOpen}
            onClick={() => onToggleOpen(!isOpen)}
          >
            <span className="ecp-judge" data-result={status}>
              {status === 'correct' ? (
                <CheckCircle2 size={15} aria-hidden="true" />
              ) : status === 'wrong' ? (
                <XCircle size={15} aria-hidden="true" />
              ) : (
                <MinusCircle size={15} aria-hidden="true" />
              )}
              <span>
                {status === 'correct'
                  ? '正解'
                  : status === 'wrong'
                  ? `不正解（正解 ${sq.correctAnswer}）`
                  : `未回答（正解 ${sq.correctAnswer}）`}
              </span>
            </span>
            <span className="ecp-ex-toggle-hint">{isOpen ? '閉じる' : '解説'}</span>
            <ChevronDown
              size={15}
              className={`ecp-ex-chev${isOpen ? ' is-open' : ''}`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className="ecp-save ecp-save-inline"
            data-saved={saved || undefined}
            disabled={saved}
            onClick={onSaveNote}
          >
            {saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
            <span>{saved ? '保存済' : 'ノート保存'}</span>
          </button>
        </div>

        {isOpen && (
          <div className="ecp-ex-body ewr-ex-body">
            {translation && (
              <div className="ecp-ex-line" data-role="tr">
                <span className="ecp-ex-tag" data-role="tr">
                  和訳
                </span>
                <p className="ecp-ex-text">{formatText(translation, [], { prose: true, noMath: true })}</p>
              </div>
            )}

            {why && (
              <div className="ecp-ex-line" data-role="why">
                <span className="ecp-ex-tag" data-role="why">
                  要点
                </span>
                <p className="ecp-ex-text">{formatText(why, [], { prose: true, noMath: true })}</p>
              </div>
            )}

            {hasPassage && evidencePhrases.length > 0 && onShowEvidence && (
              <div className="ewr-ev-action-row">
                <button
                  type="button"
                  className="ewr-ev-btn"
                  data-active={evidenceActive || undefined}
                  onClick={onShowEvidence}
                >
                  <FileSearch size={13} aria-hidden="true" />
                  <span>{evidenceActive ? '本文の根拠マーカーを解除' : '本文で根拠を見る'}</span>
                </button>
              </div>
            )}

            {choices.some(c => Boolean(c.reason)) && (
              <div className="ecp-choice-reasons-fold">
                <button
                  type="button"
                  className="ecp-reasons-toggle-btn"
                  aria-expanded={reasonsOpen}
                  onClick={() => setReasonsOpen(v => !v)}
                >
                  <span>他の選択肢の理由</span>
                  <ChevronDown
                    size={14}
                    className={`ecp-fold-chev${reasonsOpen ? ' is-open' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {reasonsOpen && (
                  <ul className="ecp-ex-choices">
                    {choices.map(c => (
                      <li key={c.mark} data-correct={c.correct || undefined}>
                        <span className="ecp-ex-mark" aria-hidden="true">
                          {c.correct ? '○' : '×'}
                        </span>
                        <span>
                          <b lang="en">
                            {c.mark}. {formatText(c.text, [], { prose: true, noMath: true })}
                          </b>
                          {c.reason ? (
                            <> — {formatText(c.reason, [], { prose: true, noMath: true })}</>
                          ) : c.correct ? (
                            ' — 正解'
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* ============================================================================
 * 1. Quiz.tsx 内（1問ずつ演習：語句整序・長文・基礎ウォームアップ等）の採点直後解説画面
 * ========================================================================== */
export interface EikenStepExplanationViewProps {
  mode: 'mini_test' | 'practice';
  chapter: Chapter;
  answers: Record<string, string>;
  isGuest?: boolean;
  currentQuestion: Problem;
  currentQuestionIndex: number;
  totalQuestions: number;
  isLastQuestion: boolean;
  run: ChapterRunState;
  handleNext: () => void;
  onBackFromExplanation: () => void;
  onExit: () => void;
  onReturnToBattle?: () => void;
  scoreAnimationData: { breakdown: ScoreBreakdown; totalScore: number } | null;
  showScoreAnimation: boolean;
}

export function EikenStepExplanationView({
  mode,
  chapter,
  answers,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  isLastQuestion,
  handleNext,
  onBackFromExplanation,
  onExit,
  onReturnToBattle,
  scoreAnimationData,
  showScoreAnimation,
}: EikenStepExplanationViewProps) {
  const gradeId = useMemo(() => extractEikenGradeFromChapterId(chapter.id), [chapter.id]);
  const theme = subjectTheme(gradeId);
  const passage = useMemo(() => extractPassageBlock(currentQuestion), [currentQuestion]);
  const subs = useMemo(
    () =>
      parseProblemSubReviews(
        currentQuestion,
        answers,
        currentQuestionIndex,
        Boolean(passage),
        passage?.body ?? '',
      ),
    [currentQuestion, answers, currentQuestionIndex, passage],
  );

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [passageTrOpen, setPassageTrOpen] = useState(true);
  const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({});
  const [activeEvSqId, setActiveEvSqId] = useState<string | null>(null);
  const stepScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpenMap({});
    setPassageTrOpen(true);
    setActiveEvSqId(null);
  }, [currentQuestion.id]);

  const activeEvidences = useMemo(() => {
    if (!activeEvSqId) return [];
    return subs.find(s => s.sq.id === activeEvSqId)?.evidencePhrases ?? [];
  }, [activeEvSqId, subs]);

  const handleToggleEvidence = (sub: ParsedSubReview) => {
    const nextId = activeEvSqId === sub.sq.id ? null : sub.sq.id;
    setActiveEvSqId(nextId);
    if (nextId) {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          const mark = stepScrollRef.current?.querySelector('[data-eiken-ev]');
          mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }),
      );
    }
  };

  const handleSave = (sub: ParsedSubReview) => {
    const key = `${currentQuestion.id}:${sub.sq.id}`;
    if (savedNotes[key]) return;
    try {
      saveQuestionNote({
        uid: auth.currentUser?.uid || 'guest',
        chapter,
        question: currentQuestion,
        questionIndex: sub.displayNo,
      });
      setSavedNotes(prev => ({ ...prev, [key]: true }));
      notify('学習ノートに保存しました。');
    } catch (err) {
      logRejection('eikenStepReview.saveNote')(err);
      notify('ノートの保存に失敗しました。');
    }
  };

  const correctCount = subs.filter(s => s.status === 'correct').length;
  const headerTitle = chapter.realTitle
    ? `${chapter.realTitle.replace(/^大問\d+\s*/, '')}｜${chapter.abstractTitle}`
    : chapter.abstractTitle;

  return (
    <div
      className="ecp-root ewr-root"
      data-eiken-step-explanation
      style={theme.accent ? ({ '--ecp-accent': theme.accent } as React.CSSProperties) : undefined}
    >
      {scoreAnimationData && showScoreAnimation && scoreAnimationData.breakdown.basePoints > 0 && (
        <CorrectBurst burstKey={`${currentQuestion.id}:${scoreAnimationData.totalScore}`} combo={0} />
      )}
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

      <header className="ecp-head" data-quiz-header>
        <button
          type="button"
          className="ecp-back"
          onClick={onExit}
          aria-label="単元選択に戻る"
          title="単元選択に戻る"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <span className="ecp-mode">{mode === 'mini_test' ? '小テスト' : '答え合わせ'}</span>
        <h2 className="ecp-title">{headerTitle}</h2>
        <span className="ewr-step-pill">
          <b>{currentQuestionIndex + 1}</b>/{totalQuestions}
        </span>
      </header>

      <div className="ecp-scroll" ref={stepScrollRef}>
        <div className={`ewr-step-body${passage ? ' has-passage' : ''}`}>
          {/* 正誤ミニチップ（スマホの QuestionChip 互換アクセシビリティ属性も付与） */}
          {subs.length > 1 && (
            <div className="ewr-sub-chips" role="group" aria-label="設問ごとの正誤">
              {subs.map(sub => {
                const open = openMap[sub.sq.id] ?? true;
                const stText = sub.status === 'correct' ? '正解' : sub.status === 'wrong' ? '不正解' : '未回答';
                return (
                  <button
                    key={sub.sq.id}
                    type="button"
                    className="ewr-sub-chip"
                    data-result={sub.status}
                    aria-pressed={open}
                    aria-label={`問${sub.displayNo} ${stText}の解答・解説を${open ? '閉じる' : '見る'}`}
                    onClick={() => {
                      setOpenMap(prev => ({ ...prev, [sub.sq.id]: true }));
                      document
                        .getElementById(`ewr-item-${sub.sq.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                  >
                    <span>問{sub.displayNo}</span>
                    <b aria-hidden="true">{sub.status === 'correct' ? '○' : sub.status === 'wrong' ? '×' : '−'}</b>
                  </button>
                );
              })}
              <span className="ewr-sub-summary">
                {correctCount}/{subs.length}問正解
              </span>
            </div>
          )}

          {subs.length === 1 && (
            <span className="ecp-sr">
              <button
                type="button"
                aria-pressed={openMap[subs[0].sq.id] ?? true}
                aria-label={`問${subs[0].displayNo} ${
                  subs[0].status === 'correct' ? '正解' : '不正解'
                }の解答・解説を${(openMap[subs[0].sq.id] ?? true) ? '閉じる' : '見る'}`}
                onClick={() =>
                  setOpenMap(prev => ({ ...prev, [subs[0].sq.id]: !(prev[subs[0].sq.id] ?? true) }))
                }
              >
                問{subs[0].displayNo}
              </button>
            </span>
          )}

          {passage && (
            <section className="ewr-passage-card" aria-label={`長文本文：${passage.title}`}>
              <div className="ewr-passage-head">
                <h3 className="ewr-passage-title" lang="en">
                  {formatText(passage.title, [], { prose: true, noMath: true })}
                </h3>
                {passage.translation && (
                  <button
                    type="button"
                    className="ewr-tr-toggle"
                    aria-expanded={passageTrOpen}
                    onClick={() => setPassageTrOpen(v => !v)}
                  >
                    <span>{passage.translationLabel}</span>
                    <ChevronDown
                      size={14}
                      className={`ecp-fold-chev${passageTrOpen ? ' is-open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>

              <PassageBodyWithAnswers passage={passage} subs={subs} activeEvidences={activeEvidences} />

              {passage.translation && passageTrOpen && (
                <div className="ewr-passage-ja">
                  <span className="ewr-passage-ja-tag">【{passage.translationLabel}】</span>
                  <p>{formatText(passage.translation, [], { prose: true, noMath: true })}</p>
                </div>
              )}
            </section>
          )}

          <div className="ewr-cards-col">
            {subs.map(sub => {
              const isOpen = openMap[sub.sq.id] ?? true;
              const noteKey = `${currentQuestion.id}:${sub.sq.id}`;
              return (
                <SubReviewCard
                  key={sub.sq.id}
                  problem={currentQuestion}
                  chapter={chapter}
                  sub={sub}
                  hasPassage={Boolean(passage)}
                  isOpen={isOpen}
                  onToggleOpen={next => setOpenMap(prev => ({ ...prev, [sub.sq.id]: next }))}
                  saved={Boolean(savedNotes[noteKey])}
                  onSaveNote={() => void handleSave(sub)}
                  evidenceActive={activeEvSqId === sub.sq.id}
                  onShowEvidence={
                    passage && sub.evidencePhrases.length > 0 ? () => handleToggleEvidence(sub) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      <footer className="ecp-foot ewr-foot">
        <button type="button" className="ecp-btn ecp-btn-sub" onClick={onBackFromExplanation}>
          <ChevronLeft size={17} aria-hidden="true" />
          <span>問題に戻る</span>
        </button>

        <button type="button" className="ecp-btn ecp-btn-main" data-ready onClick={handleNext}>
          <span>{isLastQuestion ? '結果を見る' : '次の問題へ'}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}

/* ============================================================================
 * 2. App.tsx の `appState === 'explanation'` 用：単元完了後の結果・全問コンパクト解説画面
 * ========================================================================== */
export interface EikenWrittenResultViewProps {
  chapterId: string | null;
  mode: 'mini_test' | 'practice';
  answers: Record<string, string>;
  isGuest: boolean;
  resultTotalScore?: number;
  resultTotalCorrect?: number;
  resultTotalJudgeable?: number;
  resultTotalTimeSec?: number;
  questionRange?: { startIndex: number; endIndex: number } | null;
  subject?: string;
  onBack: () => void;
  onReturnToBattle?: () => void;
  onRetryWrong?: (chapterId: string, targets: ReviewTargetItem[]) => void;
  onNextChapter?: (chapterId: string) => void;
  onNextRound?: (chapterId: string, index: number) => void;
  onHome?: () => void;
}

export function EikenWrittenResultView({
  chapterId,
  mode,
  answers,
  isGuest,
  resultTotalCorrect,
  resultTotalJudgeable,
  resultTotalTimeSec,
  questionRange,
  subject,
  onBack,
  onReturnToBattle,
  onRetryWrong,
  onNextChapter,
  onNextRound,
  onHome,
}: EikenWrittenResultViewProps) {
  const rawChapter = findChapterById(chapterId);
  const chapter = useMemo(() => {
    if (!rawChapter) return undefined;
    const focus = readReviewFocus();
    if (!focus || focus.chapterId !== rawChapter.id) return rawChapter;
    const pool = mode === 'mini_test' ? 'miniTest' : 'practiceProblems';
    return { ...rawChapter, [pool]: applyReviewFocus(rawChapter[pool] || [], rawChapter.id, focus) };
  }, [rawChapter, mode]);

  const [filter, setFilter] = useState<'all' | 'wrong'>('all');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [openPassageTr, setOpenPassageTr] = useState<Record<string, boolean>>({});
  const [activeEvMap, setActiveEvMap] = useState<Record<string, string | null>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({});
  const [studyReward, setStudyReward] = useState<{ coins: number; xp: number; count: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let off = () => {};
    let alive = true;
    void import('../battle/data/growthStore')
      .then(({ currentStudySession, subscribeStudySession }) => {
        if (!alive) return;
        setStudyReward(currentStudySession());
        off = subscribeStudySession(setStudyReward);
      })
      .catch(logRejection('eikenResult.subscribeStudySession'));
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!chapter) {
    return (
      <ScreenUnavailable
        message="単元が見つかりません。教材の一覧から選び直してください。"
        onBack={onBack}
      />
    );
  }

  const gradeId = extractEikenGradeFromChapterId(chapter.id);
  const theme = subjectTheme(gradeId);

  const allQuestions: Problem[] = mode === 'mini_test' ? chapter.miniTest || [] : chapter.practiceProblems || [];
  const startIdx = questionRange ? Math.min(Math.max(0, questionRange.startIndex), Math.max(0, allQuestions.length - 1)) : 0;
  const endIdx = questionRange
    ? Math.min(Math.max(startIdx, questionRange.endIndex), Math.max(0, allQuestions.length - 1))
    : Math.max(0, allQuestions.length - 1);
  const scopedProblems = allQuestions.slice(startIdx, endIdx + 1);

  let runningNo = startIdx;
  const problemBlocks = scopedProblems.map(problem => {
    const passage = extractPassageBlock(problem);
    const subs = parseProblemSubReviews(
      problem,
      answers,
      runningNo,
      Boolean(passage),
      passage?.body ?? '',
    );
    runningNo += subs.length;
    return { problem, passage, subs };
  });

  const allSubs = problemBlocks.flatMap(b => b.subs.map(sub => ({ problem: b.problem, sub })));
  const computedTotal = allSubs.length;
  const computedCorrect = allSubs.filter(x => x.sub.status === 'correct').length;
  const totalJudgeable = resultTotalJudgeable ?? computedTotal;
  const totalCorrect = resultTotalCorrect ?? computedCorrect;
  const wrongOrBlankItems = allSubs.filter(x => x.sub.status !== 'correct');
  const accuracyPct = totalJudgeable > 0 ? Math.round((totalCorrect / totalJudgeable) * 100) : 0;

  // 間違えた問題の解き直しターゲットを構築
  const wrongTargets: ReviewTargetItem[] = (() => {
    const byProblem = new Map<string, string[]>();
    for (const { problem, sub } of wrongOrBlankItems) {
      byProblem.set(problem.id, [...(byProblem.get(problem.id) || []), sub.sq.id]);
    }
    return [...byProblem.entries()].map(([questionId, subQuestionIds]) => ({
      questionId,
      subQuestionIds,
    }));
  })();

  // 次の回 / 次の単元の解決（QuizScreens.tsx と同じ規則）
  const nextRoundIndex =
    questionRange && questionRange.startIndex === questionRange.endIndex && questionRange.endIndex + 1 < allQuestions.length
      ? questionRange.endIndex + 1
      : -1;

  const nextChapter = (() => {
    if (questionRange || !subject) return null;
    const list = getChaptersOfSubject(subject);
    const at = list.findIndex((c: Chapter) => c.id === chapter.id);
    if (at < 0) return null;
    const pool = mode === 'mini_test' ? 'miniTest' : 'practiceProblems';
    return list.slice(at + 1).find((c: Chapter) => (c[pool] || []).length > 0) || null;
  })();

  const triggerAdAndAction = (action?: () => void) => {
    showInterstitialAd().catch(() => {});
    action?.();
  };

  const handlePrimaryNext = () => {
    if (nextRoundIndex >= 0 && onNextRound) {
      triggerAdAndAction(() => onNextRound(chapter.id, nextRoundIndex));
    } else if (nextChapter && onNextChapter) {
      triggerAdAndAction(() => onNextChapter(nextChapter.id));
    } else {
      triggerAdAndAction(onBack);
    }
  };

  const primaryNextLabel =
    nextRoundIndex >= 0 && onNextRound
      ? `次の問題（問${nextRoundIndex + 1}）へ`
      : nextChapter && onNextChapter
      ? '次の回・単元へ'
      : '単元一覧へ戻る';

  const allOpen =
    allSubs.length > 0 &&
    allSubs.every(({ sub }) => openMap[sub.sq.id] ?? sub.status !== 'correct');

  const toggleAll = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const { sub } of allSubs) next[sub.sq.id] = open;
    setOpenMap(next);
  };

  const jumpToSub = (sqId: string) => {
    if (filter === 'wrong') {
      const target = allSubs.find(x => x.sub.sq.id === sqId);
      if (target?.sub.status === 'correct') setFilter('all');
    }
    setOpenMap(prev => ({ ...prev, [sqId]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`ewr-item-${sqId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSave = (problem: Problem, sub: ParsedSubReview) => {
    const key = `${problem.id}:${sub.sq.id}`;
    if (savedNotes[key]) return;
    try {
      saveQuestionNote({
        uid: auth.currentUser?.uid || 'guest',
        chapter,
        question: problem,
        questionIndex: sub.displayNo,
      });
      setSavedNotes(prev => ({ ...prev, [key]: true }));
      notify('学習ノートに保存しました。');
    } catch (err) {
      logRejection('eikenWrittenResult.saveNote')(err);
      notify('ノートの保存に失敗しました。');
    }
  };

  const headerTitle = chapter.realTitle
    ? `${chapter.realTitle.replace(/^大問\d+\s*/, '')}｜${chapter.abstractTitle}`
    : chapter.abstractTitle;
  const durationLabel = fmtDuration(resultTotalTimeSec);
  const coins = studyReward?.coins ?? 0;
  const hasAnyPassage = problemBlocks.some(b => Boolean(b.passage));

  return (
    <div
      className="ecp-root ewr-root"
      data-eiken-written-result
      style={theme.accent ? ({ '--ecp-accent': theme.accent } as React.CSSProperties) : undefined}
    >
      {onReturnToBattle && (
        <button
          type="button"
          onClick={() => triggerAdAndAction(onReturnToBattle)}
          className="ecp-battle-return"
        >
          バトル結果・解説に戻る
        </button>
      )}

      {/* コンパクトな1行ヘッダー */}
      <header className="ecp-head" data-quiz-header>
        <button
          type="button"
          className="ecp-back"
          onClick={() => triggerAdAndAction(onBack)}
          aria-label="単元選択に戻る"
          title="単元選択に戻る"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <span className="ecp-mode ewr-mode-done">結果・解説</span>
        <h2 className="ecp-title">{headerTitle}</h2>
        {onHome && (
          <button
            type="button"
            className="ewr-home-icon-btn"
            onClick={() => triggerAdAndAction(onHome)}
            aria-label="ホームに戻る"
            title="ホームに戻る"
          >
            <Home size={17} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="ecp-scroll" ref={scrollRef}>
        {/* スリムな採点サマリー＋番号ジャンプ＋絞り込みピル */}
        <section
          className="ecp-result ewr-summary-card"
          aria-label="採点結果サマリー"
          data-perfect={totalJudgeable > 0 && totalCorrect === totalJudgeable ? true : undefined}
        >
          <div className="ewr-summary-main">
            <div className="ewr-score-block">
              <CheckCircle2 size={20} className="ewr-score-icon" aria-hidden="true" />
              <span className="ewr-score-fraction">
                <b>{totalCorrect}</b>
                <small>/{totalJudgeable}問正解</small>
              </span>
              <span className="ewr-score-pct">{accuracyPct}%</span>
              {totalJudgeable > 0 && totalCorrect === totalJudgeable && (
                <span className="ecp-perfect-pill">PERFECT!</span>
              )}
              {durationLabel && (
                <span className="ewr-time-pill">
                  <Clock size={12} aria-hidden="true" />
                  {durationLabel}
                </span>
              )}
              {!isGuest && coins > 0 && (
                <span className="ewr-coin-pill">
                  <Coins size={12} aria-hidden="true" />+{coins}
                </span>
              )}
            </div>

            <div className="ecp-result-tools">
              {wrongOrBlankItems.length > 0 && (
                <div className="ecp-result-filter" role="group" aria-label="表示の絞り込み">
                  <button
                    type="button"
                    className="ecp-tool-pill"
                    data-active={filter === 'all' || undefined}
                    onClick={() => setFilter('all')}
                  >
                    全問 ({allSubs.length})
                  </button>
                  <button
                    type="button"
                    className="ecp-tool-pill"
                    data-active={filter === 'wrong' || undefined}
                    onClick={() => setFilter('wrong')}
                  >
                    誤答のみ ({wrongOrBlankItems.length})
                  </button>
                </div>
              )}
              <button
                type="button"
                className="ecp-tool-pill is-ghost"
                onClick={() => toggleAll(!allOpen)}
              >
                {allOpen ? '解説をすべて閉じる' : '解説をすべて開く'}
              </button>
            </div>
          </div>

          {allSubs.length > 1 && (
            <ol className="ewr-jump-strip" aria-label="問題ごとの正誤（タップで移動）">
              {allSubs.map(({ sub }) => (
                <li key={sub.sq.id}>
                  <button
                    type="button"
                    className="ewr-jump-chip"
                    data-result={sub.status}
                    onClick={() => jumpToSub(sub.sq.id)}
                    aria-label={`問${sub.displayNo} ${
                      sub.status === 'correct' ? '正解' : sub.status === 'wrong' ? '不正解' : '未回答'
                    }`}
                  >
                    <span>{sub.displayNo}</span>
                    <b aria-hidden="true">
                      {sub.status === 'correct' ? '○' : sub.status === 'wrong' ? '×' : '−'}
                    </b>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {!isGuest && (
          <StudentBatchResultSubmitBar
            chapterId={chapter.id}
            chapterTitle={headerTitle}
            items={allSubs.map(({ problem, sub }) => ({
              problemId: problem.id,
              subQuestionId: sub.sq.id,
              displayNo: sub.displayNo,
              correct: sub.status === 'correct',
            }))}
          />
        )}

        {/* 問題画面そのままのコンパクト解説カード一覧 */}
        {hasAnyPassage ? (
          <div className="ewr-passage-groups">
            {problemBlocks.map(({ problem, passage, subs }) => {
              const visibleSubs = filter === 'wrong' ? subs.filter(s => s.status !== 'correct') : subs;
              if (visibleSubs.length === 0) return null;
              const trOpen = openPassageTr[problem.id] ?? false;

              return (
                <section key={problem.id} className="ewr-passage-group" data-passage-group={problem.id}>
                  {passage && (
                    <div className="ewr-passage-card">
                      <div className="ewr-passage-head">
                        <h3 className="ewr-passage-title" lang="en">
                          {formatText(passage.title, [], { prose: true, noMath: true })}
                        </h3>
                        {passage.translation && (
                          <button
                            type="button"
                            className="ewr-tr-toggle"
                            aria-expanded={trOpen}
                            onClick={() => setOpenPassageTr(prev => ({ ...prev, [problem.id]: !trOpen }))}
                          >
                            <span>{trOpen ? '和訳を閉じる' : `${passage.translationLabel}を見る`}</span>
                            <ChevronDown
                              size={14}
                              className={`ecp-fold-chev${trOpen ? ' is-open' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                      <PassageBodyWithAnswers
                        passage={passage}
                        subs={subs}
                        activeEvidences={
                          activeEvMap[problem.id]
                            ? subs.find(s => s.sq.id === activeEvMap[problem.id])?.evidencePhrases ?? []
                            : []
                        }
                      />
                      {passage.translation && trOpen && (
                        <div className="ewr-passage-ja">
                          <span className="ewr-passage-ja-tag">【{passage.translationLabel}】</span>
                          <p>{formatText(passage.translation, [], { prose: true, noMath: true })}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ewr-cards-col">
                    {visibleSubs.map(sub => {
                      const isOpen = openMap[sub.sq.id] ?? sub.status !== 'correct';
                      const noteKey = `${problem.id}:${sub.sq.id}`;
                      return (
                        <SubReviewCard
                          key={sub.sq.id}
                          problem={problem}
                          chapter={chapter}
                          sub={sub}
                          hasPassage={Boolean(passage)}
                          isOpen={isOpen}
                          onToggleOpen={next => setOpenMap(prev => ({ ...prev, [sub.sq.id]: next }))}
                          saved={Boolean(savedNotes[noteKey])}
                          onSaveNote={() => void handleSave(problem, sub)}
                          evidenceActive={activeEvMap[problem.id] === sub.sq.id}
                          onShowEvidence={
                            passage && sub.evidencePhrases.length > 0
                              ? () => {
                                  const nextSq = activeEvMap[problem.id] === sub.sq.id ? null : sub.sq.id;
                                  setActiveEvMap(prev => ({ ...prev, [problem.id]: nextSq }));
                                  if (nextSq) {
                                    window.requestAnimationFrame(() =>
                                      window.requestAnimationFrame(() => {
                                        scrollRef.current
                                          ?.querySelector(`[data-passage-group="${problem.id}"] [data-eiken-ev]`)
                                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }),
                                    );
                                  }
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="ecp-list ewr-grid-list">
            {problemBlocks.flatMap(({ problem, subs }) =>
              subs
                .filter(sub => (filter === 'wrong' ? sub.status !== 'correct' : true))
                .map(sub => {
                  const isOpen = openMap[sub.sq.id] ?? (allSubs.length === 1 || sub.status !== 'correct');
                  const noteKey = `${problem.id}:${sub.sq.id}`;
                  return (
                    <SubReviewCard
                      key={sub.sq.id}
                      problem={problem}
                      chapter={chapter}
                      sub={sub}
                      hasPassage={false}
                      isOpen={isOpen}
                      onToggleOpen={next => setOpenMap(prev => ({ ...prev, [sub.sq.id]: next }))}
                      saved={Boolean(savedNotes[noteKey])}
                      onSaveNote={() => void handleSave(problem, sub)}
                    />
                  );
                }),
            )}
          </div>
        )}
      </div>

      {/* 3段フッターを廃止し、問題画面と揃えた高さ56pxの1行コンパクトフッター */}
      <footer className="ecp-foot ewr-foot">
        <button
          type="button"
          className="ecp-btn ecp-btn-sub"
          onClick={() => triggerAdAndAction(onBack)}
        >
          <ChevronLeft size={17} aria-hidden="true" />
          <span>単元一覧</span>
        </button>

        {wrongTargets.length > 0 && onRetryWrong && (
          <button
            type="button"
            className="ewr-retry-btn"
            onClick={() => triggerAdAndAction(() => onRetryWrong(chapter.id, wrongTargets))}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>誤答だけ解き直す ({wrongOrBlankItems.length})</span>
          </button>
        )}

        <button
          type="button"
          className="ecp-btn ecp-btn-main"
          data-ready
          onClick={handlePrimaryNext}
        >
          <span>{primaryNextLabel}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}
