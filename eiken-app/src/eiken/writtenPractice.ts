import type { AudioTrack, Chapter, Problem, SubQuestion } from '../types/curriculum';
import { SQ_BODY_MARK, SQ_MARK } from '../utils/explanationFormat';
import type { EikenGrade } from './config';
import type { WritingTask } from './materials/original-types';
import { WRITTEN_BOOKLETS } from './materials/written-booklets';
import { GRADE_ONE_READING_EXTENSION } from './materials/reading-grade-one-extension';
import { WRITTEN_BLUEPRINTS, type WrittenExam, type WrittenItem, type WrittenSection } from './writtenExamCore';

export const WRITTEN_SECTION_LABELS: Record<WrittenSection, string> = {
  short: '短文の語句空所補充',
  conversation: '会話文の空所補充',
  reorder: '語句整序',
  cloze: '長文の語句空所補充',
  reading: '長文の内容一致選択',
  email: 'Eメール返信',
  summary: '英文要約',
  essay: '英作文（意見論述）',
};

export interface GradeDaimonSpec {
  section: WrittenSection;
  daimonNo: number;
  kind: 'choice' | 'writing';
  tabTitle: string;
  shortLabel: string;
  countPerRound: number;
}

/** 級ごとの本番大問構成（大問1・大問2・大問3…の番号と名称）を WRITTEN_BLUEPRINTS から一意に導出 */
export function getGradeDaimonSpecs(grade: EikenGrade): GradeDaimonSpec[] {
  const bp = WRITTEN_BLUEPRINTS[grade];
  if (!bp) return [];
  return bp.sections.map((spec, idx) => {
    const daimonNo = idx + 1;
    const shortLabel = WRITTEN_SECTION_LABELS[spec.id];
    return {
      section: spec.id,
      daimonNo,
      kind: spec.kind,
      tabTitle: `大問${daimonNo} ${shortLabel}`,
      shortLabel,
      countPerRound: spec.count,
    };
  });
}

const CIRCLED_MARKS = ['①', '②', '③', '④'] as const;

function formatChoiceReasons(item: WrittenItem): string[] {
  return item.choices!.map((text, index) => {
    const mark = CIRCLED_MARKS[index] ?? `${index + 1}.`;
    const verdict = index === item.answer ? '○' : '×';
    return `${mark} ${text} — ${verdict} ${item.distractorReasons![index]}`;
  });
}

function fillPromptBlank(prompt: string, answerText: string): string {
  if (/\(\s*\)/.test(prompt)) {
    return prompt.replace(/\(\s*\)/, answerText);
  }
  return prompt;
}

function subQuestion(exam: WrittenExam, item: WrittenItem): SubQuestion {
  const number = exam.items.indexOf(item) + 1;
  const label = !item.passage
    ? `問${number}`
    : item.section === 'cloze'
    ? `問${number} (${number})`
    : `問${number} ${item.prompt}`;
  return {
    id: `${item.id}_answer`,
    label,
    type: 'multiple_choice',
    options: ['1', '2', '3', '4'],
    optionTexts: [...item.choices!],
    correctAnswer: String(item.answer! + 1),
    ...(item.passage
      ? {
          blankHint: item.section === 'cloze' ? `空所 ( ${number} ) に入る最も適切な語句` : item.prompt,
        }
      : {}),
    skill: WRITTEN_SECTION_LABELS[item.section],
    explainJa: item.explanation,
    detailedExplanation: {
      theme: WRITTEN_SECTION_LABELS[item.section],
      steps: [],
    },
    distractors: item.distractorReasons!.map((why, index) => ({ no: index + 1, why })),
  };
}

