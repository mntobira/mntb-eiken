import type { AudioTrack, Chapter, Problem, SubQuestion, TrackMaterial } from '../types/curriculum';
import type { EikenGrade } from './config';
import { LISTENING_IMAGE_URLS } from './listeningImages.generated';
import {
  LISTENING_BLUEPRINTS,
  type ListeningAudioUnit,
  type ListeningExamRound,
  type ListeningPartId,
} from './listeningExamCore';

/**
 * 同一原本（ListeningExamRound）からアプリの分野別リスニング演習 Chapter 群へ変換する。
 * - 筆記の `writtenPractice.ts` と同じ思想：冊子／台本／アプリで問題ID・正答・解説を完全共有。
 * - 読み上げ選択肢（choicePresentation === 'read-aloud'）は解答中の画面に英文テキストを出さず、
 *   「選択肢1 / 選択肢2 / 選択肢3」とし、解答後の解説画面で英文・和訳・全選択肢の理由を開示する。
 * - 準1級・1級 第2部（1パッセージ2問）および 1級 第4部（インタビュー2問）は
 *   1つの Problem に subQuestions 2個・audioTracks 1本（subIds 付き）で本試験どおり連動する。
 * - Real-Life 形式は TrackMaterial（状況・表・条件メモ）を左ペインに表示する。
 */

function roleToTurnWho(roleLabel: string, speaker: string): string {
  if (roleLabel === 'Narrator') return '';
  if (roleLabel === 'Interviewer') return 'Interviewer';
  if (roleLabel === 'Guest') return 'Guest';
  if (speaker === 'M1') return 'A';
  if (speaker === 'F1') return 'B';
  if (speaker === 'M2') return 'C';
  return roleLabel;
}

function buildTrackMaterial(unit: ListeningAudioUnit): TrackMaterial | undefined {
  if (!unit.material) return undefined;
  const sections: NonNullable<TrackMaterial['sections']> = [
    { heading: 'Situation', rows: [unit.material.situation] },
  ];
  if (unit.material.notes?.length) {
    sections.push({ heading: 'Notes', rows: [...unit.material.notes] });
  }
  return {
    title: unit.material.title,
    instruction: unit.material.questionText,
    sections,
    table:
      unit.material.headers && unit.material.rows
        ? {
            headers: [...unit.material.headers],
            rows: unit.material.rows.map(r => [...r]),
          }
        : undefined,
  };
}

