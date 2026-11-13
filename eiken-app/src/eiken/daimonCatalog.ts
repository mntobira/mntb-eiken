import type { Chapter } from '../types/curriculum';
import { EIKEN_GRADES, type EikenGrade } from './config';
import { WRITTEN_BLUEPRINTS, type WrittenSection } from './writtenExamCore';

export type ChoiceSection = 'short' | 'conversation' | 'reorder' | 'cloze' | 'reading';

export interface EikenDaimonSpec {
  grade: EikenGrade;
  daimonNumber: number;
  daimonLabel: string;
  section: ChoiceSection;
  sectionTitle: string;
  formatNote: string;
  startQuestion: number;
  endQuestion: number;
  count: number;
  scopeLabel: '筆記' | 'リーディング';
  part: 'vocabulary' | 'reading';
}

const SECTION_TITLES: Record<ChoiceSection, string> = {
  short: '短文の語句空所補充',
  conversation: '会話文の空所補充',
  reorder: '語句整序',
  cloze: '長文の語句空所補充',
  reading: '読解（内容一致選択）',
};

const FORMAT_NOTES: Partial<Record<`${EikenGrade}:${ChoiceSection}`, string>> = {
  'eiken_5:short': '語彙・熟語・基本文法の4択（1問ずつ解答）',
  'eiken_5:conversation': '2〜3往復の対話に合う表現を選ぶ4択',
  'eiken_5:reorder': '4つの語句を並べ替え、1番目と3番目の番号を選ぶ',
  'eiken_4:short': '語彙・熟語・基本文法の4択（1問ずつ解答）',
  'eiken_4:conversation': '日常の対話の流れに合う応答・表現を選ぶ4択',
  'eiken_4:reorder': '4つの語句を並べ替え、1番目と3番目の番号を選ぶ',
  'eiken_4:reading': '掲示・Eメール・説明文を読み、内容に合う選択肢を選ぶ（3パッセージ）',
  'eiken_3:short': '語彙・熟語・文法の4択（1問ずつ解答）',
  'eiken_3:conversation': '対話の文脈に合う表現を選ぶ4択',
  'eiken_3:reading': '掲示・Eメール・説明文を読み、内容に合う選択肢を選ぶ（3パッセージ）',
  'eiken_pre2:short': '語彙・熟語・文法の4択（1問ずつ解答）',
  'eiken_pre2:conversation': '対話の流れに合う表現を選ぶ4択',
  'eiken_pre2:cloze': '説明文の空所（21）（22）に入る語句を選ぶ（1パッセージ2問）',
  'eiken_pre2:reading': 'Eメール・説明文を読み、内容に合う選択肢を選ぶ（2パッセージ）',
  'eiken_pre2plus:short': '語彙・熟語・文法の4択（1問ずつ解答）',
  'eiken_pre2plus:cloze': '説明文2本の空所に入る語句・接続表現を選ぶ（2パッセージ計6問）',
  'eiken_pre2plus:reading': 'Eメール・説明文を読み、内容に合う選択肢を選ぶ（3パッセージ）',
  'eiken_2:short': '語彙・熟語・文法の4択（1問ずつ解答）',
  'eiken_2:cloze': '説明文2本の空所に入る語句・論理表現を選ぶ（2パッセージ計6問）',
  'eiken_2:reading': 'Eメール・説明文2本を読み、内容に合う選択肢を選ぶ（3パッセージ）',
  'eiken_pre1:short': '高難度の語彙・熟語の4択（1問ずつ解答）',
  'eiken_pre1:cloze': '論説文2本の空所に入る語句・展開表現を選ぶ（2パッセージ計6問）',
  'eiken_pre1:reading': '説明文・評論文を読み、要旨・詳細に合う選択肢を選ぶ（2パッセージ）',
};

export function getDaimonSpecsForGrade(grade: EikenGrade): EikenDaimonSpec[] {
  const blueprint = WRITTEN_BLUEPRINTS[grade];
  if (!blueprint) return [];
  const choiceSections = blueprint.sections.filter(
    (s): s is { id: ChoiceSection; count: number; kind: 'choice' } => s.kind === 'choice',
  );
  const scopeLabel: '筆記' | 'リーディング' = grade === 'eiken_5' || grade === 'eiken_4' ? '筆記' : 'リーディング';
  let cursor = 1;
  return choiceSections.map((spec, idx) => {
    const startQuestion = cursor;
    const endQuestion = cursor + spec.count - 1;
    cursor = endQuestion + 1;
    const part: 'vocabulary' | 'reading' = spec.id === 'cloze' || spec.id === 'reading' ? 'reading' : 'vocabulary';
    return {
      grade,
      daimonNumber: idx + 1,
      daimonLabel: `大問${idx + 1}`,
      section: spec.id,
      sectionTitle: SECTION_TITLES[spec.id],
      formatNote: FORMAT_NOTES[`${grade}:${spec.id}`] ?? SECTION_TITLES[spec.id],
      startQuestion,
      endQuestion,
      count: spec.count,
      scopeLabel,
      part,
    };
  });
}

export function getDaimonSpec(grade: EikenGrade, section: WrittenSection): EikenDaimonSpec | undefined {
  return getDaimonSpecsForGrade(grade).find(spec => spec.section === section);
}

export interface EikenDaimonGroup {
  spec: EikenDaimonSpec;
  rounds: { round: number; chapter: Chapter }[];
}

export function isEikenGradeSubject(subject: string): subject is EikenGrade {
  return EIKEN_GRADES.some(g => g.id === subject && g.available);
}

const BOOKLET_CHAPTER_RE = /^(eiken_[a-z0-9]+)_written_(\d+)_([a-z]+)$/;

export function parseBookletChapterId(chapterId: string): { grade: EikenGrade; round: number; section: ChoiceSection } | null {
  const match = chapterId.match(BOOKLET_CHAPTER_RE);
  if (!match) return null;
  return {
    grade: match[1] as EikenGrade,
    round: Number(match[2]),
    section: match[3] as ChoiceSection,
  };
}

/**
 * 1つのタブ（リーディング練習 / 語彙・文法練習）に含まれる Chapter 配列を
 * - 基礎ウォームアップ章（`eiken_<grade>_vocabulary_01` / `eiken_<grade>_reading_01`）
 * - 大問ごとの第1〜15回グループ（大問番号順 × 第1〜15回順）
 * に整理して返す。元の Chapter / Problem / SubQuestion ID は一切変更しない。
 */
export function partitionEikenTabChapters(
  grade: EikenGrade,
  chapters: readonly Chapter[],
): { warmupChapters: Chapter[]; daimonGroups: EikenDaimonGroup[] } {
  const warmupChapters: Chapter[] = [];
  const bySection = new Map<ChoiceSection, { round: number; chapter: Chapter }[]>();

  for (const chapter of chapters) {
    const parsed = parseBookletChapterId(chapter.id);
    if (!parsed) {
      warmupChapters.push(chapter);
      continue;
    }
    const list = bySection.get(parsed.section) ?? [];
    list.push({ round: parsed.round, chapter });
    bySection.set(parsed.section, list);
  }

  const specs = getDaimonSpecsForGrade(grade);
  const daimonGroups: EikenDaimonGroup[] = [];
  for (const spec of specs) {
    const rounds = bySection.get(spec.section);
    if (!rounds || rounds.length === 0) continue;
    rounds.sort((a, b) => a.round - b.round);
    daimonGroups.push({ spec, rounds });
  }

  return { warmupChapters, daimonGroups };
}
