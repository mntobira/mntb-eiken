/**
 * ===================================================================
 * 観点別評価レポート（先生が「所見」をそのまま書ける形にする）
 * ===================================================================
 *
 * -------------------------------------------------------------------
 * ■ このファイルが解く問題
 * -------------------------------------------------------------------
 * 高校の先生は学期末に、生徒1人ずつについて
 *
 *   ① 3観点（知識・技能／思考・判断・表現／主体的に学習に取り組む態度）
 *      の評価材料を集め、
 *   ② 通知表・指導要録に書く「所見」の文章を書く
 *
 * という作業をする。40人クラスなら所見だけで数時間かかる。
 * このアプリは既に「間違えた後にどう行動したか」まで記録しているので、
 * その証跡を **観点ごとの材料 ＋ 所見の下書き文** に変換する。
 *
 * -------------------------------------------------------------------
 * ■ 誠実さのルール（外してはいけない）
 * -------------------------------------------------------------------
 * 1. 評定（A/B/C）は出さない。出すのは「材料」と「下書き」まで。
 *    評価の主体はあくまで先生である。
 * 2. アプリで測れない観点は、測れないと明記する。
 *    「思考・判断・表現」は本来、記述答案や考察の質で測るもので、
 *    このアプリの操作ログだけでは不十分。誇張して数値化しない。
 * 3. 下書き文は事実（回数・日数・単元名）だけで組み立てる。
 *    「意欲的である」のような人物評は先生が書き足すものであり、
 *    機械が生徒の人格を形容しない。
 *
 * -------------------------------------------------------------------
 * ■ 設計
 * -------------------------------------------------------------------
 * Firebase に依存しない純粋関数のみ。入力は
 *   solved（進捗マップ）・reviewItems（復習リスト）・章カタログ
 * で、studySummary.ts の部品を再利用する。
 */

import type { ReviewItem } from './reviewList';
import type { SolvedMap } from './studySyncCore';
import {
  buildChapterProgressRows,
  summarizeReviewDiscipline,
  buildStudyBaseMetrics,
  buildCsvText,
  toDateKey,
  type ChapterDefinition,
  type ChapterProgressRow,
  type EngagementScore,
  type ReviewDiscipline,
} from './studySummary';

// ===================================================================
// 観点1：知識・技能
// ===================================================================

export interface KnowledgeEvidence {
  /** その科目の大問総数（分母） */
  totalProblems: number;
  /** 解いた大問数 */
  solvedProblems: number;
  /** 到達率 0〜100 */
  ratePercent: number;
  /** 忘却曲線を最後まで登り切った（＝定着した）問題数 */
  mastered: number;
  /** よくできている章（到達率の高い順、着手済みのみ、最大3件） */
  strongChapters: ChapterProgressRow[];
  /** 手が回っていない章（到達率の低い順、最大3件） */
  weakChapters: ChapterProgressRow[];
}

export function buildKnowledgeEvidence(
  chapters: ChapterDefinition[],
  solved: SolvedMap | null | undefined,
  reviewItems: ReviewItem[] | null | undefined,
  masteredBox: number,
  now: number = Date.now(),
): KnowledgeEvidence {
  const rows = buildChapterProgressRows(chapters, solved, reviewItems, now);
  const discipline = summarizeReviewDiscipline(reviewItems, masteredBox, now);

  const totalProblems = rows.reduce((sum, row) => sum + row.totalProblems, 0);
  const solvedProblems = rows.reduce((sum, row) => sum + row.solvedProblems, 0);

  // 「強い章」は着手済み（1問以上解いた）章のみから選ぶ。
  // 未着手の章を「弱い」と言うのは正しいが、
  // 0% の章を「強い」に混ぜると意味が壊れるため。
  const started = rows.filter((row) => row.solvedProblems > 0);
  const strongChapters = [...started]
    .sort((a, b) => b.ratePercent - a.ratePercent || b.solvedProblems - a.solvedProblems)
    .slice(0, 3);
  const weakChapters = [...rows]
    .sort((a, b) => a.ratePercent - b.ratePercent || a.chapterId.localeCompare(b.chapterId))
    .slice(0, 3);

  return {
    totalProblems,
    solvedProblems,
    ratePercent: totalProblems > 0 ? Math.round((solvedProblems / totalProblems) * 100) : 0,
    mastered: discipline.mastered,
    strongChapters,
    weakChapters,
  };
}

