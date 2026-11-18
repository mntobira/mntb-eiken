import type { EikenGrade } from './config';

/**
 * Canonical Authoring & Quality Specification for Manatobi Eiken Written (Reading + Writing) Rounds.
 *
 * Calibrated empirically against official Eiken primary exam booklets (2025-3, 2026-1, 2026-2 across all 8 grades:
 * Grade 5 through Grade 1) so that every original item (`origin: 'manatobi-original'`) matches authentic
 * difficulty, lexical profile, syntactic complexity, passage length, and distractor plausibility.
 */

export interface PassageWordBudget {
  notice?: readonly [minWords: number, maxWords: number, questionCount: number];
  email?: readonly [minWords: number, maxWords: number, questionCount: number];
  clozeEach?: readonly [minWords: number, maxWords: number, questionCount: number];
  articleEach: readonly [minWords: number, maxWords: number, questionCount: number];
  articleSecond?: readonly [minWords: number, maxWords: number, questionCount: number];
}

export interface EmpiricalCalibrationTargets {
  /** 大問1 stem語数の目安レンジ */
  shortStemWords: readonly [minWords: number, maxWords: number];
  /** 大問1 stem文脈のB2以上語比率上限（%）：問題文自体を難語だらけにしないための上限 */
  shortStemMaxPctB2Plus: number;
  /** 大問1 選択肢の平均Zipf目安レンジ（低いほど低頻度・高難度語） */
  shortChoiceZipfRange: readonly [minZipf: number, maxZipf: number];
  /** 大問1 選択肢のC1以上語比率上限（%） */
  shortChoiceMaxPctC1Plus: number;
  /** 大問1 熟語・句動詞問題の推奨問数 */
  shortPhrasalCount: readonly [minItems: number, maxItems: number];
  /** 長文パッセージの1文あたり平均語数（WPS）レンジ */
  readingWordsPerSentence: readonly [minWps: number, maxWps: number];
  /** 長文パッセージのB2以上語比率レンジ（%） */
  readingPctB2PlusRange: readonly [minPct: number, maxPct: number];
  /** 長文パッセージのC1以上語比率上限（%） */
  readingMaxPctC1Plus: number;
  /** 長文読解の選択肢1肢あたり平均語数レンジ */
  readingChoiceWords: readonly [minWords: number, maxWords: number];
  /** 長文読解における複数文統合・意図/推論設問の最低比率（%） */
  minMultiSentenceOrInferencePct: number;
  /** 誤答選択肢が本文内容語を再利用する推奨比率レンジ（%）：無関係ダミー排除用 */
  distractorPassageOverlapPct: readonly [minPct: number, maxPct: number];
}

export interface GradeAuthoringSpec {
  grade: EikenGrade;
  label: string;
  cefr: string;
  schoolLevel: string;
  approxVocabHeadwords: string;
  targetGrammarAndSkills: readonly string[];
  passageWordBudgets: PassageWordBudget;
  calibration: EmpiricalCalibrationTargets;
  writingSpec: readonly {
    section: 'email' | 'summary' | 'essay';
    wordRange: readonly [number, number];
    sourceWords?: readonly [number, number];
    formatRule: string;
  }[];
}

