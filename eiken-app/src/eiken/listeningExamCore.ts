import type { EikenGrade } from './config';

/**
 * まなとび英検 リスニング予想問題 コア型・検証器（C1〜C10対応）
 * -------------------------------------------------------------------
 * - 公式公開資料（2026年度第2回 一次試験問題冊子・原稿PDF・solutions.html）の形式事実のみを参照。
 * - 問題文・選択肢・台本・図版指示はすべて独自執筆（origin: 'manatobi-original'）。
 * - 過去問および他社教材の転載・改変流用・固有名詞／数値置換は禁止。
 */

export type ListeningPartId = 'part1' | 'part2' | 'part3' | 'part4';
export type ListeningSpeakerId = 'M1' | 'M2' | 'F1' | 'F2';
export type ChoicePresentation = 'printed' | 'read-aloud';
export type ListeningImageRole = 'support' | 'scene' | 'material';

export interface ListeningPartBlueprint {
  id: ListeningPartId;
  label: string;
  questionCount: number;
  audioUnitCount: number;
  questionsPerAudio: 1 | 2;
  choiceCount: 3 | 4;
  choicePresentation: ChoicePresentation;
  readCount: 1 | 2;
  imageRole: ListeningImageRole | null;
  targetWordRange: readonly [number, number];
}

export interface ListeningBlueprint {
  grade: EikenGrade;
  label: string;
  minutes: number;
  totalQuestions: number;
  totalAudioFiles: number;
  totalImages: number;
  wpmRange: readonly [number, number];
  source: string;
  parts: readonly ListeningPartBlueprint[];
}

export const LISTENING_BLUEPRINTS: Readonly<Record<EikenGrade, ListeningBlueprint>> = {
  eiken_5: {
    grade: 'eiken_5',
    label: '英検5級',
    minutes: 20,
    totalQuestions: 25,
    totalAudioFiles: 25,
    totalImages: 20,
    wpmRange: [100, 110],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_5/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の応答文選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 3, choicePresentation: 'read-aloud', readCount: 2, imageRole: 'support', targetWordRange: [20, 62] },
      { id: 'part2', label: '第2部 会話の内容一致選択', questionCount: 5, audioUnitCount: 5, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 2, imageRole: null, targetWordRange: [25, 72] },
      { id: 'part3', label: '第3部 イラストの内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 3, choicePresentation: 'read-aloud', readCount: 2, imageRole: 'scene', targetWordRange: [20, 56] },
    ],
  },
  eiken_4: {
    grade: 'eiken_4',
    label: '英検4級',
    minutes: 30,
    totalQuestions: 30,
    totalAudioFiles: 30,
    totalImages: 10,
    wpmRange: [110, 120],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_4/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の応答文選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 3, choicePresentation: 'read-aloud', readCount: 2, imageRole: 'support', targetWordRange: [24, 72] },
      { id: 'part2', label: '第2部 会話の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 2, imageRole: null, targetWordRange: [32, 96] },
      { id: 'part3', label: '第3部 文の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 2, imageRole: null, targetWordRange: [38, 96] },
    ],
  },
  eiken_3: {
    grade: 'eiken_3',
    label: '英検3級',
    minutes: 25,
    totalQuestions: 30,
    totalAudioFiles: 30,
    totalImages: 10,
    wpmRange: [120, 130],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_3/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の応答文選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 3, choicePresentation: 'read-aloud', readCount: 1, imageRole: 'support', targetWordRange: [26, 82] },
      { id: 'part2', label: '第2部 会話の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 2, imageRole: null, targetWordRange: [44, 150] },
      { id: 'part3', label: '第3部 文の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 2, imageRole: null, targetWordRange: [42, 150] },
    ],
  },
  eiken_pre2: {
    grade: 'eiken_pre2',
    label: '英検準2級',
    minutes: 25,
    totalQuestions: 30,
    totalAudioFiles: 30,
    totalImages: 0,
    wpmRange: [130, 140],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_p2/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の応答文選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 3, choicePresentation: 'read-aloud', readCount: 1, imageRole: null, targetWordRange: [28, 92] },
      { id: 'part2', label: '第2部 会話の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [52, 175] },
      { id: 'part3', label: '第3部 文の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [50, 175] },
    ],
  },
  eiken_pre2plus: {
    grade: 'eiken_pre2plus',
    label: '英検準2級プラス',
    minutes: 25,
    totalQuestions: 30,
    totalAudioFiles: 30,
    totalImages: 0,
    wpmRange: [135, 145],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_p2plus/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の内容一致選択', questionCount: 15, audioUnitCount: 15, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [50, 185] },
      { id: 'part2', label: '第2部 文の内容一致選択', questionCount: 15, audioUnitCount: 15, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [48, 195] },
    ],
  },
  eiken_2: {
    grade: 'eiken_2',
    label: '英検2級',
    minutes: 25,
    totalQuestions: 30,
    totalAudioFiles: 30,
    totalImages: 0,
    wpmRange: [140, 150],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_2/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の内容一致選択', questionCount: 15, audioUnitCount: 15, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [52, 200] },
      { id: 'part2', label: '第2部 文の内容一致選択', questionCount: 15, audioUnitCount: 15, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [52, 210] },
    ],
  },
  eiken_pre1: {
    grade: 'eiken_pre1',
    label: '英検準1級',
    minutes: 30,
    totalQuestions: 29,
    totalAudioFiles: 23,
    totalImages: 5,
    wpmRange: [150, 160],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_p1/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の内容一致選択', questionCount: 12, audioUnitCount: 12, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [75, 220] },
      { id: 'part2', label: '第2部 文の内容一致選択', questionCount: 12, audioUnitCount: 6, questionsPerAudio: 2, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [95, 235] },
      { id: 'part3', label: '第3部 Real-Life形式の内容一致選択', questionCount: 5, audioUnitCount: 5, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: 'material', targetWordRange: [68, 210] },
    ],
  },
  eiken_1: {
    grade: 'eiken_1',
    label: '英検1級',
    minutes: 35,
    totalQuestions: 27,
    totalAudioFiles: 21,
    totalImages: 5,
    wpmRange: [160, 170],
    source: 'https://www.eiken.or.jp/eiken/exam/grade_1/solutions.html',
    parts: [
      { id: 'part1', label: '第1部 会話の内容一致選択', questionCount: 10, audioUnitCount: 10, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [80, 235] },
      { id: 'part2', label: '第2部 文の内容一致選択', questionCount: 10, audioUnitCount: 5, questionsPerAudio: 2, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [100, 250] },
      { id: 'part3', label: '第3部 Real-Life形式の内容一致選択', questionCount: 5, audioUnitCount: 5, questionsPerAudio: 1, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: 'material', targetWordRange: [72, 225] },
      { id: 'part4', label: '第4部 インタビューの内容一致選択', questionCount: 2, audioUnitCount: 1, questionsPerAudio: 2, choiceCount: 4, choicePresentation: 'printed', readCount: 1, imageRole: null, targetWordRange: [130, 310] },
    ],
  },
};

