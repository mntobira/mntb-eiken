import React, { useState } from 'react';
import { ChevronDown, Play, RotateCcw } from 'lucide-react';
import type { Chapter } from '../types/curriculum';
import type { EikenDaimonGroup } from './daimonCatalog';
import { problemKey } from '../utils/progress';
import { quizAnswersKey, quizExplKey, quizIndexKey, quizRunKey } from '../utils/quizStorageKeys';
import { safeGetItem, safeParseJson } from '../utils/safeLocalStorage';
import { STAGE_CLEAR_PERFECTS, isStageCleared, stageKey, type StageRecord } from '../utils/stageRecords';
import { accuracyOf, type UnitStatsMap, type UnitStatus } from '../utils/unitStats';
import './eiken-daimon.css';

export interface EikenDaimonSectionProps {
  daimonGroups: readonly EikenDaimonGroup[];
  mode: 'mini_test' | 'practice';
  accent: string;
  solvedMap: Readonly<Record<string, unknown>>;
  stageRecords: Readonly<Record<string, StageRecord>>;
  unitStats: UnitStatsMap;
  onSelectChapter: (
    id: string,
    questionIndex?: number,
    resume?: boolean,
    range?: { startIndex: number; endIndex: number } | null,
  ) => void;
}

interface RoundInfo {
  round: number;
  chapter: Chapter;
  questionCount: number;
  savedIndex: number;
  hasSavedProgress: boolean;
  solvedCount: number;
  status: UnitStatus;
  accuracy: number | null;
  perfects: number;
}

function computeRoundInfo(
  round: number,
  chapter: Chapter,
  mode: 'mini_test' | 'practice',
  solvedMap: Readonly<Record<string, unknown>>,
  stageRecords: Readonly<Record<string, StageRecord>>,
  unitStats: UnitStatsMap,
): RoundInfo {
  const questions = mode === 'mini_test' ? (chapter.miniTest || []) : (chapter.practiceProblems || []);
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
      Object.keys(safeParseJson<object>(safeGetItem(quizAnswersKey(chapter.id, mode)), {}) ?? {}).length > 0);
  const solvedCount = questions.filter((q) => solvedMap[problemKey(chapter.id, q.id)]).length;
  const stat = unitStats[chapter.id];
  const stage = stageRecords[stageKey(chapter.id)];
  const status: UnitStatus = isStageCleared(stage)
    ? 'done'
    : solvedCount > 0 || hasSavedProgress || !!stat || !!stage
      ? 'doing'
      : 'todo';
  return {
    round,
    chapter,
    questionCount: questions.length,
    savedIndex,
    hasSavedProgress,
    solvedCount,
    status,
    accuracy: accuracyOf(stat),
    perfects: stage?.p ?? 0,
  };
}