// ===================================================================
// 観点3：主体的に学習に取り組む態度
// ===================================================================

export interface AttitudeEvidence {
  /** 直近14日で学習した日数 */
  activeDaysIn14: number;
  /** 学習した日の総数 */
  totalStudyDays: number;
  /** 最終学習日（YYYY-MM-DD、無ければ null） */
  lastStudiedAt: string | null;
  /** 復習の実行状況（立て直し率など） */
  review: ReviewDiscipline;
  /** 取り組み度（内訳つき） */
  engagement: EngagementScore;
  /**
   * 「粘り強さ」の具体例：間違えたのに定着まで持っていった問題の数。
   * box が進んでいる＝間違えた後に間隔を空けて解き直し続けた証拠。
   */
  recoveredToMastery: number;
}

export function buildAttitudeEvidence(
  solved: SolvedMap | null | undefined,
  reviewItems: ReviewItem[] | null | undefined,
  masteredBox: number,
  now: number = Date.now(),
): AttitudeEvidence {
  // 土台の5指標は studySummary.ts の buildStudyBaseMetrics に1つだけ置いている
  // （先生ダッシュボードと必ず同じ数値になるようにするため）。
  const base = buildStudyBaseMetrics(solved, reviewItems, masteredBox, now);

  const recoveredToMastery = (Array.isArray(reviewItems) ? reviewItems : []).filter(
    (item) => Number(item?.box) >= masteredBox && (Number(item?.wrongCount) || 0) > 0,
  ).length;

  return {
    activeDaysIn14: base.activeDaysIn14,
    totalStudyDays: base.studyDays.length,
    lastStudiedAt: base.lastStudiedAt,
    review: base.review,
    engagement: base.engagement,
    recoveredToMastery,
  };
}

// ===================================================================
// レポート本体
// ===================================================================

export interface KantenReport {
  uid: string;
  displayName: string;
  subjectLabel: string;
  knowledge: KnowledgeEvidence;
  attitude: AttitudeEvidence;
  /**
   * 「思考・判断・表現」について正直に添える断り書き。
   * この観点は記述答案の質などで評価すべきもので、
   * 操作ログから数値を捏造しない（誠実さのルール2）。
   */
  thinkingNote: string;
  /** 所見の下書き（事実のみで構成。先生が編集する前提） */
  commentDraft: string;
}

export const THINKING_NOTE =
  'この観点は記述答案や考察の内容で評価するものです。本アプリの操作記録だけでは十分な材料にならないため、定期考査・レポート等と併せてご判断ください。';

/**
 * 所見の下書き文を組み立てる。
 *
 * 文章の設計方針：
 *   - 事実（数・日付・単元名）だけを並べる。形容詞で人物を評価しない。
 *   - 指導要録の所見に近い「〜している。」の常体で統一する
 *     （通知表用に敬体へ直すのは先生の編集範囲）。
 *   - データが無い生徒には「無い」という事実を短く返す。
 *     空文字を返すと先生が「バグか？」と迷うため。
 */
export function buildCommentDraft(params: {
  subjectLabel: string;
  knowledge: KnowledgeEvidence;
  attitude: AttitudeEvidence;
}): string {
  const { subjectLabel, knowledge, attitude } = params;

  if (knowledge.solvedProblems === 0 && attitude.totalStudyDays === 0) {
    return `${subjectLabel}のアプリ学習の記録はまだない。`;
  }

  const sentences: string[] = [];

  // 1文目：量と範囲（知識・技能の土台）
  sentences.push(
    `${subjectLabel}では全${knowledge.totalProblems}問中${knowledge.solvedProblems}問（${knowledge.ratePercent}%）に取り組んでいる。`,
  );

  // 2文目：得意な単元（着手済みの章がある場合のみ）
  const strong = knowledge.strongChapters[0];
  if (strong && strong.ratePercent >= 50) {
    sentences.push(`特に「${strong.chapterTitle}」は到達率${strong.ratePercent}%まで進めている。`);
  }

  // 3文目：粘り強さ（態度の中核。間違い→解き直しの事実）
  if (attitude.review.wrongCount > 0) {
    const rate = Math.round(attitude.review.recoveryRate * 100);
    sentences.push(
      `誤答した問題${attitude.review.total}問に対し、解き直しを${attitude.review.retryCount}回行っている（立て直し率${rate}%）。`,
    );
    if (attitude.recoveredToMastery > 0) {
      sentences.push(
        `そのうち${attitude.recoveredToMastery}問は、間隔をあけた復習を繰り返して定着まで到達させた。`,
      );
    }
  }

  // 4文目：継続（直近の学習習慣）
  if (attitude.activeDaysIn14 > 0) {
    sentences.push(`直近2週間では${attitude.activeDaysIn14}日学習している。`);
  } else if (attitude.lastStudiedAt) {
    sentences.push(`最後の学習は${attitude.lastStudiedAt}で、直近2週間の記録はない。`);
  }

  // 5文目：次の一歩（弱い章があれば。指導に接続できる形で）
  const weak = knowledge.weakChapters.find((row) => row.ratePercent < 50);
  if (weak && knowledge.solvedProblems > 0) {
    sentences.push(`「${weak.chapterTitle}」は未着手・途中のため、今後の重点となる。`);
  }

  return sentences.join('');
}

