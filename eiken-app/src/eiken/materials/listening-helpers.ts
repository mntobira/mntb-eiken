import type { EikenGrade } from '../config';
import {
  LISTENING_BLUEPRINTS,
  type ChoicePresentation,
  type DialogueTurn,
  type ImagePromptSpec,
  type ListeningAudioUnit,
  type ListeningExamRound,
  type ListeningImageRole,
  type ListeningPartId,
  type ListeningQuestionItem,
  type ListeningSpeakerId,
  type RealLifeMaterialSpec,
} from '../listeningExamCore';

/**
 * 全級共通の画像生成マスタープロンプト（仕様書 第6章 6.3 スタイルバイブル準拠）
 * - ユーザー側で ChatGPT (GPT Image) に投入する。
 * - 白黒線画・文字／数字／記号は完全禁止（看板・本・値札・画面はすべて空白）。
 */
export function buildChatGptImagePrompt(
  role: ListeningImageRole,
  aspectRatio: '4:3' | '1:1' | '3:4',
  bodyLines: readonly string[],
): string {
  return [
    'Create a simple black-and-white line drawing for a Japanese English-test app. Match the attached reference image\'s line weight, character proportions and shading style exactly.',
    '',
    'STYLE',
    '- Monochrome line art only. White fill. Shading with hatching and thin parallel lines. No grey wash, no gradients, no blur, no gloss.',
    '- Uniform line width, like a 2.5px pen. All outlines closed.',
    '- Characters: 5 to 6 heads tall, simplified symbolic faces (dot eyes, small line mouth). Not resembling any real person.',
    '- Plain white background. Draw only the objects the scene needs.',
    '- ABSOLUTELY NO TEXT, NUMBERS, LETTERS OR SYMBOLS anywhere in the image. Signs, price tags, book covers, screens and labels must be BLANK.',
    '- One situation per image. The main action is centred and fills 60% or more of the frame. No borders, no frames, no captions.',
    '',
    'NEGATIVE',
    '- no colour, no photo, no 3D render, no anime style, no chibi, no watermark, no signature, no extra limbs, no text of any kind',
    '',
    `ASPECT RATIO: ${aspectRatio}`,
    '',
    `SCENE SPECIFICATION (${role.toUpperCase()})`,
    ...bodyLines,
  ].join('\n');
}

export function buildSupportImageSpec(
  audioId: string,
  sceneSummaryJa: string,
  whoEn: string,
  placeEn: string,
  actionEn: string,
  propsEn: string,
): ImagePromptSpec {
  const targetPath = `/eiken_images/${audioId}.png`;
  return {
    targetPath,
    role: 'support',
    aspectRatio: '4:3',
    sceneSummaryJa,
    chatGptPrompt: buildChatGptImagePrompt('support', '4:3', [
      `Draw ${whoEn} in ${placeEn}, ${actionEn}.`,
      `Show only what is needed to understand who is present and what is happening. Do NOT visually reveal the spoken response.`,
      `Keep the background plain with only: ${propsEn}.`,
    ]),
  };
}

export function buildSceneImageSpec(
  audioId: string,
  sceneSummaryJa: string,
  mainActionEn: string,
  subAction1En: string,
  subAction2En: string,
  settingEn: string,
  propsEn: string,
): ImagePromptSpec {
  const targetPath = `/eiken_images/${audioId}.png`;
  return {
    targetPath,
    role: 'scene',
    aspectRatio: '4:3',
    sceneSummaryJa,
    chatGptPrompt: buildChatGptImagePrompt('scene', '4:3', [
      'Draw a single scene where three distinct elements/actions exist so the listener must hear the sentence carefully:',
      `  1. MAIN SUBJECT (LARGE, centred): ${mainActionEn}`,
      `  2. SECONDARY BACKGROUND ELEMENT (small, background left): ${subAction1En}`,
      `  3. SECONDARY EDGE ELEMENT (small, background right): ${subAction2En}`,
      `Setting: ${settingEn}. Background objects only: ${propsEn}.`,
      'Differentiate actions clearly by posture and held objects, never by colour or text.',
    ]),
  };
}

export function buildMaterialImageSpec(
  audioId: string,
  sceneSummaryJa: string,
  docTypeEn: string,
  rowCount: number,
  colCount: number,
  iconHintEn: string,
): ImagePromptSpec {
  const targetPath = `/eiken_images/${audioId}.png`;
  return {
    targetPath,
    role: 'material',
    aspectRatio: '3:4',
    sceneSummaryJa,
    chatGptPrompt: buildChatGptImagePrompt('material', '3:4', [
      `Draw a clean blank ${docTypeEn} layout frame (${rowCount} rows by ${colCount} columns ruled grid) with simple small monochrome icons (${iconHintEn}) in the header margin.`,
      'Leave ALL cells, headings and labels completely BLANK (no letters, no digits, no pseudo-text) because exact English text and numbers are overlaid by the app HTML/PDF renderer.',
    ]),
  };
}

