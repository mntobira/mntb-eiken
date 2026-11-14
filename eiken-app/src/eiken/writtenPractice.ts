import type { Chapter, Problem, SubQuestion } from '../types/curriculum';
import type { EikenGrade } from './config';
import type { WritingTask } from './materials/original-types';
import { WRITTEN_BOOKLETS } from './materials/written-booklets';
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

function subQuestion(exam: WrittenExam, item: WrittenItem): SubQuestion {
  return {
    id: `${item.id}_answer`,
    label: `問${exam.items.indexOf(item) + 1}${item.passage ? ' ' + item.prompt : ''}`,
    type: 'multiple_choice',
    options: ['1', '2', '3', '4'],
    optionTexts: [...item.choices!],
    correctAnswer: String(item.answer! + 1),
    skill: WRITTEN_SECTION_LABELS[item.section],
    explainJa: item.explanation,
    detailedExplanation: {
      theme: WRITTEN_SECTION_LABELS[item.section],
      steps: [item.completedSentence || '', item.explanation!].filter(Boolean),
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
  return {
    id: item.id,
    title: `筆記 第${exam.round}回 問${number}`,
    category: WRITTEN_SECTION_LABELS[item.section],
    text: [item.passage && `${item.passage.title}\n${item.passage.text}`, item.prompt, tokens].filter(Boolean).join('\n\n'),
    subQuestions: [subQuestion(exam, item)],
    explanation: [
      item.completedSentence,
      `【訳】${item.translation || ''}`,
      item.explanation,
      ...item.choices!.map((text, index) => `${index + 1}. ${text} — ${item.distractorReasons![index]}`),
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
  return [...groups.values()].map(group => ({
    id: `${exam.id}_${group[0].passage!.id}`,
    title: group[0].passage!.title,
    category: WRITTEN_SECTION_LABELS[group[0].section],
    text: `${group[0].passage!.title}\n\n${group[0].passage!.text}`,
    subQuestions: group.map(item => subQuestion(exam, item)),
    explanation: `【本文の和訳】\n${group[0].passage!.translation}\n\n${group
      .map(
        item =>
          `問${exam.items.indexOf(item) + 1}：${item.explanation}\n${item.choices!
            .map((text, i) => `${i + 1}. ${text} — ${item.distractorReasons![i]}`)
            .join('\n')}`,
      )
      .join('\n\n')}`,
    surroundingKnowledge: [],
    deepDiveTopics: [],
  }));
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