export interface DialogueTurn {
  speaker: ListeningSpeakerId;
  roleLabel: 'Man' | 'Woman' | 'Narrator' | 'Interviewer' | 'Guest';
  text: string;
}

export interface RealLifeMaterialSpec {
  title: string;
  situation: string;
  questionText: string;
  headers?: readonly string[];
  rows?: readonly (readonly string[])[];
  notes?: readonly string[];
}

export interface ImagePromptSpec {
  targetPath: string;
  role: ListeningImageRole;
  aspectRatio: '4:3' | '1:1' | '3:4';
  sceneSummaryJa: string;
  chatGptPrompt: string;
}

export interface ListeningQuestionItem {
  id: string;
  questionNumber: number;
  questionPrompt: string;
  choicePresentation: ChoicePresentation;
  choices: readonly string[];
  answer: number;
  explanation: string;
  distractorReasons: readonly string[];
  evidence: string;
  skill: string;
}

export interface ListeningAudioUnit {
  audioId: string;
  part: ListeningPartId;
  unitIndex: number;
  targetAudioPath: string;
  readCount: 1 | 2;
  turns: readonly DialogueTurn[];
  elevenLabsDialogueInput: string;
  translation: string;
  image: ImagePromptSpec | null;
  material?: RealLifeMaterialSpec;
  questions: readonly ListeningQuestionItem[];
}

export interface ListeningExamRound {
  id: string;
  grade: EikenGrade;
  round: number;
  theme: string;
  scene: string;
  focusSkill: string;
  revision: string;
  origin: 'manatobi-original';
  review: 'draft' | 'approved';
  units: readonly ListeningAudioUnit[];
}

export function normalizeEnglishWords(text: string): string[] {
  return text.toLowerCase().replace(/[’]/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) ?? [];
}

export function normalizeEnglishText(text: string): string {
  return normalizeEnglishWords(text).join(' ');
}