/** Original IDs, choice positions, explanations and translations are never re-authored here. */
export function bookletItemToProblem(exam: WrittenExam, item: WrittenItem): Problem {
  if (item.kind !== 'choice') throw new Error('WRITING_USES_WRITING_PRACTICE');
  const number = exam.items.indexOf(item) + 1;
  if (number < 1) throw new Error('ITEM_NOT_IN_BOOKLET');
  const tokens = item.orderTokens?.map((text, index) => `${index + 1}. ${text}`).join(' ／ ');
  const sub = subQuestion(exam, item);
  const answerText = item.choices![item.answer!];
  const completed = item.completedSentence || fillPromptBlank(item.prompt, answerText);

  const explanationTracks: AudioTrack[] = [
    {
      subId: sub.id,
      label: `問${number}`,
      hint: WRITTEN_SECTION_LABELS[item.section],
      script: completed,
      translation: item.translation || '',
      keyPhrases: answerText ? [{ phrase: answerText, meaning: `正解（${WRITTEN_SECTION_LABELS[item.section]}）` }] : [],
    },
  ];

  // 短文・会話は5問一括採点（EikenClozePageQuiz）で描画されるため問番号プレフィックスを付けず原文を維持し、
  // 語句整序（reorder）のみ QuizBody 1問ずつ表示（stepwise: true）向けに「問N　本文」形式で描画する。
  const isBatchCloze = item.section === 'short' || item.section === 'conversation';
  const compactPrompt = item.prompt
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
  const text = item.passage
    ? [`${item.passage.title}\n${item.passage.text}`, item.prompt, tokens].filter(Boolean).join('\n\n')
    : isBatchCloze
    ? compactPrompt
    : [`問${number}　${compactPrompt}`, tokens].filter(Boolean).join('\n');

  return {
    id: item.id,
    title: `筆記 第${exam.round}回 問${number}`,
    category: WRITTEN_SECTION_LABELS[item.section],
    text,
    ...(item.passage || isBatchCloze ? {} : { stepwise: true }),
    explanationTracks,
    subQuestions: [sub],
    explanation: isBatchCloze
      ? [
          item.completedSentence,
          `【訳】${item.translation || ''}`,
          item.explanation,
          ...item.choices!.map((choiceText, index) => `${index + 1}. ${choiceText} — ${item.distractorReasons![index]}`),
        ]
          .filter(Boolean)
          .join('\n')
      : [
          item.passage?.translation ? `【本文の和訳】\n${item.passage.translation}` : '',
          item.explanation,
          '【選択肢】',
          ...formatChoiceReasons(item),
        ]
          .filter(Boolean)
          .join('\n'),
    surroundingKnowledge: [],
    deepDiveTopics: [],
  };
}