export function formatElevenLabsDialogue(turns: readonly DialogueTurn[]): string {
  return turns.map(t => `${t.roleLabel}: ${t.text}`).join('\n');
}

/**
 * 正答インデックスを指定位置 `targetAnswer` に配置するよう選択肢と理由を決定論的に並べ替える。
 * 元配列は index 0 を正答として記述できるようにし、出題位置の偏り（C3）を完全に均等化する。
 */
export function placeCorrectAt(
  correctChoice: string,
  correctReason: string,
  wrongChoices: readonly [string, string] | readonly [string, string, string],
  wrongReasons: readonly [string, string] | readonly [string, string, string],
  targetAnswer: number,
): { choices: string[]; reasons: string[]; answer: number } {
  const choices = [...wrongChoices];
  const reasons = [...wrongReasons];
  choices.splice(targetAnswer, 0, correctChoice);
  reasons.splice(targetAnswer, 0, correctReason);
  return { choices, reasons, answer: targetAnswer };
}

export const GRADE_THEMES: Readonly<Record<EikenGrade, readonly string[]>> = {
  eiken_5: ['家族', '友達', '学校', '趣味', '旅行', '買い物', 'スポーツ', '映画', '音楽', '食事', '天気', '道案内', '自己紹介', '休日の予定', '近況報告'],
  eiken_4: ['家族', '友達', '学校', '趣味', '旅行', '買い物', 'スポーツ', '映画', '音楽', '食事', '天気', '道案内', '自己紹介', '近況報告', '海外の文化'],
  eiken_3: ['学校', '趣味', '旅行', '買い物', 'スポーツ', '映画', '音楽', '食事', '天気', '道案内', '海外の文化', '人物紹介', '歴史', '家族', '近況報告'],
  eiken_pre2: ['学校', '趣味', '旅行', '買い物', 'スポーツ', '映画', '音楽', '食事', '道案内', '海外の文化', '人物紹介', '歴史', '教育', '科学', '自然・環境'],
  eiken_pre2plus: ['学校', '仕事', '趣味', '旅行', '買い物', 'スポーツ', '音楽', '食事', '海外の文化', '歴史', '教育', '科学', '自然・環境', 'テクノロジー', '人物紹介'],
  eiken_2: ['仕事', '教育', '科学', '自然・環境', 'テクノロジー', '医療', 'ビジネス', '歴史', '海外の文化', '人物紹介', '旅行', '買い物', 'スポーツ', '音楽', '学校'],
  eiken_pre1: ['社会生活一般', '芸術', '文化', '歴史', '教育', '科学', '自然・環境', '医療', 'テクノロジー', 'ビジネス', '政治', '労働・雇用', '都市・交通', '消費者問題', '食と農'],
  eiken_1: ['社会生活一般', '芸術', '文化', '歴史', '教育', '科学', '自然・環境', '医療', 'テクノロジー', 'ビジネス', '政治', '司法・倫理', '国際関係', '学術研究', '金融・経済'],
};

export const GRADE_SKILLS: Readonly<Record<EikenGrade, readonly string[]>> = {
  eiken_5: ['場所', '人物', '時刻', '値段', '持ち物', '動作', '天気', '予定', '理由', '数量', '色・形', '曜日', '交通', '感情', '総合'],
  eiken_4: ['場所', '人物関係', '時刻・順序', '値段・数量', '予定変更', '理由', '比較', '依頼', '手段', '天気・季節', '経験', '誘い', '謝罪', '提案', '総合'],
  eiken_3: ['理由', '場所', '時刻・順序', '数量', '予定変更', '依頼内容', '比較', '手段・方法', '経験', '誘い・断り', '問題点', '提案', '感情・評価', '出来事の順序', '総合'],
  eiken_pre2: ['問題点の把握', '理由', '依頼内容', '予定変更', '比較・選択', '手段', '経験', '誘い・断り', '数値の聞き取り', '話者の意図', '結果', '条件', '評価', '提案', '総合'],
  eiken_pre2plus: ['会話：問題点', '会話：意図', '会話：条件', '文：原因', '文：結果', '文：数値', '会話：比較', '文：対比', '会話：依頼', '文：目的', '文：過程', '会話：評価', '文：予測', '会話：交渉', '総合'],
  eiken_2: ['会話：意図', '会話：問題点', '会話：条件', '文：原因と結果', '文：数値と比較', '文：目的', '会話：依頼・断り', '文：対比', '会話：評価', '文：過程', '文：予測', '会話：交渉', '文：定義', '会話：含意', '総合'],
  eiken_pre1: ['会話：含意', '会話：意図', '文：論旨', '文：原因', 'Real-Life：条件照合', '会話：問題点', '文：対比', 'Real-Life：優先順位', '文：数値', '会話：評価', '文：予測', 'Real-Life：除外条件', '文：語彙推測', '会話：交渉', '総合'],
  eiken_1: ['会話：含意', '文：論旨と根拠', 'Real-Life：条件照合', 'インタビュー：主張', '会話：皮肉・婉曲', '文：歴史的因果', 'Real-Life：優先順位', 'インタビュー：評価', '文：学術的定義', '会話：多者交渉', '文：統計の解釈', 'Real-Life：除外条件', '文：批判的読解', '会話：前提の共有', '総合'],
};

