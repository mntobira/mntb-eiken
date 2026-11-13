import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EIKEN_GRADES } from '../src/eiken/config';
import {
  LISTENING_BLUEPRINTS,
  validateListeningGradeSeries,
} from '../src/eiken/listeningExamCore';
import {
  ALL_LISTENING_EXAMS,
  LISTENING_EXAMS_BY_GRADE,
} from '../src/eiken/materials/listening-booklets';

for (const grade of EIKEN_GRADES) {
  validateListeningGradeSeries(LISTENING_EXAMS_BY_GRADE[grade.id], grade.id);
}

mkdirSync('deliverables', { recursive: true });

const rawJson = JSON.stringify(ALL_LISTENING_EXAMS);
const sourceHash = createHash('sha256').update(rawJson).digest('hex');

// 1. 完全原本 JSON（統合PDF・問題解答解説PDFの入力）
writeFileSync(
  'deliverables/listening-booklets.json',
  JSON.stringify(
    {
      sourceHash,
      generatedAt: '2026-11-12',
      provenance: '完全独自作成（origin: manatobi-original）｜過去問の流用禁止・固有名詞や数値の置換流用なし',
      grades: EIKEN_GRADES,
      blueprints: LISTENING_BLUEPRINTS,
      booklets: ALL_LISTENING_EXAMS,
    },
    null,
    2,
  ) + '\n',
);

// 2. ElevenLabs 音声プロンプト専用 JSON（3,285音源）
const audioEntries = ALL_LISTENING_EXAMS.flatMap(exam => {
  const bp = LISTENING_BLUEPRINTS[exam.grade];
  return exam.units.map(unit => ({
    examId: exam.id,
    grade: exam.grade,
    gradeLabel: bp.label,
    round: exam.round,
    part: unit.part,
    unitIndex: unit.unitIndex,
    audioId: unit.audioId,
    targetAudioPath: unit.targetAudioPath,
    wpmRange: bp.wpmRange,
    readCountInExam: unit.readCount,
    speakers: [...new Set(unit.turns.map(t => t.speaker))],
    turns: unit.turns,
    elevenLabsDialogueInput: unit.elevenLabsDialogueInput,
    questionNumbers: unit.questions.map(q => q.questionNumber),
  }));
});

writeFileSync(
  'deliverables/eiken-elevenlabs-audio-prompts.json',
  JSON.stringify(
    {
      sourceHash,
      totalAudioUnits: audioEntries.length,
      voiceSlots: [
        { id: 'M1', role: '男性1（Man / A / 独話）' },
        { id: 'M2', role: '男性2（第3話者 / 1級Interviewer）' },
        { id: 'F1', role: '女性1（Woman / B / 独話 / Guest）' },
        { id: 'F2', role: '女性2（設問ナレーション Question. / Number one...）' },
      ],
      note: '1ファイル＝1回読みの音源として生成・保存してください。2回読みはアプリ側で制御します。日本語・記号ラベルは発音させないでください。',
      items: audioEntries,
    },
    null,
    2,
  ) + '\n',
);

// 3. ChatGPT 画像プロンプト専用 JSON（750図版）
const imageEntries = ALL_LISTENING_EXAMS.flatMap(exam => {
  const bp = LISTENING_BLUEPRINTS[exam.grade];
  return exam.units
    .filter(unit => unit.image !== null)
    .map(unit => ({
      examId: exam.id,
      grade: exam.grade,
      gradeLabel: bp.label,
      round: exam.round,
      part: unit.part,
      unitIndex: unit.unitIndex,
      questionNumbers: unit.questions.map(q => q.questionNumber),
      audioId: unit.audioId,
      targetImagePath: unit.image!.targetPath,
      role: unit.image!.role,
      aspectRatio: unit.image!.aspectRatio,
      sceneSummaryJa: unit.image!.sceneSummaryJa,
      chatGptPrompt: unit.image!.chatGptPrompt,
    }));
});

writeFileSync(
  'deliverables/eiken-chatgpt-image-prompts.json',
  JSON.stringify(
    {
      sourceHash,
      totalImagePrompts: imageEntries.length,
      note: 'ChatGPT (GPT Image) にスタイル参照画像1枚を添付して投入してください。画像内への文字・数字・記号の描き込みは完全禁止です。',
      items: imageEntries,
    },
    null,
    2,
  ) + '\n',
);

// 4. 収録管理用 TSV
const tsvHeader = ['grade', 'round', 'part', 'question_nos', 'audio_id', 'target_audio_path', 'read_count', 'wpm_range', 'speakers', 'dialogue_single_line'].join('\t');
const tsvLines = audioEntries.map(a =>
  [
    a.grade,
    a.round,
    a.part,
    a.questionNumbers.join(','),
    a.audioId,
    a.targetAudioPath,
    a.readCountInExam,
    a.wpmRange.join('-'),
    a.speakers.join(','),
    a.elevenLabsDialogueInput.replace(/\s+/g, ' '),
  ].join('\t'),
);
writeFileSync('deliverables/eiken-listening-segments.tsv', [tsvHeader, ...tsvLines].join('\n') + '\n');

console.log(
  `Exported 120 listening booklets | ${audioEntries.length} ElevenLabs audio prompts | ${imageEntries.length} ChatGPT image prompts (SHA-256: ${sourceHash.slice(0, 16)}...)`,
);
