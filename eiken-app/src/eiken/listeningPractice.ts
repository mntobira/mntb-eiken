import type { AudioTrack, Chapter, Problem, SubQuestion, TrackMaterial } from '../types/curriculum';
import type { EikenGrade } from './config';
import { LISTENING_AUDIO_URLS } from './listeningAudio.generated';
import { LISTENING_IMAGE_URLS } from './listeningImages.generated';
import {
  LISTENING_BLUEPRINTS,
  type ListeningAudioUnit,
  type ListeningExamRound,
  type ListeningPartId,
} from './listeningExamCore';

/**
 * 同一原本（ListeningExamRound）からアプリのリスニング演習 Chapter 群へ変換する。
 * - 筆記の `writtenPractice.ts` と同じ思想：冊子／台本／アプリで問題ID・正答・解説を完全共有。
 * - `LISTENING_AUDIO_URLS` に実音源MP3が登録されている単元（5級全375問、および今後追加される4級〜1級）は
 *   自動的にネイティブ `<audio>` ストリーミング再生（2回連続再生・速度変更・シーク対応）へ切り替わる。
 * - 読み上げ選択肢（choicePresentation === 'read-aloud'）は解答中の画面に英文テキストを出さず
 *   「音声の選択肢 1〜3」とし、解答後の解説画面で全選択肢の英文・和訳・正誤理由を開示する。
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

function buildTrackMaterial(unit: ListeningAudioUnit, resolvedImageUrl?: string): TrackMaterial | undefined {
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
    images: resolvedImageUrl
      ? [{ src: resolvedImageUrl, caption: unit.image?.sceneSummaryJa || unit.material.title }]
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
  const resolvedAudioUrl = LISTENING_AUDIO_URLS[unit.audioId];
  const hasVisibleIllustration = Boolean(resolvedImageUrl);

  const subQuestions: SubQuestion[] = unit.questions.map((q, qIdx) => {
    const isReadAloud = q.choicePresentation === 'read-aloud';
    // 読み上げ選択肢は解答中の画面に英文を出さず「音声の選択肢 1〜3」の簡潔な1行ボタンにする。
    // （既存テスト eiken.test.ts の optionTexts 長さ規約 [3, 4] も完全に維持する。）
    const optionTexts = isReadAloud
      ? q.choices.map((_, idx) => `音声の選択肢 ${idx + 1}`)
      : [...q.choices];

    const choiceBreakdown = q.choices
      .map((text, idx) => `${idx + 1}. ${text} — ${q.distractorReasons[idx]}`)
      .join('\n');

    const questionLabel = isReadAloud
      ? hasVisibleIllustration
        ? `問${q.questionNumber} イラストを見て最も適切な番号を選ぶ`
        : unit.image && qIdx === 0
          ? `問${q.questionNumber} 【場面】${unit.image.sceneSummaryJa}（音声の 1〜${q.choices.length} から選ぶ）`
          : `問${q.questionNumber} 対話の最後の応答として最も適切な番号を選ぶ`
      : `問${q.questionNumber} ${q.questionPrompt}`;

    const isScenePictureOnly =
      isReadAloud && exam.grade === 'eiken_5' && unit.part === 'part3' && !hasVisibleIllustration && Boolean(unit.image);
    const effectiveOptionTexts = isScenePictureOnly
      ? [...q.choices]
      : optionTexts;

    return {
      id: `${q.id}_answer`,
      label: questionLabel,
      type: 'multiple_choice',
      options: q.choices.map((_, idx) => String(idx + 1)),
      optionTexts: effectiveOptionTexts,
      correctAnswer: String(q.answer + 1),
      imageUrl: qIdx === 0 ? resolvedImageUrl : undefined,
      imageCaption: qIdx === 0 && unit.image ? `No.${q.questionNumber}（${unit.image.sceneSummaryJa}）` : undefined,
      skill: q.skill,
      explainJa: `${q.explanation}\n\n【選択肢の英文と理由】\n${choiceBreakdown}`,
      detailedExplanation: {
        theme: `${exam.theme}（${q.skill}）`,
        difficulty: Math.min(
          5,
          Math.max(
            1,
            ['eiken_5', 'eiken_4', 'eiken_3', 'eiken_pre2', 'eiken_pre2plus', 'eiken_2', 'eiken_pre1', 'eiken_1'].indexOf(
              exam.grade,
            ) - 1,
          ),
        ),
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
        ? '本番と同じく音声は2回流れます。最後まで聞いて最も適切な番号を選んでください。'
        : '音声は1回のみ流れます。設問のポイントを意識して聞き取りましょう。',
    audioUrl: resolvedAudioUrl || undefined,
    script,
    turns,
    material: buildTrackMaterial(unit, resolvedImageUrl),
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
    unit.image ? `【イラスト場面】\n${unit.image.sceneSummaryJa}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const promptHeader = unit.image
    ? (resolvedImageUrl ? '' : `【場面】${unit.image.sceneSummaryJa}\n`) +
      (unit.questions[0].choicePresentation === 'read-aloud'
        ? 'イラストを見ながら音声を聞いて、最も適切な応答・説明を選んでください。'
        : unit.questions.map(q => `No.${q.questionNumber}: ${q.questionPrompt}`).join('\n'))
    : unit.questions[0].choicePresentation === 'read-aloud'
      ? '対話を聞いて、最後の質問や発話に対する最も適切な応答を選んでください。'
      : unit.questions.map(q => `No.${q.questionNumber}: ${q.questionPrompt}`).join('\n');

  return {
    id: unit.audioId,
    title: `第${exam.round}回 ${partSpec.label} ${qLabel}`,
    category: `第${exam.round}回 ${partSpec.label} ${qLabel}｜${exam.theme}`,
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
 * - 1回＝本試験1回分の問題数（25〜30問）をそのまま演習・復習できる15章を登録する。
 * - 実音源MP3・実イラストの収録状況をカード見出し＆トピックに明示して受験生が選びやすくする。
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
      const imageUnits = exam.units.filter(u => Boolean(u.image));
      const resolvedImageCount = imageUnits.filter(u => Boolean(LISTENING_IMAGE_URLS[u.audioId])).length;
      const resolvedAudioCount = exam.units.filter(u => Boolean(LISTENING_AUDIO_URLS[u.audioId])).length;

      const statusParts: string[] = [];
      if (resolvedAudioCount === exam.units.length) {
        statusParts.push('専用音声');
      } else if (resolvedAudioCount > 0) {
        statusParts.push(`専用音声${resolvedAudioCount}/${exam.units.length}`);
      }
      if (imageUnits.length > 0 && resolvedImageCount === imageUnits.length) {
        statusParts.push('イラスト完備');
      } else if (imageUnits.length > 0 && resolvedImageCount > 0) {
        statusParts.push(`イラスト${resolvedImageCount}/${imageUnits.length}`);
      }
      const badge = statusParts.length > 0 ? `【${statusParts.join('・')}】` : '';
      const title = `リスニング 第${exam.round}回｜${exam.theme}${badge ? ` ${badge}` : ''}`;
      const partSummary = blueprint.parts.map(p => p.label.replace(/^第(\d+)部\s*/, '第$1部:')).join(' ／ ');

      const detailExtras: string[] = [];
      if (resolvedAudioCount > 0) {
        detailExtras.push(`専用収録MP3 ${resolvedAudioCount}/${exam.units.length}音源`);
      }
      if (imageUnits.length > 0 && resolvedImageCount > 0) {
        detailExtras.push(`白黒線画イラスト ${resolvedImageCount}/${imageUnits.length}問`);
      }

      return {
        id: exam.id,
        title,
        abstractTitle: title,
        realTitle: 'リスニング予想問題（全15回）',
        questionGroup: 'リスニング',
        topics: [
          `テーマ：${exam.theme}（${exam.scene}） ／ 重点：${exam.focusSkill}`,
          `全${blueprint.totalQuestions}問（${partSummary}）${
            detailExtras.length > 0 ? ` ／ ${detailExtras.join('・')}` : ''
          }`,
        ],
        practiceProblems: problems,
        miniTest: [],
        readCount: blueprint.parts[0].readCount,
        marks,
        speakers: 'M1・F1・F2' + (grade === 'eiken_1' ? '・M2' : ''),
      };
    });
}