export const GRADE_AUTHORING_SPECS: Readonly<Record<EikenGrade, GradeAuthoringSpec>> = {
  eiken_5: {
    grade: 'eiken_5',
    label: '英検5級',
    cefr: 'Pre-A1〜A1初歩',
    schoolLevel: '中学初級（中1程度）',
    approxVocabHeadwords: '約600語',
    targetGrammarAndSkills: [
      'be動詞・一般動詞の現在形（3単現の-s含む）',
      '助動詞 can の肯定・疑問・応答',
      '命令文・否定命令文 (Please / Don\'t) / Let\'s',
      '現在進行形 (be + -ing)',
      '疑問詞 (What, Who, Where, When, Which, How, How many, How old)',
      '人称代名詞（主格・所有格・目的格・所有代名詞）と複数形・前置詞 (in/on/at/under/by/with)',
      '大問1のうち約3割（4〜5問）は代名詞・疑問詞・動詞活用・助動詞の形態識別問題を含めること',
    ],
    passageWordBudgets: {
      articleEach: [0, 0, 0],
    },
    calibration: {
      shortStemWords: [7, 13],
      shortStemMaxPctB2Plus: 2,
      shortChoiceZipfRange: [5.1, 5.8],
      shortChoiceMaxPctC1Plus: 0,
      shortPhrasalCount: [1, 3],
      readingWordsPerSentence: [6, 9],
      readingPctB2PlusRange: [0, 2],
      readingMaxPctC1Plus: 0,
      readingChoiceWords: [2, 5],
      minMultiSentenceOrInferencePct: 0,
      distractorPassageOverlapPct: [20, 45],
    },
    writingSpec: [],
  },
  eiken_4: {
    grade: 'eiken_4',
    label: '英検4級',
    cefr: 'A1',
    schoolLevel: '中学中級（中2程度）',
    approxVocabHeadwords: '約1,300語',
    targetGrammarAndSkills: [
      '規則・不規則動詞の過去形と過去進行形、There was / were',
      '未来表現 (will / be going to)',
      '助動詞 (must, have to, may, should, Shall I / Shall we / Would you)',
      '不定詞（名詞的・副詞的・形容詞的用法）と動名詞 (enjoy/finish/stop -ing)',
      '比較級・最上級・原級比較 (as ... as)',
      '接続詞 (when, if, because, before, after, that)',
      '語句整序は公式形式の5語群（2番目・4番目選択）および基礎4語群（1番目・3番目選択）に対応',
    ],
    passageWordBudgets: {
      notice: [80, 120, 2],
      email: [145, 195, 3],
      articleEach: [195, 250, 5],
    },
    calibration: {
      shortStemWords: [9, 15],
      shortStemMaxPctB2Plus: 3,
      shortChoiceZipfRange: [4.9, 5.5],
      shortChoiceMaxPctC1Plus: 0,
      shortPhrasalCount: [2, 4],
      readingWordsPerSentence: [8.5, 11.5],
      readingPctB2PlusRange: [0, 4.5],
      readingMaxPctC1Plus: 0.5,
      readingChoiceWords: [4, 8],
      minMultiSentenceOrInferencePct: 10,
      distractorPassageOverlapPct: [30, 50],
    },
    writingSpec: [],
  },
  eiken_3: {
    grade: 'eiken_3',
    label: '英検3級',
    cefr: 'A1〜A2',
    schoolLevel: '中学卒業程度（中3修了水準）※5級レベルの単純正誤問題を主軸にしないこと',
    approxVocabHeadwords: '約2,100語',
    targetGrammarAndSkills: [
      '現在完了形（継続・経験・完了：since / for / ever / never / already / yet / just）',
      '受動態（現在・過去・助動詞付き be + 過去分詞）',
      '関係代名詞（主格・目的格 who / which / that）と分詞の後置修飾（現在分詞・過去分詞）',
      '間接疑問文 (know where/when/what ...)、疑問詞 + to不定詞',
      '形式主語・構文 (It is ... for A to / too ... to / enough to / so ... that / in order to)',
      '3級必須句動詞・連語（大問1で3〜5問確保：be proud of, look forward to, take part in, fill out 等）',
    ],
    passageWordBudgets: {
      notice: [95, 145, 2],
      email: [180, 230, 3],
      articleEach: [240, 290, 5],
    },
    calibration: {
      shortStemWords: [11, 17],
      shortStemMaxPctB2Plus: 5,
      shortChoiceZipfRange: [4.7, 5.3],
      shortChoiceMaxPctC1Plus: 1,
      shortPhrasalCount: [3, 5],
      readingWordsPerSentence: [10.0, 12.8],
      readingPctB2PlusRange: [1.5, 6.0],
      readingMaxPctC1Plus: 1.0,
      readingChoiceWords: [5.5, 9.0],
      minMultiSentenceOrInferencePct: 20,
      distractorPassageOverlapPct: [32, 50],
    },
    writingSpec: [
      {
        section: 'email',
        wordRange: [15, 25],
        sourceWords: [40, 65],
        formatRule: '外国人の友達からのEメール本文中に __2つの質問（下線部）__ を設け、返信枠（Hi, Name! / Thank you for your e-mail. / Best wishes,）に入る本文として、その2つの質問に対応する内容を15〜25語で答える。',
      },
      {
        section: 'essay',
        wordRange: [25, 35],
        formatRule: '身近な QUESTION に対し、自分の考えと異なる理由を2つ（First, ... / Second, ... 等）書く。',
      },
    ],
  },
  eiken_pre2: {
    grade: 'eiken_pre2',
    label: '英検準2級',
    cefr: 'A2〜B1初歩',
    schoolLevel: '高校中級程度（高1〜高2前半）',
    approxVocabHeadwords: '約3,600語',
    targetGrammarAndSkills: [
      '過去完了形 (had + p.p.)・未来完了の基礎・助動詞の過去表現',
      '関係副詞 (where / when / why)・前置詞＋関係代名詞・複合関係詞の基礎',
      '仮定法過去 (If I were ..., I would ...)・使役動詞 (make/let/have)・知覚動詞・allow A to do',
      '分詞構文の基礎・無生物主語・強調や比較の慣用表現 (would rather A than B / no choice but to / worth -ing)',
      '準2級頻出語彙・句動詞（大問1で4〜6問確保：come up with, put off, look into, run out of, in charge of 等）',
    ],
    passageWordBudgets: {
      clozeEach: [210, 260, 2],
      email: [200, 260, 3],
      articleEach: [300, 360, 4],
    },
    calibration: {
      shortStemWords: [13, 21],
      shortStemMaxPctB2Plus: 7,
      shortChoiceZipfRange: [4.4, 5.0],
      shortChoiceMaxPctC1Plus: 2,
      shortPhrasalCount: [4, 6],
      readingWordsPerSentence: [12.5, 16.0],
      readingPctB2PlusRange: [4.0, 9.0],
      readingMaxPctC1Plus: 1.5,
      readingChoiceWords: [7.5, 11.5],
      minMultiSentenceOrInferencePct: 30,
      distractorPassageOverlapPct: [35, 52],
    },
    writingSpec: [
      {
        section: 'email',
        wordRange: [40, 50],
        sourceWords: [75, 105],
        formatRule: '海外の知り合い等のメールにある質問への回答に加え、本文中の __下線部__ に関する具体的な質問を2つ行う返信メールを書く。',
      },
      {
        section: 'essay',
        wordRange: [50, 60],
        formatRule: '社会的・学校生活的な QUESTION に対して賛否の立場を明示し、理由を2つ挙げて論述する。',
      },
    ],
  },
  eiken_pre2plus: {
    grade: 'eiken_pre2plus',
    label: '英検準2級プラス',
    cefr: 'B1前半',
    schoolLevel: '高校中級〜上級橋渡し（高2程度）',
    approxVocabHeadwords: '約4,300語',
    targetGrammarAndSkills: [
      '準2級と2級の橋渡しとなるB1中核語彙（C1難語を混ぜず、accommodate, convert, evaluate, practical, mutual, urgent 等を中心に据える）',
      '譲歩・条件・目的・対比の論理接続 (despite -ing, in case, as long as, As a result, Moreover, Nevertheless)',
      '複数段落の説明文における課題→改善策→留保条件の正確な読み取り（1文長は平均14〜17.5語に抑え、2級・準1級のような重厚構文にしすぎない）',
    ],
    passageWordBudgets: {
      clozeEach: [215, 265, 3],
      email: [220, 275, 3],
      articleEach: [320, 380, 5],
    },
    calibration: {
      shortStemWords: [14, 21],
      shortStemMaxPctB2Plus: 8,
      shortChoiceZipfRange: [4.2, 4.7],
      shortChoiceMaxPctC1Plus: 5,
      shortPhrasalCount: [4, 7],
      readingWordsPerSentence: [14.0, 17.5],
      readingPctB2PlusRange: [7.5, 12.5],
      readingMaxPctC1Plus: 2.0,
      readingChoiceWords: [8.5, 12.5],
      minMultiSentenceOrInferencePct: 35,
      distractorPassageOverlapPct: [38, 55],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [25, 35],
        sourceWords: [90, 115],
        formatRule: '3段落構成（導入と利点→課題・問題点→対応策・結論、90〜115語）の英文を読み、自分の意見を交えず25〜35語で要約する。',
      },
      {
        section: 'essay',
        wordRange: [50, 60],
        formatRule: '地域・教育・生活制度に関する QUESTION について、立場と異なる2つの理由を明確に書く。',
      },
    ],
  },
  eiken_2: {
    grade: 'eiken_2',
    label: '英検2級',
    cefr: 'B1',
    schoolLevel: '高校卒業程度（高3・大学入試共通テスト水準）',
    approxVocabHeadwords: '約5,100語',
    targetGrammarAndSkills: [
      '学術・社会テーマのB1〜B2前半語彙 (emit, verify, underestimate, compromise, explicit, allocate, assumption 等)',
      '大問1のうち約4割（6〜7問）は句動詞・連語（take advantage of, keep track of, do away with, live up to 等）を出題する',
      '社会・環境・科学・組織運営の長文における因果関係と複数文統合の読み取り（1文長は平均16.5〜19.5語に制御）',
    ],
    passageWordBudgets: {
      clozeEach: [235, 285, 3],
      email: [245, 305, 3],
      articleEach: [350, 420, 5],
    },
    calibration: {
      shortStemWords: [15, 23],
      shortStemMaxPctB2Plus: 9,
      shortChoiceZipfRange: [4.1, 4.6],
      shortChoiceMaxPctC1Plus: 8,
      shortPhrasalCount: [5, 7],
      readingWordsPerSentence: [16.5, 19.5],
      readingPctB2PlusRange: [9.5, 14.5],
      readingMaxPctC1Plus: 2.5,
      readingChoiceWords: [9.5, 13.5],
      minMultiSentenceOrInferencePct: 40,
      distractorPassageOverlapPct: [38, 55],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [45, 55],
        sourceWords: [145, 175],
        formatRule: '約150〜170語の3段落英文（背景・利点→問題点・副作用→対策・今後の視点）を読み、45〜55語で過不足なく要約する。',
      },
      {
        section: 'essay',
        wordRange: [80, 100],
        formatRule: '社会的な TOPIC と3つの参考 POINTS を提示し、序論・本論（理由2つ）・結論で80〜100語の意見論述を書く。',
      },
    ],
  },
  eiken_pre1: {
    grade: 'eiken_pre1',
    label: '英検準1級',
    cefr: 'B2',
    schoolLevel: '大学中級程度',
    approxVocabHeadwords: '約7,500〜9,000語',
    targetGrammarAndSkills: [
      'B2〜C1前半の学術・報道・実務語彙（1級専用の超低頻度C2語彙に踏み込みすぎず、Zipf 3.55〜3.90・C1+比率15〜24%に制御する）',
      '大問1の後半4問（問15〜18）は抽象的な句動詞 (go back on, fall back on, live up to, do away with, stem from 等) とし、問題文の文脈語自体は平易（B2+比率10%以下）に保つ',
      '大問3（長文読解）は Passage A 約380〜430語（3問）・Passage B 約450〜510語（4問）とし、選択肢は16〜21語の節単位、設問の半数以上を複数文統合・含意推論型とする',
    ],
    passageWordBudgets: {
      clozeEach: [240, 285, 3],
      articleEach: [380, 440, 3],
      articleSecond: [450, 520, 4],
    },
    calibration: {
      shortStemWords: [16, 25],
      shortStemMaxPctB2Plus: 10,
      shortChoiceZipfRange: [3.55, 3.90],
      shortChoiceMaxPctC1Plus: 24,
      shortPhrasalCount: [3, 4],
      readingWordsPerSentence: [19.5, 22.5],
      readingPctB2PlusRange: [13.5, 18.5],
      readingMaxPctC1Plus: 4.5,
      readingChoiceWords: [15.5, 21.0],
      minMultiSentenceOrInferencePct: 45,
      distractorPassageOverlapPct: [40, 55],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [60, 70],
        sourceWords: [190, 225],
        formatRule: '190〜225語の3段落英文の論旨・利点・懸念・対応を自分の語句でパラフレーズしつつ60〜70語で要約する。',
      },
      {
        section: 'essay',
        wordRange: [120, 150],
        formatRule: '社会性の高い簡潔な TOPIC（12〜18語程度）と4つの POINTS を提示し、そのうち2つの観点を選んで序論・本論1・本論2・結論の4段落構成で120〜150語のエッセイを書く。',
      },
    ],
  },
  eiken_1: {
    grade: 'eiken_1',
    label: '英検1級',
    cefr: 'C1',
    schoolLevel: '大学上級程度（国際的な学術誌・論説誌・専門的議論を自在に読み書きできる水準）',
    approxVocabHeadwords: '約10,000〜15,000語',
    targetGrammarAndSkills: [
      '大問1（22問）：問1〜18はC1/B2上位の学術・文芸・論説単熟語（Zipf平均 3.05〜3.35、C1+比率 38〜52%）、問19〜22は高難度句動詞4問（iron out, shore up, stave off, zero in on, mete out, fizzle out 等）。ただし問題文（stem 16〜28語、平均約22語）の文脈語自体は明快な標準英語（B2+比率 8%以下）で書き、空所の1語だけが難語となる公式構造を厳守する',
      '大問2（長文空所補充 6問：2パッセージ×各3問、問23〜28）：科学史・生態学・考古学・経済史・心理学などの3段落評論文（各330〜360語、平均1文長 20〜24語、B2+比率 16〜21%）。選択肢は4〜7語の句・節で論理的帰結や対比を問う',
      '大問3（長文内容一致 7問：Passage A 490〜550語・4段落・問29〜31の3問 ＋ Passage B 740〜820語・6〜8段落・問32〜35の4問）：平均1文長 23〜26語、B2+比率 18〜23%、C1+比率 4.5〜6.8%。選択肢は18〜24語の精緻な複文とし、誤答選択肢にも本文の重要語彙を45〜52%織り込みつつ因果の逆転・適用範囲のすり替え・留保条件の断定化で識別させる。設問の50%以上を複数段落統合または筆者意図・推論型とする',
    ],
    passageWordBudgets: {
      clozeEach: [330, 365, 3],
      articleEach: [490, 555, 3],
      articleSecond: [740, 825, 4],
    },
    calibration: {
      shortStemWords: [16, 28],
      shortStemMaxPctB2Plus: 8.5,
      shortChoiceZipfRange: [3.05, 3.35],
      shortChoiceMaxPctC1Plus: 52,
      shortPhrasalCount: [4, 4],
      readingWordsPerSentence: [22.5, 26.2],
      readingPctB2PlusRange: [18.0, 23.0],
      readingMaxPctC1Plus: 7.0,
      readingChoiceWords: [18.5, 24.5],
      minMultiSentenceOrInferencePct: 50,
      distractorPassageOverlapPct: [44, 55],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [90, 110],
        sourceWords: [295, 320],
        formatRule: '295〜320語の3段落学術・社会評論文を読み、自分の意見を加えず自分の語句でパラフレーズして90〜110語で要約する。',
      },
      {
        section: 'essay',
        wordRange: [200, 240],
        formatRule: '国際社会・科学技術・公共哲学・経済制度に関する簡潔な TOPIC（POINTSなし・8〜14語）に対し、賛否の立場と異なる3つの理由（序論＋本論3段落＋結論の5段落構成）を200〜240語で論述する。',
      },
    ],
  },
};