/** C1〜C10 に準拠した1回分のリスニング予想問題検証 */
export function validateListeningExam(exam: ListeningExamRound, requireApproved = true): void {
  const blueprint = LISTENING_BLUEPRINTS[exam.grade];
  const expectedExamId = `${exam.grade}_listening_r${String(exam.round).padStart(2, '0')}`;
  if (
    !blueprint ||
    exam.id !== expectedExamId ||
    !Number.isInteger(exam.round) ||
    exam.round < 1 ||
    exam.round > 15 ||
    !exam.revision?.trim() ||
    exam.origin !== 'manatobi-original' ||
    (requireApproved && exam.review !== 'approved')
  ) {
    throw new Error(`LISTENING_EXAM_NOT_RELEASE_READY:${exam.id}`);
  }
  if (JSON.stringify(exam).includes('\uFFFD')) {
    throw new Error(`LISTENING_MOJIBAKE:${exam.id}`);
  }
  if (exam.units.length !== blueprint.totalAudioFiles) {
    throw new Error(`LISTENING_AUDIO_UNIT_COUNT:${exam.id}:${exam.units.length}!=${blueprint.totalAudioFiles}`);
  }

  let unitCursor = 0;
  let questionNumber = 1;
  let imageCount = 0;
  const seenAudioIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  const answerCounts3 = [0, 0, 0];
  const answerCounts4 = [0, 0, 0, 0];

  for (const partSpec of blueprint.parts) {
    for (let u = 0; u < partSpec.audioUnitCount; u++, unitCursor++) {
      const unit = exam.units[unitCursor];
      if (!unit || unit.part !== partSpec.id || unit.unitIndex !== u + 1) {
        throw new Error(`LISTENING_PART_MISMATCH:${exam.id}:${partSpec.id}:${u + 1}`);
      }
      if (!unit.audioId.startsWith(`${exam.id}_`) || seenAudioIds.has(unit.audioId)) {
        throw new Error(`LISTENING_AUDIO_ID_INVALID:${unit.audioId}`);
      }
      seenAudioIds.add(unit.audioId);

      // C8: 音源パス
      if (unit.targetAudioPath !== `/eiken_audio/${unit.audioId}.mp3`) {
        throw new Error(`LISTENING_AUDIO_PATH_INVALID:${unit.targetAudioPath}`);
      }
      // C10: 読み回数
      if (unit.readCount !== partSpec.readCount) {
        throw new Error(`LISTENING_READ_COUNT_MISMATCH:${unit.audioId}`);
      }
      // C7: 和訳
      if (!unit.translation?.trim() || unit.translation.trim().length < 18) {
        throw new Error(`LISTENING_TRANSLATION_MISSING:${unit.audioId}`);
      }
      // 台本・話者検証
      if (!unit.turns.length || unit.turns.some(t => !['M1', 'M2', 'F1', 'F2'].includes(t.speaker) || !t.text.trim())) {
        throw new Error(`LISTENING_TURNS_INVALID:${unit.audioId}`);
      }
      if (!unit.elevenLabsDialogueInput.trim()) {
        throw new Error(`LISTENING_DIALOGUE_INPUT_EMPTY:${unit.audioId}`);
      }

      // C1: 語数レンジ検査（ElevenLabsへ投入する英文発話全体の語数）
      const bodyWords = normalizeEnglishWords(
        unit.turns.map(t => t.text).join(' '),
      ).length;
      if (bodyWords < partSpec.targetWordRange[0] || bodyWords > partSpec.targetWordRange[1]) {
        throw new Error(`LISTENING_WORD_COUNT_OUT_OF_RANGE:${unit.audioId}:${bodyWords} not in [${partSpec.targetWordRange[0]},${partSpec.targetWordRange[1]}]`);
      }

      // C9: 図版有無とプロンプト検証
      if (partSpec.imageRole === null) {
        if (unit.image !== null) {
          throw new Error(`LISTENING_UNEXPECTED_IMAGE:${unit.audioId}`);
        }
      } else {
        if (!unit.image || unit.image.role !== partSpec.imageRole || !unit.image.targetPath.startsWith('/eiken_images/') || unit.image.chatGptPrompt.length < 120) {
          throw new Error(`LISTENING_IMAGE_PROMPT_INVALID:${unit.audioId}`);
        }
        if (!unit.image.chatGptPrompt.includes('ABSOLUTELY NO TEXT')) {
          throw new Error(`LISTENING_IMAGE_NO_TEXT_RULE_MISSING:${unit.audioId}`);
        }
        imageCount++;
      }

      if (partSpec.imageRole === 'material' && (!unit.material || !unit.material.title.trim() || !unit.material.situation.trim())) {
        throw new Error(`LISTENING_MATERIAL_REQUIRED:${unit.audioId}`);
      }

      if (unit.questions.length !== partSpec.questionsPerAudio) {
        throw new Error(`LISTENING_QUESTIONS_PER_AUDIO:${unit.audioId}`);
      }

      const fullSpokenNorm = normalizeEnglishText(
        [
          ...unit.turns.map(t => t.text),
          ...(unit.material?.rows?.flat() ?? []),
          ...(unit.material?.notes ?? []),
        ].join(' '),
      );

      for (const q of unit.questions) {
        const expectedQId = `${exam.id}_q${String(questionNumber).padStart(2, '0')}`;
        if (q.id !== expectedQId || q.questionNumber !== questionNumber || seenQuestionIds.has(q.id)) {
          throw new Error(`LISTENING_QUESTION_ID_MISMATCH:${q?.id}!=${expectedQId}`);
        }
        seenQuestionIds.add(q.id);
        questionNumber++;

        if (q.choicePresentation !== partSpec.choicePresentation || q.choices.length !== partSpec.choiceCount) {
          throw new Error(`LISTENING_CHOICE_SPEC_MISMATCH:${q.id}`);
        }
        // C4: 選択肢の重複検査
        const normChoices = q.choices.map(c => normalizeEnglishText(c));
        if (normChoices.some(c => !c) || new Set(normChoices).size !== partSpec.choiceCount) {
          throw new Error(`LISTENING_DUPLICATE_CHOICES:${q.id}`);
        }
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= partSpec.choiceCount) {
          throw new Error(`LISTENING_ANSWER_OUT_OF_RANGE:${q.id}`);
        }
        if (partSpec.choiceCount === 3) answerCounts3[q.answer]++;
        else answerCounts4[q.answer]++;

        // C5: 誤答理由（全選択肢15文字以上）
        if (q.distractorReasons.length !== partSpec.choiceCount || q.distractorReasons.some(r => r.trim().length < 15) || !q.explanation.trim()) {
          throw new Error(`LISTENING_REASONS_TOO_SHORT:${q.id}`);
        }
        // C6: 根拠一致
        const normEvidence = normalizeEnglishText(q.evidence);
        if (!normEvidence || !fullSpokenNorm.includes(normEvidence)) {
          throw new Error(`LISTENING_EVIDENCE_NOT_IN_TRANSCRIPT:${q.id}:${q.evidence}`);
        }
      }
    }
  }

  if (questionNumber - 1 !== blueprint.totalQuestions) {
    throw new Error(`LISTENING_TOTAL_QUESTIONS_MISMATCH:${exam.id}`);
  }
  if (imageCount !== blueprint.totalImages) {
    throw new Error(`LISTENING_TOTAL_IMAGES_MISMATCH:${exam.id}:${imageCount}!=${blueprint.totalImages}`);
  }

  // C3: 正答位置の偏り検査（極端な偏りを拒否）
  const total3 = answerCounts3.reduce((a, b) => a + b, 0);
  if (total3 > 0) {
    const min3 = Math.floor(total3 / 3) - 2;
    const max3 = Math.ceil(total3 / 3) + 2;
    if (answerCounts3.some(c => c < min3 || c > max3)) {
      throw new Error(`LISTENING_IMBALANCED_3CHOICE_ANSWERS:${exam.id}:${answerCounts3.join(',')}`);
    }
  }
  const total4 = answerCounts4.reduce((a, b) => a + b, 0);
  if (total4 > 0) {
    const min4 = Math.floor(total4 / 4) - 2;
    const max4 = Math.ceil(total4 / 4) + 2;
    if (answerCounts4.some(c => c < min4 || c > max4)) {
      throw new Error(`LISTENING_IMBALANCED_4CHOICE_ANSWERS:${exam.id}:${answerCounts4.join(',')}`);
    }
  }
}