export const SCENES_ROTATION = ['家庭', '学校', '地域', '電話', 'アナウンス', '職場', '店舗', '公共施設'] as const;

export function makeDialogueUnit(params: {
  examId: string;
  part: ListeningPartId;
  unitIndex: number;
  readCount: 1 | 2;
  turns: DialogueTurn[];
  translation: string;
  image: ImagePromptSpec | null;
  material?: RealLifeMaterialSpec;
  questions: ListeningQuestionItem[];
}): ListeningAudioUnit {
  const audioId = `${params.examId}_${params.part}_${String(params.unitIndex).padStart(2, '0')}`;
  return {
    audioId,
    part: params.part,
    unitIndex: params.unitIndex,
    targetAudioPath: `/eiken_audio/${audioId}.mp3`,
    readCount: params.readCount,
    turns: params.turns,
    elevenLabsDialogueInput: formatElevenLabsDialogue(params.turns),
    translation: params.translation,
    image: params.image,
    material: params.material,
    questions: params.questions,
  };
}

export function speakerPairFor(round: number, unitIndex: number): [
  { speaker: ListeningSpeakerId; roleLabel: 'Man' | 'Woman' },
  { speaker: ListeningSpeakerId; roleLabel: 'Man' | 'Woman' },
] {
  const manFirst = (round + unitIndex) % 2 === 0;
  return manFirst
    ? [{ speaker: 'M1', roleLabel: 'Man' }, { speaker: 'F1', roleLabel: 'Woman' }]
    : [{ speaker: 'F1', roleLabel: 'Woman' }, { speaker: 'M1', roleLabel: 'Man' }];
}

export function buildExamRound(
  grade: EikenGrade,
  round: number,
  units: readonly ListeningAudioUnit[],
): ListeningExamRound {
  const blueprint = LISTENING_BLUEPRINTS[grade];
  if (!blueprint) throw new Error(`Unknown grade ${grade}`);
  const id = `${grade}_listening_r${String(round).padStart(2, '0')}`;
  return {
    id,
    grade,
    round,
    theme: GRADE_THEMES[grade][round - 1],
    scene: SCENES_ROTATION[(round - 1) % SCENES_ROTATION.length],
    focusSkill: GRADE_SKILLS[grade][round - 1],
    revision: 'original-listening-20261111-v1',
    origin: 'manatobi-original',
    review: 'approved',
    units,
  };
}

export function makeQuestionItem(params: {
  examId: string;
  questionNumber: number;
  questionPrompt: string;
  choicePresentation: ChoicePresentation;
  correctChoice: string;
  correctReason: string;
  wrongChoices: readonly [string, string] | readonly [string, string, string];
  wrongReasons: readonly [string, string] | readonly [string, string, string];
  targetAnswer: number;
  explanation: string;
  evidence: string;
  skill: string;
}): ListeningQuestionItem {
  const placed = placeCorrectAt(
    params.correctChoice,
    params.correctReason,
    params.wrongChoices,
    params.wrongReasons,
    params.targetAnswer,
  );
  return {
    id: `${params.examId}_q${String(params.questionNumber).padStart(2, '0')}`,
    questionNumber: params.questionNumber,
    questionPrompt: params.questionPrompt,
    choicePresentation: params.choicePresentation,
    choices: placed.choices,
    answer: placed.answer,
    explanation: params.explanation,
    distractorReasons: placed.reasons,
    evidence: params.evidence,
    skill: params.skill,
  };
}