export function EikenDaimonSection({
  daimonGroups,
  mode,
  accent,
  solvedMap,
  stageRecords,
  unitStats,
  onSelectChapter,
}: EikenDaimonSectionProps) {
  // 最初の大問（または途中保存がある大問）を最初から開いておき、「大問構成＋第1〜15回」がひと目で伝わるようにする
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (daimonGroups[0]) initial[daimonGroups[0].spec.section] = true;
    return initial;
  });

  if (daimonGroups.length === 0) return null;

  const firstSpec = daimonGroups[0].spec;
  const totalMarksPerRound = daimonGroups.reduce((sum, g) => sum + g.spec.count, 0);

  return (
    <div
      className="eiken-daimon-wrap"
      data-eiken-daimon-list
      style={{ '--daimon-accent': accent } as React.CSSProperties}
    >
      <div className="eiken-daimon-summary" aria-label="大問構成の案内">
        <div className="eiken-daimon-summary-head">
          <span className="eiken-daimon-summary-badge">{firstSpec.scopeLabel} 大問別演習</span>
          <span className="eiken-daimon-summary-meta">
            このタブの対象：{daimonGroups.map((g) => `${g.spec.daimonLabel}（${g.spec.count}問）`).join('＋')} ／ 各大問 第1〜15回（計{totalMarksPerRound * 15}問）
          </span>
        </div>
        <div className="eiken-daimon-pills" role="list" aria-label="このタブの大問一覧">
          {daimonGroups.map(({ spec }) => (
            <button
              key={spec.section}
              type="button"
              role="listitem"
              className="eiken-daimon-pill"
              data-open={openSections[spec.section] ? 'true' : undefined}
              onClick={() => {
                setOpenSections((prev) => ({ ...prev, [spec.section]: true }));
                document.getElementById(`eiken-daimon-card-${spec.section}`)?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                });
              }}
            >
              <strong>{spec.daimonLabel}</strong>
              <span>{spec.sectionTitle}</span>
              <small>問{spec.startQuestion}〜{spec.endQuestion}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="eiken-daimon-cards">
        {daimonGroups.map(({ spec, rounds }) => {
          const roundInfos = rounds.map((r) =>
            computeRoundInfo(r.round, r.chapter, mode, solvedMap, stageRecords, unitStats),
          );
          const clearedCount = roundInfos.filter((r) => r.status === 'done').length;
          const touchedCount = roundInfos.filter((r) => r.status !== 'todo').length;

          // 次に解くおすすめの回：①途中保存がある最初の回 → ②未着手の最初の回 → ③未達成の最初の回 → ④第1回
          const savedTarget = roundInfos.find((r) => r.hasSavedProgress);
          const todoTarget = roundInfos.find((r) => r.status === 'todo');
          const unClearedTarget = roundInfos.find((r) => r.status !== 'done');
          const primaryTarget = savedTarget ?? todoTarget ?? unClearedTarget ?? roundInfos[0];

          // 大問全体の合算正答率
          let totalCorrect = 0;
          let totalAttempts = 0;
          for (const r of roundInfos) {
            const st = unitStats[r.chapter.id];
            if (st && st.t > 0) {
              totalCorrect += st.c;
              totalAttempts += st.t;
            }
          }
          const overallAcc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
          const cardStatus: UnitStatus =
            clearedCount === roundInfos.length && roundInfos.length > 0
              ? 'done'
              : touchedCount > 0
                ? 'doing'
                : 'todo';

          const isOpen = !!openSections[spec.section];
          const panelId = `eiken-daimon-panel-${spec.section}`;

          return (
            <article
              key={spec.section}
              id={`eiken-daimon-card-${spec.section}`}
              className="eiken-daimon-card unit-card"
              data-daimon-section={spec.section}
              data-daimon-number={spec.daimonNumber}
              data-status={cardStatus}
              data-expanded={isOpen || undefined}
            >
              <div className="eiken-daimon-card-top">
                <button
                  type="button"
                  className="eiken-daimon-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setOpenSections((prev) => ({ ...prev, [spec.section]: !prev[spec.section] }))
                  }
                >
                  <div className="eiken-daimon-title-row">
                    <span className="eiken-daimon-badge">{spec.daimonLabel}</span>
                    <span className="eiken-daimon-title">{spec.sectionTitle}</span>
                    <span className="eiken-daimon-qrange">
                      問{spec.startQuestion}〜{spec.endQuestion}（1回{spec.count}問）
                    </span>
                  </div>
                  <p className="eiken-daimon-desc">{spec.formatNote}</p>
                  <div className="eiken-daimon-progress-row">
                    <span className="mt-status" data-status={cardStatus}>
                      {cardStatus === 'done'
                        ? `全${roundInfos.length}回 達成`
                        : touchedCount > 0
                          ? `進行 ${touchedCount}/${roundInfos.length}回（達成 ${clearedCount}）`
                          : `全${roundInfos.length}回（未着手）`}
                    </span>
                    <span className="eiken-daimon-dots" aria-hidden="true">
                      {roundInfos.map((r) => (
                        <i
                          key={r.chapter.id}
                          data-state={r.status}
                          data-next={r.chapter.id === primaryTarget?.chapter.id ? 'true' : undefined}
                        />
                      ))}
                    </span>
                    <span className="eiken-daimon-acc">
                      {overallAcc === null ? '正答率 —' : `正答率 ${overallAcc}%`}
                    </span>
                    <span className="eiken-daimon-open-hint">
                      {isOpen ? '回を閉じる' : '回を選ぶ'}
                      <ChevronDown size={15} className="eiken-daimon-chev" aria-hidden="true" />
                    </span>
                  </div>
                </button>

                {primaryTarget && (
                  <button
                    type="button"
                    className="unit-card-primary eiken-daimon-primary"
                    data-daimon-primary={spec.section}
                    onClick={() =>
                      primaryTarget.hasSavedProgress
                        ? onSelectChapter(primaryTarget.chapter.id, primaryTarget.savedIndex, true)
                        : onSelectChapter(primaryTarget.chapter.id, 0, false)
                    }
                  >
                    <Play size={15} aria-hidden="true" />
                    <span>
                      {primaryTarget.hasSavedProgress
                        ? `第${primaryTarget.round}回の続き`
                        : clearedCount === roundInfos.length
                          ? `第${primaryTarget.round}回を復習`
                          : `第${primaryTarget.round}回を始める`}
                    </span>
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="eiken-daimon-panel" id={panelId}>
                  <div className="eiken-daimon-panel-head">
                    <span>
                      回を選んで演習（印刷用冊子 第1〜{roundInfos.length}回の{spec.daimonLabel}・問{spec.startQuestion}〜{spec.endQuestion}と共通）
                    </span>
                    <small>満点{STAGE_CLEAR_PERFECTS}回で「達成」</small>
                  </div>
                  <div className="eiken-round-grid" role="list" aria-label={`${spec.daimonLabel} ${spec.sectionTitle} の回一覧`}>
                    {roundInfos.map((info) => {
                      const isRecommended = info.chapter.id === primaryTarget?.chapter.id;
                      const stateLabel =
                        info.status === 'done'
                          ? '達成'
                          : info.hasSavedProgress
                            ? '途中'
                            : info.accuracy !== null
                              ? `${info.accuracy}%`
                              : info.perfects > 0
                                ? `満点${info.perfects}/${STAGE_CLEAR_PERFECTS}`
                                : info.status === 'doing'
                                  ? '挑戦中'
                                  : '未';
                      return (
                        <div
                          key={info.chapter.id}
                          role="listitem"
                          className="eiken-round-cell"
                          data-unit-id={info.chapter.id}
                          data-round={info.round}
                          data-status={info.status}
                          data-recommended={isRecommended ? 'true' : undefined}
                        >
                          <button
                            type="button"
                            className="eiken-round-btn"
                            aria-label={`${spec.daimonLabel} ${spec.sectionTitle} 第${info.round}回（${spec.count}問・${stateLabel}）を${info.hasSavedProgress ? '続きから再開' : '始める'}`}
                            onClick={() =>
                              info.hasSavedProgress
                                ? onSelectChapter(info.chapter.id, info.savedIndex, true)
                                : onSelectChapter(info.chapter.id, 0, false)
                            }
                          >
                            <span className="eiken-round-top">
                              <strong className="eiken-round-num">第{info.round}回</strong>
                              {isRecommended && (
                                <em className="eiken-round-rec">
                                  {info.hasSavedProgress ? '続き' : 'おすすめ'}
                                </em>
                              )}
                            </span>
                            <span className="eiken-round-bottom">
                              <span className="eiken-round-state" data-status={info.status}>
                                {stateLabel}
                              </span>
                              <span className="eiken-round-count">{spec.count}問</span>
                            </span>
                          </button>
                          {info.hasSavedProgress && (
                            <button
                              type="button"
                              className="eiken-round-reset"
                              title={`第${info.round}回を最初から解き直す`}
                              aria-label={`第${info.round}回を最初から解き直す`}
                              onClick={() => onSelectChapter(info.chapter.id, 0, false)}
                            >
                              <RotateCcw size={12} aria-hidden="true" />
                              <span>最初</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