/** 生徒1人分のレポートを組み立てる */
export function buildKantenReport(params: {
  uid: string;
  displayName: string;
  subjectLabel: string;
  chapters: ChapterDefinition[];
  solved: SolvedMap | null | undefined;
  reviewItems: ReviewItem[] | null | undefined;
  masteredBox: number;
  now?: number;
}): KantenReport {
  const now = params.now ?? Date.now();
  const knowledge = buildKnowledgeEvidence(
    params.chapters,
    params.solved,
    params.reviewItems,
    params.masteredBox,
    now,
  );
  const attitude = buildAttitudeEvidence(params.solved, params.reviewItems, params.masteredBox, now);

  return {
    uid: params.uid,
    displayName: params.displayName,
    subjectLabel: params.subjectLabel,
    knowledge,
    attitude,
    thinkingNote: THINKING_NOTE,
    commentDraft: buildCommentDraft({
      subjectLabel: params.subjectLabel,
      knowledge,
      attitude,
    }),
  };
}

// ===================================================================
// CSV 出力（成績処理ソフトに貼り込む用）
// ===================================================================

/**
 * 列の並びは「知識・技能の材料 → 態度の材料 → 所見下書き」。
 * 学校の成績処理は観点ごとに列を分けて集計するので、
 * 観点をまたいだ合成値（合計点など）は出さない。
 */
export const KANTEN_CSV_HEADERS = [
  '生徒名',
  '科目',
  '[知識技能]到達率(%)',
  '[知識技能]解いた大問数',
  '[知識技能]定着した問題数',
  '[知識技能]得意な単元',
  '[知識技能]重点単元',
  '[態度]直近14日の学習日数',
  '[態度]立て直し率(%)',
  '[態度]解き直し回数',
  '[態度]定着まで戻した問題数',
  '[態度]未処理の復習',
  '[態度]取り組み度(目安)',
  '所見の下書き',
] as const;

export function buildKantenCsv(reports: KantenReport[], withBom = true): string {
  // 骨組み（見出し・CRLF・BOM・エスケープ）は studySummary.ts の
  // buildCsvText に任せ、ここは「どの列をどの順で出すか」だけを持つ。
  return buildCsvText(
    KANTEN_CSV_HEADERS,
    reports.map((report) => {
      const strong = report.knowledge.strongChapters[0];
      const weak = report.knowledge.weakChapters[0];
      return [
        report.displayName,
        report.subjectLabel,
        report.knowledge.ratePercent,
        report.knowledge.solvedProblems,
        report.knowledge.mastered,
        strong ? strong.chapterTitle : '',
        weak ? weak.chapterTitle : '',
        report.attitude.activeDaysIn14,
        Math.round(report.attitude.review.recoveryRate * 100),
        report.attitude.review.retryCount,
        report.attitude.recoveredToMastery,
        report.attitude.review.overdue,
        report.attitude.engagement.score,
        report.commentDraft,
      ];
    }),
    withBom,
  );
}

/** CSV のファイル名（クラス名＋日付。ダウンロードフォルダで迷子にならないように） */
export function kantenCsvFileName(className: string, now: number = Date.now()): string {
  const safe = (className || 'クラス').replace(/[\\/:*?"<>|]/g, '_');
  return `観点別評価材料_${safe}_${toDateKey(now)}.csv`;
}