export interface GradeListeningPartSpec {
  partId: ListeningPartId;
  partNo: number;
  tabTitle: string;
  shortLabel: string;
  questionCount: number;
  audioUnitCount: number;
}

/** 級ごとの本番リスニング部構成（第1部〜第3部／1級は第4部）を LISTENING_BLUEPRINTS から一意に導出 */
export function getGradeListeningPartSpecs(grade: EikenGrade): GradeListeningPartSpec[] {
  const blueprint = LISTENING_BLUEPRINTS[grade];
  if (!blueprint) return [];
  return blueprint.parts.map((part, idx) => {
    const partNo = idx + 1;
    const shortLabel = part.label.replace(/^第\d+部\s*/, '');
    return {
      partId: part.id,
      partNo,
      tabTitle: `リスニング第${partNo}部 ${shortLabel}`,
      shortLabel,
      questionCount: part.questionCount,
      audioUnitCount: part.audioUnitCount,
    };
  });
}

/**
 * 特定のリスニング部（part1〜part4）だけを第1回〜第15回の昇順で並べた Chapter 配列を返す。
 * 筆記の `bookletSectionChapters` と完全に同じ「01. 第1回 → 15. 第15回」構造を実現する。
 */
export function listeningPartChapters(
  exams: readonly ListeningExamRound[],
  grade: EikenGrade,
  partId: ListeningPartId,
  realTitle: string,
): Chapter[] {
  const blueprint = LISTENING_BLUEPRINTS[grade];
  const partSpec = blueprint.parts.find(p => p.id === partId);
  if (!partSpec) return [];

  return exams
    .filter(exam => exam.grade === grade && exam.review === 'approved')
    .sort((a, b) => a.round - b.round)
    .flatMap((exam): Chapter[] => {
      const units = exam.units.filter(u => u.part === partId);
      if (!units.length) return [];
      const problems = units.map(unit => listeningUnitToProblem(exam, unit));
      const marks = problems.reduce((sum, p) => sum + p.subQuestions.length, 0);
      const imageUnits = units.filter(u => Boolean(u.image));
      const resolvedImageCount = imageUnits.filter(u => Boolean(LISTENING_IMAGE_URLS[u.audioId])).length;
      const resolvedAudioCount = units.filter(u => Boolean(LISTENING_AUDIO_URLS[u.audioId])).length;

      const badges: string[] = [];
      if (resolvedAudioCount === units.length) badges.push('専用音声');
      if (imageUnits.length > 0 && resolvedImageCount === imageUnits.length) {
        badges.push('イラスト完備');
      } else if (imageUnits.length > 0 && resolvedImageCount > 0) {
        badges.push(`イラスト${resolvedImageCount}/${imageUnits.length}`);
      }
      const badgeSuffix = badges.length > 0 ? ` 【${badges.join('・')}】` : '';

      const fullTitle = `リスニング 第${exam.round}回｜${partSpec.label}${badgeSuffix}`;
      const shortCardTitle =
        partSpec.questionsPerAudio > 1
          ? `第${exam.round}回（${units.length}音源・計${marks}問）${badgeSuffix}`
          : `第${exam.round}回（全${marks}問）${badgeSuffix}`;
      return [
        {
          id: `${exam.id}_${partId}`,
          title: fullTitle,
          abstractTitle: shortCardTitle,
          realTitle,
          questionGroup: 'リスニング',
          topics: [`${exam.theme}（${exam.scene}）`],
          practiceProblems: problems,
          miniTest: [],
          readCount: partSpec.readCount,
          marks,
          speakers: 'M1・F1・F2' + (grade === 'eiken_1' ? '・M2' : ''),
        },
      ];
    });
}

export function filterUnitsByPart(exam: ListeningExamRound, part: ListeningPartId): readonly ListeningAudioUnit[] {
  return exam.units.filter(u => u.part === part);
}