/** C2: 同一級15回分の完全性・非重複検査（ラベル替え・冒頭10語重複を拒否） */
export function validateListeningGradeSeries(exams: readonly ListeningExamRound[], grade: EikenGrade): void {
  if (exams.length !== 15 || new Set(exams.map(e => e.round)).size !== 15 || exams.some(e => e.grade !== grade)) {
    throw new Error(`FIFTEEN_LISTENING_EXAMS_REQUIRED:${grade}`);
  }
  exams.forEach(exam => validateListeningExam(exam));

  const roundSignatures = new Set<string>();
  const unitOpenings = new Set<string>();

  for (const exam of exams) {
    const sig = JSON.stringify(exam.units.map(u => [u.part, u.turns.map(t => t.text), u.questions.map(q => q.choices)]));
    if (roundSignatures.has(sig)) {
      throw new Error(`DUPLICATE_LISTENING_EXAM_CONTENT:${exam.id}`);
    }
    roundSignatures.add(sig);

    for (const unit of exam.units) {
      const words = normalizeEnglishWords(unit.turns.map(t => t.text).join(' '));
      const opening = words.slice(0, Math.min(12, words.length)).join(' ');
      if (unitOpenings.has(opening)) {
        throw new Error(`DUPLICATE_UNIT_OPENING:${unit.audioId}:${opening}`);
      }
      unitOpenings.add(opening);
    }
  }
}
