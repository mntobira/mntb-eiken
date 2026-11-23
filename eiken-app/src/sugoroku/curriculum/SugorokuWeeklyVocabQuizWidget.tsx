import React, { useMemo, useState } from 'react';
import {
  SUGOROKU_CURRICULUM_PDF_SHELF,
  SUGOROKU_ENTRY_DIAGNOSTIC_TEST,
  SUGOROKU_WEEKLY_QUIZ_BANKS,
  buildSugorokuWeeklyAssignmentPayload,
  evaluateSugorokuPlacement,
  gradeSugorokuWeeklyQuiz,
  type SugorokuCompatibleAssignmentPayload,
  type SugorokuOnlineQuizGradingResult,
  type SugorokuQuizTrack,
  type SugorokuWeeklyQuizData,
} from './index';
import './sugoroku-vocab-quiz.css';

export interface SugorokuWeeklyVocabQuizWidgetProps {
  initialTrack?: SugorokuQuizTrack;
  initialWeek?: number;
  studentName?: string;
  classId?: string;
  teacherUid?: string;
  targetStudentUids?: string[];
  /** 不合格・診断完了時にミス単語ID配列を忘却曲線復習リスト（reviewList）へ送るコールバック */
  onRegisterMissedWordIds?: (missedWordIds: string[], result: SugorokuOnlineQuizGradingResult) => void;
  /** 採点完了時に親画面（生徒詳細ログや宿題カード）へ結果を通知するコールバック */
  onQuizCompleted?: (result: SugorokuOnlineQuizGradingResult) => void;
  /** 診断判定または選択回次から AI 2 互換の週次宿題ペイロードをワンクリック発行するコールバック */
  onAssignRecommendedHomework?: (payload: SugorokuCompatibleAssignmentPayload) => void;
}

const TRACK_LABELS: Record<SugorokuQuizTrack, string> = {
  placementDiagnostic25: '入塾初回15分 2級スタートライン診断（全25問）',
  grade2FormA: '英検2級 週次確認テスト［本試験 Form A］（全12回）',
  grade2FormB: '英検2級 週次確認テスト［再試 Form B］（全12回）',
  pre2PlusBridge: '準2級プラス 橋渡し確認テスト（全4回）',
  pre2Foundation: '英検準2級 基礎土台テスト（全4回）',
};

/**
 * すごろく塾 週次単語20問テスト＆入塾初回25問ステージ診断 UI コンポーネント（競合ゼロ独立部品）
 * - `placementDiagnostic25`：準2級基礎8問＋準2プラス橋渡し8問＋2級コア9問で A/B/C ステージを自動判定し、推奨初週宿題を即発行
 * - `grade2FormA` / `grade2FormB` / `pre2PlusBridge` / `pre2Foundation`：Part A 意味4択12問 ＋ Part B 空所4択8問（16/20点合格）
 */