/**
 * Automated guardrails against common AI authoring anti-patterns (e.g., raw LLM prefixes,
 * listening-style dialogue scripts in written Part 2, or copy-pasted boilerplate distractor reasons).
 */
export const FORBIDDEN_PROMPT_PATTERNS: readonly RegExp[] = [
  /^Choose the best (answer|reply)/i,
  /^Read the (passage|conversation) and choose/i,
  /(^|\n)(M1|F1|M2|F2):/,
  /(?<!_)___(?!_)/,
];

export const FORBIDDEN_GENERIC_REASON_PATTERNS: readonly RegExp[] = [
  /この文の時制・形・意味に合いません/,
  /本文の情報と一致しない（または本文にない）/,
  /^本文にありません。?$/,
  /^文脈に合いません。?$/,
  /^会話で述べられた内容とは異なります。?$/,
  /^台本の問い・情報と一致しません。?$/,
];

/**
 * Hub Cross-Room Integration Convention (for pairing Written booklets with Listening room rounds).
 * Both rooms share exact EikenGrade IDs (`eiken_5` .. `eiken_1`) and round numbers (`1` .. `15`).
 */
export function pairedListeningExamId(grade: EikenGrade, round: number): string {
  return `${grade}_listening_r${String(round).padStart(2, '0')}`;
}

export function primaryExamBundleId(grade: EikenGrade, round: number): string {
  return `${grade}_primary_r${String(round).padStart(2, '0')}`;
}

export interface PrimaryExamBundleRef {
  bundleId: string;
  grade: EikenGrade;
  round: number;
  writtenExamId: string;
  listeningExamId: string;
  writtenPrintBase: string;
  expectedListeningPrintBase: string;
}

export function buildPrimaryBundleRef(grade: EikenGrade, round: number): PrimaryExamBundleRef {
  const r = String(round).padStart(2, '0');
  const writtenExamId = `${grade}_written_${r}`;
  const listeningExamId = pairedListeningExamId(grade, round);
  return {
    bundleId: primaryExamBundleId(grade, round),
    grade,
    round,
    writtenExamId,
    listeningExamId,
    writtenPrintBase: `/prints/print_${writtenExamId}`,
    expectedListeningPrintBase: `/prints/print_${listeningExamId}`,
  };
}
