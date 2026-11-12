import type { EikenGrade } from './config';

/**
 * Canonical Authoring & Quality Specification for Manatobi Eiken Written (Reading + Writing) Rounds.
 *
 * Designed so ANY AI agent (Claude, GPT, Manus, Gemini, etc.) or human curriculum author
 * can produce cram-school-grade (塾教材品質) original Eiken primary written booklets
 * that pass automated validation and pair cleanly with the Hub Listening room's rounds.
 */

export interface PassageWordBudget {
  notice?: readonly [minWords: number, maxWords: number, questionCount: number];
  email?: readonly [minWords: number, maxWords: number, questionCount: number];
  clozeEach?: readonly [minWords: number, maxWords: number, questionCount: number];
  articleEach: readonly [minWords: number, maxWords: number, questionCount: number];
}

export interface GradeAuthoringSpec {
  grade: EikenGrade;
  label: string;
  cefr: string;
  schoolLevel: string;
  approxVocabHeadwords: string;
  targetGrammarAndSkills: readonly string[];
  passageWordBudgets: PassageWordBudget;
  writingSpec: readonly {
    section: 'email' | 'summary' | 'essay';
    wordRange: readonly [number, number];
    sourceWords?: readonly [number, number];
    formatRule: string;
  }[];
}

export const GRADE_AUTHORING_SPECS: Record<Exclude<EikenGrade, 'eiken_1'>, GradeAuthoringSpec> = {
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
    ],
    passageWordBudgets: {
      articleEach: [0, 0, 0],
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
    ],
    passageWordBudgets: {
      notice: [65, 115, 2],
      email: [110, 175, 3],
      articleEach: [180, 260, 5],
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
      '3級必須句動詞・連語 (be proud of, be interested in, look forward to, take part in, cancel, borrow/lend, fill out 等)',
    ],
    passageWordBudgets: {
      notice: [80, 145, 2],
      email: [130, 200, 3],
      articleEach: [210, 310, 5],
    },
    writingSpec: [
      {
        section: 'email',
        wordRange: [15, 25],
        sourceWords: [30, 65],
        formatRule: '友人のEメール本文中に __下線部__ を1か所設け、その下線部について自分がもっと知りたい具体的な質問を2つ英語で尋ねる返信を書く。',
      },
      {
        section: 'essay',
        wordRange: [25, 35],
        formatRule: '身近な QUESTION / TOPIC に対し、自分の考えと異なる理由を2つ（First, ... / Second, ... 等）書く。',
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
      '準2級頻出語彙・句動詞 (eventually, reliable, develop, come up with, put off, look into, run out of 等)',
    ],
    passageWordBudgets: {
      clozeEach: [150, 230, 2],
      email: [170, 250, 3],
      articleEach: [260, 360, 4],
    },
    writingSpec: [
      {
        section: 'email',
        wordRange: [40, 50],
        sourceWords: [55, 95],
        formatRule: '海外の友人等のメールにある質問への回答に加え、本文中の __下線部__ に関する具体的な質問を2つ行う返信メールを書く。',
      },
      {
        section: 'essay',
        wordRange: [50, 60],
        formatRule: '社会的・学校生活的な TOPIC に対して賛否の立場を明示し、理由を2つ挙げて論述する。',
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
      '準2級と2級の橋渡しとなる抽象名詞・実務動詞 (accommodate, convert, evaluate, practical, mutual, urgent 等)',
      '譲歩・条件・目的・対比の論理接続 (despite -ing, in case, as long as, As a result, Moreover, Nevertheless)',
      '複数段落の説明文における課題→改善策→留保条件の正確な読み取り',
    ],
    passageWordBudgets: {
      clozeEach: [175, 250, 3],
      email: [185, 265, 3],
      articleEach: [290, 400, 5],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [25, 35],
        sourceWords: [85, 115],
        formatRule: '3段落構成（導入と利点→課題・問題点→対応策・結論）の英文を読み、自分の意見を交えず25〜35語で要約する。',
      },
      {
        section: 'essay',
        wordRange: [50, 60],
        formatRule: '地域・教育・生活制度に関する TOPIC について、立場と異なる2つの理由を明確に書く。',
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
      '学術・社会テーマの語彙 (emit, verify, underestimate, compromise, explicit, allocate, assumption 等)',
      '仮定法過去完了・倒置構文 (No sooner ... than / Hardly ... when)・複合前置詞 (regardless of, in exchange for)',
      '社会・環境・科学・組織運営の長文における因果関係とエビデンスの限界の把握',
    ],
    passageWordBudgets: {
      clozeEach: [210, 290, 3],
      email: [210, 290, 3],
      articleEach: [330, 460, 5],
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [45, 55],
        sourceWords: [140, 175],
        formatRule: '約150語の3段落英文（背景・利点→問題点・副作用→対策・今後の視点）を読み、45〜55語で過不足なく要約する。',
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
      '高度な学術・報道・行政語彙 (exacerbate, scrutiny, provisional, reconcile, inconclusive, obsolete, mitigate, bypass 等)',
      '句動詞の抽象用法 (go back on, fall back on, live up to, do away with, stem from 等)',
      '制度設計・歴史学・科学方法論・公共政策における前提批判とトレードオフの精読',
    ],
    passageWordBudgets: {
      clozeEach: [230, 320, 3],
      articleEach: [340, 490, 3], // 3 questions + 4 questions across 2 passages
    },
    writingSpec: [
      {
        section: 'summary',
        wordRange: [60, 70],
        sourceWords: [185, 225],
        formatRule: '約200語の3段落英文の論旨・利点・懸念・対応を自分の語句でパラフレーズしつつ60〜70語で要約する。',
      },
      {
        section: 'essay',
        wordRange: [120, 150],
        formatRule: '社会性の高い TOPIC と4つの POINTS を提示し、そのうち2つの観点を選んで序論・本論1・本論2・結論の4段落構成で120〜150語のエッセイを書く。',
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
 * Both rooms share exact EikenGrade IDs (`eiken_5` .. `eiken_pre1`) and round numbers (`1` .. `15`).
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
