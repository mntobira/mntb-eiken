import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import type {
  SugorokuWritingRubricScores,
  SugorokuWritingSubmissionDoc,
} from '../shared/types';

export interface WritingPromptContext {
  grade: EikenGrade;
  taskTitle: string;
  instruction: string;
  sourceText?: string;
  targetWordsLabel?: string;
  modelAnswer?: string;
}

/**
 * 講師手元の Gemini / ChatGPT にそのまま貼り付けて添削下書きを作れる
 * 「英検4観点採点＋優しい添削補助プロンプト」を生成する（API従量課金ゼロ運用）。
 * さらに出力フォーマットを固定タグ付きにすることで、AIの返答を1クリックで添削フォームへ自動取り込み可能にしている。
 */
export function buildWritingAiReviewPrompt(
  submission: Pick<
    SugorokuWritingSubmissionDoc,
    'studentName' | 'grade' | 'taskKey' | 'taskTitle' | 'wordCount' | 'text' | 'formatWarnings'
  >,
  context?: Partial<WritingPromptContext>,
): string {
  const gradeLabel =
    EIKEN_GRADES.find(g => g.id === submission.grade)?.label ?? submission.grade;
  const title = context?.taskTitle || submission.taskTitle || submission.taskKey;
  const targetWords = context?.targetWordsLabel || '課題指定語数';

  const lines: string[] = [
    `あなたはオンライン個別指導塾「すごろく」の英検対策担当講師のアシスタントです。`,
    `以下の高校生（${submission.studentName} さん）が書いた【${gradeLabel} ライティング答案】について、英検公式の4観点ルーブリックに基づく採点案と、生徒の元の意図・英語レベルを尊重した添削案を作成してください。`,
    ``,
    `■ 指導方針（重要）`,
    `- 対象は部活動と両立しながら最短合格を目指す高校生です。自信を失わせない温かく具体的な声掛けにしてください。`,
    `- C1/C2レベルの難解すぎる語彙への書き換えは避け、${gradeLabel}（CEFR基準・パス単レベル）で確実に使いこなせる自然な英語で添削してください。`,
    ``,
    `■ 課題情報`,
    `- 対象級：${gradeLabel}`,
    `- 課題名：${title}`,
    `- 目安語数：${targetWords}`,
  ];

  if (context?.instruction) {
    lines.push(`- 指示文：\n${context.instruction.trim()}`);
  }
  if (context?.sourceText) {
    lines.push(`- 元の英文（Eメール／要約元本文）：\n${context.sourceText.trim()}`);
  }
  if (context?.modelAnswer) {
    lines.push(`- 参考模範解答（比較基準）：\n${context.modelAnswer.trim()}`);
  }

  lines.push(
    ``,
    `■ 生徒の提出答案（語数：${submission.wordCount} words）`,
    `"""`,
    submission.text.trim(),
    `"""`,
  );

  if (submission.formatWarnings.length > 0) {
    lines.push(
      ``,
      `■ アプリ自動形式チェックの検出事項`,
      ...submission.formatWarnings.map(w => `- ${w}`),
    );
  }

  lines.push(
    ``,
    `■ 出力形式（管理画面への自動取り込みに対応するため、以下の見出し記号をそのまま使って出力してください）`,
    `[SCORES]`,
    `内容（Content）: X/4`,
    `構成（Structure）: X/4`,
    `語彙（Vocabulary）: X/4`,
    `文法（Grammar）: X/4`,
    `[/SCORES]`,
    ``,
    `[CORRECTED]`,
    `（生徒の元の文を活かした自然な修正英文のみをここに記載）`,
    `[/CORRECTED]`,
    ``,
    `[COMMENT]`,
    `（生徒へ返却する温かい総合講評と、最優先で直すと伸びるポイント2点を日本語で記載）`,
    `[/COMMENT]`,
    ``,
    `[STRENGTHS]`,
    `（◎ 良かった点を1〜2行で記載）`,
    `[/STRENGTHS]`,
    ``,
    `[NEXT_ACTIONS]`,
    `（▶ 次回意識するアクションを1〜2行で記載）`,
    `[/NEXT_ACTIONS]`,
  );

  return lines.join('\n');
}

export interface ParsedAiWritingDraft {
  rubricScores: Partial<SugorokuWritingRubricScores>;
  correctedText?: string;
  comment?: string;
  strengths?: string;
  nextActions?: string;
}

function clamp0to4(val: number): number {
  return Math.max(0, Math.min(4, Math.round(val)));
}

/**
 * Gemini / ChatGPT からコピーした返答テキストを解析し、
 * 4観点スコア・添削英文・講評コメント・良かった点・次回アクションを自動抽出する。
 * タグ形式（[SCORES]..[/SCORES]）にも、自由な箇条書き形式にも柔軟に対応する。
 */
export function parseAiReviewResponse(rawResponse: string): ParsedAiWritingDraft {
  const text = String(rawResponse ?? '').trim();
  const rubricScores: Partial<SugorokuWritingRubricScores> = {};

  const matchScore = (pattern: RegExp): number | undefined => {
    const m = pattern.exec(text);
    if (!m) return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) ? clamp0to4(n) : undefined;
  };

  const c = matchScore(/(?:内容|Content)[^\d\n]{0,16}([0-4])(?:\s*\/\s*4|\s*点)?/i);
  const s = matchScore(/(?:構成|Structure)[^\d\n]{0,16}([0-4])(?:\s*\/\s*4|\s*点)?/i);
  const v = matchScore(/(?:語彙|Vocabulary)[^\d\n]{0,16}([0-4])(?:\s*\/\s*4|\s*点)?/i);
  const g = matchScore(/(?:文法|Grammar)[^\d\n]{0,16}([0-4])(?:\s*\/\s*4|\s*点)?/i);

  if (c !== undefined) rubricScores.content = c;
  if (s !== undefined) rubricScores.structure = s;
  if (v !== undefined) rubricScores.vocabulary = v;
  if (g !== undefined) rubricScores.grammar = g;

  const extractTag = (tag: string): string | undefined => {
    const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
    const m = re.exec(text);
    if (!m) return undefined;
    const cleaned = m[1].replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    return cleaned || undefined;
  };

  const correctedText = extractTag('CORRECTED');
  const comment = extractTag('COMMENT');
  const strengths = extractTag('STRENGTHS');
  const nextActions = extractTag('NEXT_ACTIONS');

  // タグなしで返ってきた場合のフォールバック：全体を講評コメントとして取り込む
  if (!comment && !correctedText && text.length > 0) {
    return {
      rubricScores,
      comment: text,
    };
  }

  return {
    rubricScores,
    correctedText,
    comment,
    strengths,
    nextActions,
  };
}
