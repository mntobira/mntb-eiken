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

  const handleGenerateAssignmentFromPlacement = (band: 'A_STANDARD_GRADE2' | 'B_BRIDGE_PRE2PLUS_4W' | 'C_FOUNDATION_PRE2_8W') => {
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
    <section
      aria-label="すごろく語彙診断・週次確認テスト"
      style={{
        border: '1px solid #d4d4d8',
        borderRadius: 12,
        padding: 16,
        background: '#ffffff',
        color: '#18181b',
        display: 'grid',
        gap: 14,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid #e4e4e7',
          paddingBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#52525b' }}>
            {track === 'placementDiagnostic25'
              ? '入塾初回 15分ステージ診断（A判定:14点〜 ／ B判定:10〜13点 ／ C判定:0〜9点）'
              : 'すごろく塾 ペースメーカー確認テスト（合格基準 16 / 20点＝80%）'}
            {studentName ? ` ｜ 受験者：${studentName}` : ''}
          </div>
          <h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 800 }}>
            {TRACK_LABELS[track]}
            {track !== 'placementDiagnostic25' ? ` — 第${currentQuiz.week}回` : ''}
          </h3>
          <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>{currentQuiz.theme}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            aria-label="テスト種別選択"
            value={track}
            onChange={e => handleTrackChange(e.target.value as SugorokuQuizTrack)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #a1a1aa', fontSize: 13 }}
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
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #a1a1aa', fontSize: 13 }}
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
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #27272a',
              background: showPlacementHelper ? '#27272a' : '#f4f4f5',
              color: showPlacementHelper ? '#ffffff' : '#18181b',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            印刷PDF全6冊棚・処方シミュレーター
          </button>
        </div>
      </header>

      {showPlacementHelper && (
        <aside
          aria-label="初回診断振り分けとPDF教材棚"
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            padding: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              紙の診断テスト正答率から即判定：
              <input
                type="number"
                min={0}
                max={100}
                value={diagInput}
                onChange={e => setDiagInput(Number(e.target.value))}
                style={{ width: 64, marginLeft: 6, padding: '3px 6px', borderRadius: 6, border: '1px solid #94a3b8' }}
              />{' '}
              %
            </label>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: '#18181b',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {placementPreview.label}
            </span>
            <button
              type="button"
              onClick={() => handleGenerateAssignmentFromPlacement(placementPreview.band)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #18181b',
                background: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              この判定の初週宿題を作成（4日進行＋2日調整）
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#334155' }}>{placementPreview.summaryForCoach}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGOROKU_CURRICULUM_PDF_SHELF.map(pdf => (
              <a
                key={pdf.id}
                href={pdf.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  color: '#0f172a',
                  background: '#ffffff',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                PDF: {pdf.title.split('（')[0]}（{pdf.pages}p）
              </a>
            ))}
          </div>
        </aside>
      )}

      {emittedAssignment && (
        <div
          role="status"
          style={{
            padding: 10,
            borderRadius: 8,
            border: '1px solid #0f172a',
            background: '#f1f5f9',
            fontSize: 12.5,
          }}
        >
          <strong>週次宿題ペイロード生成済み：</strong> {emittedAssignment.title} ｜ 1日目安{' '}
          <strong>{emittedAssignment.dailyQuotaProblems}問</strong>（Reading {emittedAssignment.skillBreakdown.reading}問・
          Listening {emittedAssignment.skillBreakdown.listening}問・厳選単語 {emittedAssignment.skillBreakdown.vocab}語）
        </div>
      )}

      {result && (
        <div
          role="status"
          style={{
            padding: 14,
            borderRadius: 10,
            border: `2px solid ${result.passed ? '#15803d' : '#b91c1c'}`,
            background: result.passed ? '#f0fdf4' : '#fef2f2',
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 16, color: result.passed ? '#166534' : '#991b1b' }}>
              得点：{result.score} / {result.total} 点
              {result.diagnosticBreakdown
                ? `（${result.diagnosticBreakdown.percent}%） — ${result.diagnosticBreakdown.placement.label}`
                : ` — ${result.passed ? '合格（80%基準クリア！）' : '再演習・再テスト対象（16点未満）'}`}
            </strong>

            {result.diagnosticBreakdown && (
              <button
                type="button"
                onClick={() => handleGenerateAssignmentFromPlacement(result.diagnosticBreakdown!.placement.band)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#18181b',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                推奨ルートの初週宿題を配信する
              </button>
            )}

            {result.nextAction === 'RETEST_FORM_B_REQUIRED' && (
              <button
                type="button"
                onClick={handleStartFormBRetest}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#991b1b',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                別フォーム［Form B］で再テストを実施する
              </button>
            )}
          </div>

          {result.diagnosticBreakdown && (
            <div style={{ fontSize: 12.5, color: '#1e293b' }}>
              <strong>3層別内訳：</strong> 準2級基礎 {result.diagnosticBreakdown.pre2FoundationCorrect}/
              {result.diagnosticBreakdown.pre2FoundationTotal}点 ｜ 準2プラス橋渡し{' '}
              {result.diagnosticBreakdown.pre2PlusBridgeCorrect}/{result.diagnosticBreakdown.pre2PlusBridgeTotal}点 ｜
              2級コア {result.diagnosticBreakdown.grade2CoreCorrect}/{result.diagnosticBreakdown.grade2CoreTotal}点
              <div style={{ marginTop: 4 }}>{result.diagnosticBreakdown.placement.summaryForCoach}</div>
            </div>
          )}

          {result.missedWordsSummary.length > 0 && (
            <div style={{ fontSize: 12.5, color: '#27272a' }}>
              <strong>要復習リスト（音読3回推奨）：</strong>{' '}
              {result.missedWordsSummary.map(m => `${m.word}（${m.meaning}）`).join(' ／ ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {currentQuiz.items.map((item, idx) => {
          const isPartA = item.no <= 12;
          const choices = isPartA ? item.choicesJa : item.choicesEn;
          const correctIdx = isPartA ? item.answerIndexJa : item.answerIndexEn;
          const pickedIdx = selected[idx];

          return (
            <div
              key={`${track}-${currentQuiz.week}-${item.id}`}
              style={{
                border: '1px solid #e4e4e7',
                borderRadius: 8,
                padding: '10px 12px',
                background: idx % 2 === 1 ? '#fafafa' : '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  <span style={{ display: 'inline-block', minWidth: 28, color: '#52525b' }}>Q{item.no}.</span>
                  {isPartA ? (
                    <>
                      <span style={{ fontSize: 15, marginRight: 8 }}>{item.word}</span>
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#52525b' }}>{item.exampleSentence}</span>
                    </>
                  ) : (
                    <>
                      <span>{item.clozeSentence}</span>
                      <span style={{ fontSize: 12, fontWeight: 400, color: '#52525b', marginLeft: 6 }}>
                        （{item.exampleTranslation}）
                      </span>
                    </>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap' }}>
                  {isPartA ? 'Part A 意味' : 'Part B 空所4択'} · {item.tierLabel}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 6 }}>
                {choices.map((choiceText, cIdx) => {
                  const isChosen = pickedIdx === cIdx;
                  const showCorrect = result !== null && cIdx === correctIdx;
                  const showWrong = result !== null && isChosen && cIdx !== correctIdx;
                  return (
                    <button
                      key={`${item.id}-${cIdx}`}
                      type="button"
                      disabled={result !== null}
                      onClick={() => setSelected(prev => ({ ...prev, [idx]: cIdx }))}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: showCorrect
                          ? '2px solid #15803d'
                          : showWrong
                            ? '2px solid #b91c1c'
                            : isChosen
                              ? '2px solid #18181b'
                              : '1px solid #d4d4d8',
                        background: showCorrect
                          ? '#dcfce7'
                          : showWrong
                            ? '#fee2e2'
                            : isChosen
                              ? '#f4f4f5'
                              : '#ffffff',
                        fontSize: 13,
                        fontWeight: isChosen || showCorrect ? 700 : 400,
                        cursor: result !== null ? 'default' : 'pointer',
                      }}
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

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12.5, color: '#52525b' }}>
          解答済み：{answeredCount} / {currentQuiz.items.length} 問
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {result !== null && (
            <button
              type="button"
              onClick={() => {
                setSelected({});
                setResult(null);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #71717a',
                background: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              リセット
            </button>
          )}
          <button
            type="button"
            disabled={!allAnswered || result !== null}
            onClick={handleSubmit}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: allAnswered && result === null ? '#18181b' : '#a1a1aa',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: allAnswered && result === null ? 'pointer' : 'not-allowed',
            }}
          >
            {track === 'placementDiagnostic25' ? 'ステージ診断を実行する（A/B/C判定）' : '採点する（16点合格判定）'}
          </button>
        </div>
      </footer>
    </section>
  );
};