export function listeningUnitToProblem(exam: ListeningExamRound, unit: ListeningAudioUnit): Problem {
  const blueprint = LISTENING_BLUEPRINTS[exam.grade];
  const partSpec = blueprint.parts.find(p => p.id === unit.part)!;
  const firstNo = unit.questions[0].questionNumber;
  const lastNo = unit.questions[unit.questions.length - 1].questionNumber;
  const qLabel = firstNo === lastNo ? `No.${firstNo}` : `No.${firstNo}–${lastNo}`;

  const resolvedImageUrl = LISTENING_IMAGE_URLS[unit.audioId];

  const subQuestions: SubQuestion[] = unit.questions.map((q, qIdx) => {
    const isReadAloud = q.choicePresentation === 'read-aloud';
    const optionTexts = isReadAloud
      ? q.choices.map((_, idx) => `選択肢 ${idx + 1}（音声で読み上げ）`)
      : [...q.choices];
    const choiceBreakdown = q.choices
      .map((text, idx) => `${idx + 1}. ${text} — ${q.distractorReasons[idx]}`)
      .join('\n');

    return {
      id: `${q.id}_answer`,
      label: isReadAloud ? `No.${q.questionNumber}（音声の選択肢 1〜${q.choices.length} から選ぶ）` : q.questionPrompt,
      type: 'multiple_choice',
      options: q.choices.map((_, idx) => String(idx + 1)),
      optionTexts,
      correctAnswer: String(q.answer + 1),
      imageUrl: qIdx === 0 ? resolvedImageUrl : undefined,
      imageCaption: qIdx === 0 && unit.image ? `No.${q.questionNumber} イラスト（${unit.image.sceneSummaryJa}）` : undefined,
      skill: q.skill,
      explainJa: `${q.explanation}\n\n【選択肢の英文と理由】\n${choiceBreakdown}`,
      detailedExplanation: {
        theme: `${exam.theme}（${q.skill}）`,
        difficulty: Math.min(5, Math.max(1, ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1', 'eiken_1'].indexOf(exam.grade) - 1)),
        steps: [q.evidence, q.explanation],
      },
      distractors: q.distractorReasons.map((why, idx) => ({
        no: idx + 1,
        why: `${q.choices[idx]}：${why}`,
      })),
    };
  });

  const turns = unit.turns.map(t => ({
    who: roleToTurnWho(t.roleLabel, t.speaker),
    text: t.text,
  }));

  const script = unit.turns
    .map(t => (t.roleLabel === 'Narrator' ? t.text : `${t.roleLabel}: ${t.text}`))
    .join('\n');

  const track: AudioTrack = {
    subId: subQuestions[0].id,
    subIds: subQuestions.length > 1 ? subQuestions.map(s => s.id) : undefined,
    label: qLabel,
    hint:
      unit.readCount === 2
        ? '音声は2回流れます（現在はブラウザ読み上げフォールバック／ElevenLabs音源配置後は録音再生）。'
        : '音声は1回のみ流れます。聞き終えてから解答してください。',
    // 実ファイル配備前は undefined にしてブラウザ読み上げフォールバックを有効化する
    audioUrl: undefined,
    script,
    turns,
    material: buildTrackMaterial(unit),
    translation: unit.translation,
    keyPhrases: unit.questions.map(q => ({
      phrase: q.evidence,
      meaning: q.explanation,
    })),
  };

  const fullExplanation = [
    `【和訳】\n${unit.translation}`,
    ...unit.questions.map(
      q =>
        `【No.${q.questionNumber} 正答：${q.answer + 1}】${q.questionPrompt}\n根拠：${q.evidence}\n解説：${q.explanation}\n` +
        q.choices.map((c, idx) => `  ${idx + 1}. ${c} — ${q.distractorReasons[idx]}`).join('\n'),
    ),
    unit.image
      ? resolvedImageUrl
        ? `【イラスト場面】\n${unit.image.sceneSummaryJa}`
        : `【図版設定（未生成時は場面説明を参照）】\n場面：${unit.image.sceneSummaryJa}\n予定パス：${unit.image.targetPath}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptHeader = unit.image
    ? (resolvedImageUrl ? '' : `【場面ガイド】${unit.image.sceneSummaryJa}\n`) +
      (unit.questions[0].choicePresentation === 'read-aloud'
        ? 'イラストを見ながら音声を聞いて、最も適切な応答・説明を 1〜3 から選んでください。'
        : unit.questions.map(q => `No.${q.questionNumber}: ${q.questionPrompt}`).join('\n'))
    : unit.questions[0].choicePresentation === 'read-aloud'
      ? '対話を聞いて、最後の質問や発話に対する最も適切な応答を 1〜3 から選んでください。'
      : unit.questions.map(q => `No.${q.questionNumber}: ${q.questionPrompt}`).join('\n');

  return {
    id: unit.audioId,
    title: `第${exam.round}回 ${partSpec.label} ${qLabel}`,
    category: `第${exam.round}回 ${exam.theme}（${exam.focusSkill}）`,
    text: promptHeader,
    readCount: unit.readCount,
    playOnce: unit.readCount === 1,
    stepwise: true,
    subQuestions,
    audioTracks: [track],
    explanation: fullExplanation,
    surroundingKnowledge: [],
    deepDiveTopics: [],
  };
}

/**
 * 級ごとのリスニング予想問題 Chapter 一覧を生成する。
 * - 各部の単元（例：「予想問題｜第1部 会話の応答文選択（全15回）」）として整理し、
 *   また回ごとの通し演習（「リスニング 第1回（25問）」〜「リスニング 第15回」）も提供する。
 *   ただし重複計上を防ぐため、アプリの `partsForGrade` には「回別（第1回〜第15回）」の15章として登録し、
 *   1回＝本試験1回分の問題数（25〜30問）をそのまま演習・復習できるようにする。
 */
export function listeningBookletChapters(
  exams: readonly ListeningExamRound[],
  grade: EikenGrade,
): Chapter[] {
  const blueprint = LISTENING_BLUEPRINTS[grade];
  return exams
    .filter(exam => exam.grade === grade && exam.review === 'approved')
    .sort((a, b) => a.round - b.round)
    .map((exam): Chapter => {
      const problems = exam.units.map(unit => listeningUnitToProblem(exam, unit));
      const marks = problems.reduce((sum, p) => sum + p.subQuestions.length, 0);
      const title = `リスニング 第${exam.round}回｜${exam.theme}`;
      return {
        id: exam.id,
        title,
        abstractTitle: title,
        realTitle: 'リスニング予想問題（全15回）',
        questionGroup: 'リスニング',
        topics: [
          `テーマ：${exam.theme} ／ 場面：${exam.scene} ／ 重点：${exam.focusSkill}`,
          `全${blueprint.totalQuestions}問・${blueprint.totalAudioFiles}音源（独自作成・過去問流用なし）`,
        ],
        practiceProblems: problems,
        miniTest: [],
        readCount: blueprint.parts[0].readCount,
        marks,
        speakers: 'M1・F1・F2' + (grade === 'eiken_1' ? '・M2' : ''),
      };
    });
}

export function filterUnitsByPart(exam: ListeningExamRound, part: ListeningPartId): readonly ListeningAudioUnit[] {
  return exam.units.filter(u => u.part === part);
}