export const SugorokuWeeklyVocabQuizWidget: React.FC<SugorokuWeeklyVocabQuizWidgetProps> = ({
  initialTrack = 'grade2FormA',
  initialWeek = 1,
  studentName,
  classId = 'sugoroku_default_class',
  teacherUid = 'sugoroku_coach',
  targetStudentUids,
  onRegisterMissedWordIds,
  onQuizCompleted,
  onAssignRecommendedHomework,
}) => {
  const [track, setTrack] = useState<SugorokuQuizTrack>(initialTrack);
  const availableQuizzes: SugorokuWeeklyQuizData[] = useMemo(
    () =>
      track === 'placementDiagnostic25'
        ? [SUGOROKU_ENTRY_DIAGNOSTIC_TEST]
        : SUGOROKU_WEEKLY_QUIZ_BANKS[track],
    [track],
  );
  const [week, setWeek] = useState<number>(
    availableQuizzes.some(q => q.week === initialWeek) ? initialWeek : availableQuizzes[0]?.week ?? 1,
  );
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [result, setResult] = useState<SugorokuOnlineQuizGradingResult | null>(null);
  const [diagInput, setDiagInput] = useState<number>(48);
  const [showPlacementHelper, setShowPlacementHelper] = useState<boolean>(false);
  const [emittedAssignment, setEmittedAssignment] = useState<SugorokuCompatibleAssignmentPayload | null>(null);

  const currentQuiz = useMemo(
    () => availableQuizzes.find(q => q.week === week) ?? availableQuizzes[0],
    [availableQuizzes, week],
  );

  const placementPreview = useMemo(() => evaluateSugorokuPlacement(diagInput), [diagInput]);

  const handleTrackChange = (nextTrack: SugorokuQuizTrack) => {
    setTrack(nextTrack);
    const nextBank =
      nextTrack === 'placementDiagnostic25'
        ? [SUGOROKU_ENTRY_DIAGNOSTIC_TEST]
        : SUGOROKU_WEEKLY_QUIZ_BANKS[nextTrack];
    const validWeek = nextBank.some(q => q.week === week) ? week : nextBank[0]?.week ?? 0;
    setWeek(validWeek);
    setSelected({});
    setResult(null);
    setEmittedAssignment(null);
  };

  const handleWeekChange = (nextWeek: number) => {
    setWeek(nextWeek);
    setSelected({});
    setResult(null);
    setEmittedAssignment(null);
  };

  const answeredCount = Object.keys(selected).length;
  const allAnswered = currentQuiz ? answeredCount === currentQuiz.items.length : false;

  const handleSubmit = () => {
    if (!currentQuiz) return;
    const answersArray = currentQuiz.items.map((_, idx) => selected[idx] ?? -1);
    const graded = gradeSugorokuWeeklyQuiz(track, currentQuiz.week, answersArray);
    setResult(graded);
    onQuizCompleted?.(graded);
    if (graded.missedWordIds.length > 0) {
      onRegisterMissedWordIds?.(graded.missedWordIds, graded);
    }
  };

  const handleStartFormBRetest = () => {
    setTrack('grade2FormB');
    setSelected({});
    setResult(null);
    setEmittedAssignment(null);
  };

  const handleGenerateAssignmentFromPlacement = (
    band: 'A_STANDARD_GRADE2' | 'B_BRIDGE_PRE2PLUS_4W' | 'C_FOUNDATION_PRE2_8W',
  ) => {
    const payload =
      band === 'A_STANDARD_GRADE2'
        ? buildSugorokuWeeklyAssignmentPayload({
            classId,
            teacherUid,
            mode: 'grade2_12w',
            stepNumber: 1,
            targetStudentUids,
          })
        : band === 'B_BRIDGE_PRE2PLUS_4W'
          ? buildSugorokuWeeklyAssignmentPayload({
              classId,
              teacherUid,
              mode: 'bridge_8stage',
              stepNumber: 5,
              targetStudentUids,
            })
          : buildSugorokuWeeklyAssignmentPayload({
              classId,
              teacherUid,
              mode: 'bridge_8stage',
              stepNumber: 1,
              targetStudentUids,
            });
    setEmittedAssignment(payload);
    onAssignRecommendedHomework?.(payload);
  };

  if (!currentQuiz) return null;

  return (
    <section aria-label="すごろく語彙診断・週次確認テスト" className="svqw-root">
      <header className="svqw-header">
        <div>
          <div className="svqw-eyebrow">
            {track === 'placementDiagnostic25'
              ? '入塾初回 15分ステージ診断（A判定:14点〜 ／ B判定:10〜13点 ／ C判定:0〜9点）'
              : 'すごろく塾 ペースメーカー確認テスト（合格基準 16 / 20点＝80%）'}
            {studentName ? ` ｜ 受験者：${studentName}` : ''}
          </div>
          <h3 className="svqw-title">
            {TRACK_LABELS[track]}
            {track !== 'placementDiagnostic25' ? ` — 第${currentQuiz.week}回` : ''}
          </h3>
          <div className="svqw-theme">{currentQuiz.theme}</div>
        </div>

        <div className="svqw-controls">
          <select
            aria-label="テスト種別選択"
            value={track}
            onChange={e => handleTrackChange(e.target.value as SugorokuQuizTrack)}
            className="svqw-select"
          >
            {(Object.keys(TRACK_LABELS) as SugorokuQuizTrack[]).map(k => (
              <option key={k} value={k}>
                {TRACK_LABELS[k]}
              </option>
            ))}
          </select>

          {track !== 'placementDiagnostic25' && (
            <select
              aria-label="回次選択"
              value={currentQuiz.week}
              onChange={e => handleWeekChange(Number(e.target.value))}
              className="svqw-select"
            >
              {availableQuizzes.map(q => (
                <option key={q.week} value={q.week}>
                  第{q.week}回（{q.phase.split('：')[1] ?? q.phase}）
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowPlacementHelper(v => !v)}
            className="svqw-shelf-toggle"
            data-active={showPlacementHelper ? 'true' : 'false'}
          >
            印刷PDF全6冊棚・処方シミュレーター
          </button>
        </div>
      </header>

      {showPlacementHelper && (
        <aside aria-label="初回診断振り分けとPDF教材棚" className="svqw-shelf-aside">
          <div className="svqw-shelf-row">
            <label className="svqw-diag-label">
              紙の診断テスト正答率から即判定：
              <input
                type="number"
                min={0}
                max={100}
                value={diagInput}
                onChange={e => setDiagInput(Number(e.target.value))}
                className="svqw-diag-input"
              />{' '}
              %
            </label>
            <span className="svqw-band-badge">{placementPreview.label}</span>
            <button
              type="button"
              onClick={() => handleGenerateAssignmentFromPlacement(placementPreview.band)}
              className="svqw-assign-outline-btn"
            >
              この判定の初週宿題を作成（4日進行＋2日調整）
            </button>
          </div>
          <p className="svqw-coach-summary">{placementPreview.summaryForCoach}</p>
          <div className="svqw-pdf-links">
            {SUGOROKU_CURRICULUM_PDF_SHELF.map(pdf => (
              <a
                key={pdf.id}
                href={pdf.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="svqw-pdf-link"
              >
                PDF: {pdf.title.split('（')[0]}（{pdf.pages}p）
              </a>
            ))}
          </div>
        </aside>
      )}

      {emittedAssignment && (
        <div role="status" className="svqw-emitted-box">
          <strong>週次宿題ペイロード生成済み：</strong> {emittedAssignment.title} ｜ 1日目安{' '}
          <strong>{emittedAssignment.dailyQuotaProblems}問</strong>（Reading {emittedAssignment.skillBreakdown.reading}問・
          Listening {emittedAssignment.skillBreakdown.listening}問・厳選単語 {emittedAssignment.skillBreakdown.vocab}語）
        </div>
      )}

      {result && (
        <div role="status" className="svqw-result-box" data-passed={result.passed ? 'true' : 'false'}>
          <div className="svqw-result-head">
            <strong className="svqw-result-score">
              得点：{result.score} / {result.total} 点
              {result.diagnosticBreakdown
                ? `（${result.diagnosticBreakdown.percent}%） — ${result.diagnosticBreakdown.placement.label}`
                : ` — ${result.passed ? '合格（80%基準クリア！）' : '再演習・再テスト対象（16点未満）'}`}
            </strong>

            {result.diagnosticBreakdown && (
              <button
                type="button"
                onClick={() => handleGenerateAssignmentFromPlacement(result.diagnosticBreakdown!.placement.band)}
                className="svqw-action-dark-btn"
              >
                推奨ルートの初週宿題を配信する
              </button>
            )}

            {result.nextAction === 'RETEST_FORM_B_REQUIRED' && (
              <button type="button" onClick={handleStartFormBRetest} className="svqw-action-danger-btn">
                別フォーム［Form B］で再テストを実施する
              </button>
            )}
          </div>

          {result.diagnosticBreakdown && (
            <div className="svqw-breakdown">
              <strong>3層別内訳：</strong> 準2級基礎 {result.diagnosticBreakdown.pre2FoundationCorrect}/
              {result.diagnosticBreakdown.pre2FoundationTotal}点 ｜ 準2プラス橋渡し{' '}
              {result.diagnosticBreakdown.pre2PlusBridgeCorrect}/{result.diagnosticBreakdown.pre2PlusBridgeTotal}点 ｜
              2級コア {result.diagnosticBreakdown.grade2CoreCorrect}/{result.diagnosticBreakdown.grade2CoreTotal}点
              <div className="svqw-breakdown-note">{result.diagnosticBreakdown.placement.summaryForCoach}</div>
            </div>
          )}

          {result.missedWordsSummary.length > 0 && (
            <div className="svqw-missed">
              <strong>要復習リスト（音読3回推奨）：</strong>{' '}
              {result.missedWordsSummary.map(m => `${m.word}（${m.meaning}）`).join(' ／ ')}
            </div>
          )}
        </div>
      )}

      <div className="svqw-list">
        {currentQuiz.items.map((item, idx) => {
          const isPartA = item.no <= 12;
          const choices = isPartA ? item.choicesJa : item.choicesEn;
          const correctIdx = isPartA ? item.answerIndexJa : item.answerIndexEn;
          const pickedIdx = selected[idx];

          return (
            <div
              key={`${track}-${currentQuiz.week}-${item.id}`}
              className="svqw-card"
              data-odd={idx % 2 === 1 ? 'true' : 'false'}
            >
              <div className="svqw-q-head">
                <div className="svqw-q-stem">
                  <span className="svqw-q-no">Q{item.no}.</span>
                  {isPartA ? (
                    <>
                      <span className="svqw-q-word">{item.word}</span>
                      <span className="svqw-q-sub">{item.exampleSentence}</span>
                    </>
                  ) : (
                    <>
                      <span>{item.clozeSentence}</span>
                      <span className="svqw-q-sub-gap">（{item.exampleTranslation}）</span>
                    </>
                  )}
                </div>
                <span className="svqw-q-meta">
                  {isPartA ? 'Part A 意味' : 'Part B 空所4択'} · {item.tierLabel}
                </span>
              </div>

              <div className="svqw-choices">
                {choices.map((choiceText, cIdx) => {
                  const isChosen = pickedIdx === cIdx;
                  const showCorrect = result !== null && cIdx === correctIdx;
                  const showWrong = result !== null && isChosen && cIdx !== correctIdx;
                  const state = showCorrect
                    ? 'correct'
                    : showWrong
                      ? 'wrong'
                      : isChosen
                        ? 'chosen'
                        : 'idle';
                  return (
                    <button
                      key={`${item.id}-${cIdx}`}
                      type="button"
                      disabled={result !== null}
                      onClick={() => setSelected(prev => ({ ...prev, [idx]: cIdx }))}
                      className="svqw-choice-btn"
                      data-state={state}
                    >
                      {cIdx + 1}. {choiceText}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="svqw-footer">
        <span className="svqw-progress">
          解答済み：{answeredCount} / {currentQuiz.items.length} 問
        </span>
        <div className="svqw-footer-actions">
          {result !== null && (
            <button
              type="button"
              onClick={() => {
                setSelected({});
                setResult(null);
              }}
              className="svqw-reset-btn"
            >
              リセット
            </button>
          )}
          <button
            type="button"
            disabled={!allAnswered || result !== null}
            onClick={handleSubmit}
            className="svqw-submit-btn"
          >
            {track === 'placementDiagnostic25' ? 'ステージ診断を実行する（A/B/C判定）' : '採点する（16点合格判定）'}
          </button>
        </div>
      </footer>
    </section>
  );
};
