import { EIKEN_GRADES, type EikenGrade } from '../../eiken/config';
import type { SugorokuWritingSubmissionDoc } from '../shared/types';

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
    `■ 出力してほしい形式（このまま講師が最終確認・編集して生徒へ返却します）`,
    `1. 【英検4観点スコア案（各0〜4点・合計16点満点）】`,
    `   - 内容（Content）：□ / 4点（課題で求められた要素・理由2つ等に的確に答えているか）`,
    `   - 構成（Structure）：□ / 4点（論理展開・接続表現 First / Second / Therefore 等が自然か）`,
    `   - 語彙（Vocabulary）：□ / 4点（${gradeLabel}に適した語句・スペルが正確に使えているか）`,
    `   - 文法（Grammar）：□ / 4点（主語と動詞の一致・時制・冠詞・文構造が正確か）`,
    `   - 合計：□□ / 16点`,
    `2. 【良かった点（褒めポイント 2点）】`,
    `3. 【最優先で直すともっと伸びるポイント（2点に絞って具体的に）】`,
    `4. 【生徒の元の文を活かした添削例（Corrected Version・語数明記）】`,
    `5. 【次回授業・宿題に向けた一言アドバイス】`,
  );

  return lines.join('\n');
}