function passageProblems(exam: WrittenExam, items: WrittenItem[]): Problem[] {
  const groups = new Map<string, WrittenItem[]>();
  for (const item of items) {
    const key = item.passage!.id;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return [...groups.values()].map(group => {
    const subs = group.map(item => subQuestion(exam, item));
    const passage = group[0].passage!;
    const firstNo = exam.items.indexOf(group[0]) + 1;
    const lastNo = exam.items.indexOf(group[group.length - 1]) + 1;
    const explanationTracks: AudioTrack[] = [
      {
        subId: subs[0].id,
        subIds: subs.map(s => s.id),
        label: passage.title,
        hint: `${WRITTEN_SECTION_LABELS[group[0].section]}（問${firstNo}〜問${lastNo}）`,
        script: `${passage.title}\n\n${passage.text}`,
        translation: passage.translation || '',
        keyPhrases: group.map(item => ({
          phrase: item.choices![item.answer!],
          meaning: `問${exam.items.indexOf(item) + 1} 正解`,
        })),
      },
    ];
    return {
      id: `${exam.id}_${passage.id}`,
      title: passage.title,
      category: WRITTEN_SECTION_LABELS[group[0].section],
      text: `【${passage.title}】\n${passage.text}`,
      explanationTracks,
      subQuestions: subs,
      explanation: `【本文の和訳】\n${passage.translation}\n\n${group
        .map((item, idx) => {
          const sqId = subs[idx].id;
          return `${SQ_MARK(sqId)}${SQ_BODY_MARK}${
            item.section === 'reading' ? `設問：${item.prompt}\n` : ''
          }${item.explanation}\n【選択肢】\n${formatChoiceReasons(item).join('\n')}`;
        })
        .join('\n\n')}`,
      surroundingKnowledge: [],
      deepDiveTopics: [],
    };
  });
}

/** 特定の1つの大問セクション（short / conversation / reorder / cloze / reading）だけを第1回〜第N回の順で並べた Chapter 配列を返す */
export function bookletSectionChapters(grade: EikenGrade, section: WrittenSection, realTitle: string): Chapter[] {
  const isPassageSection = section === 'cloze' || section === 'reading';
  const sortedExams = WRITTEN_BOOKLETS.filter(exam => exam.grade === grade && exam.review === 'approved').sort(
    (a, b) => a.round - b.round,
  );
  return sortedExams.flatMap(exam => {
    const items = exam.items.filter(item => item.section === section);
    if (!items.length) return [];
    const problems = isPassageSection ? passageProblems(exam, items) : items.map(item => bookletItemToProblem(exam, item));
    const scopePrefix = exam.scope === 'reading' ? 'リーディング' : '筆記';
    const fullTitle = `${scopePrefix} 第${exam.round}回｜${WRITTEN_SECTION_LABELS[section]}`;
    const shortCardTitle = isPassageSection
      ? `第${exam.round}回（${problems.length}本文・計${items.length}問）`
      : `第${exam.round}回（全${items.length}問）`;
    return [
      {
        id: `${exam.id}_${section}`,
        title: fullTitle,
        abstractTitle: shortCardTitle,
        realTitle,
        questionGroup: `冊子${WRITTEN_SECTION_LABELS[section]}`,
        topics: [`${scopePrefix}冊子（第${exam.round}回）の大問通し演習・全${items.length}問`],
        marks: items.length,
        miniTest: [],
        practiceProblems: problems,
      },
    ];
  });
}

/** Supplemental instruction uses the same passage and explanation components as booklet practice. */
export function gradeOneReadingExtension(tabTitle: string): Chapter[] {
  return GRADE_ONE_READING_EXTENSION.map((passage, index) => {
    const id = `eiken_1_reading_extra_${passage[0].passage!.id}`;
    const items = passage.map((item, question) => ({ ...item, id: `${id}_q${question + 1}` }));
    const practice: WrittenExam = { id, grade: 'eiken_1', round: index + 1, revision: 'supplement-v1', origin: 'manatobi-original', review: 'approved', items };
    return {
      id, realTitle: tabTitle, questionGroup: WRITTEN_SECTION_LABELS.reading,
      title: `追加読解 ${index + 1}｜${passage[0].passage!.title}`,
      abstractTitle: `追加読解 ${index + 1}｜${passage[0].passage!.title}（全${items.length}問）`,
      topics: ['長文の内容一致選択・追加演習'],
      marks: items.length, miniTest: [], practiceProblems: passageProblems(practice, items),
    };
  });
}

export function bookletPracticeChapters(grade: EikenGrade, part: 'vocabulary' | 'reading' = 'vocabulary'): Chapter[] {
  const specs = getGradeDaimonSpecs(grade).filter(
    s => s.kind === 'choice' && (part === 'reading' ? s.section === 'cloze' || s.section === 'reading' : s.section !== 'cloze' && s.section !== 'reading'),
  );
  return specs.flatMap(spec => bookletSectionChapters(grade, spec.section, spec.tabTitle));
}

export interface BookletWritingEntry extends WritingTask {
  grade: EikenGrade;
  key: string;
  round: number;
  bookletId: string;
  section: WrittenSection;
  modelTranslation: string;
}

/** Same writing originals power both the printable booklet (question + lined sheet + model answer) and in-app Writing practice. */
export function bookletWritingTasks(): BookletWritingEntry[] {
  return WRITTEN_BOOKLETS.filter(exam => exam.review === 'approved').flatMap(exam => {
    const roundLetter = String.fromCharCode(96 + exam.round);
    return exam.items
      .filter(item => item.kind === 'writing')
      .map(item => {
        const id = `round${roundLetter}${item.section}`;
        return {
          id,
          key: `${exam.grade}_writing_${id}`,
          grade: exam.grade,
          round: exam.round,
          bookletId: exam.id,
          section: item.section,
          title: `筆記 第${exam.round}回｜${WRITTEN_SECTION_LABELS[item.section]}`,
          instruction: item.prompt,
          source: item.passage ? `${item.passage.title}\n\n${item.passage.text}` : undefined,
          target: `目安語数：${item.wordRange![0]}〜${item.wordRange![1]}語`,
          model: item.model!,
          modelTranslation: item.translation!,
          commentary: [
            item.passage?.translation ? `【元文の和訳】\n${item.passage.translation}` : '',
            `【構成・表現のポイント】\n${item.explanation!}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
          checklist: [...item.rubric!],
        };
      });
  });
}
