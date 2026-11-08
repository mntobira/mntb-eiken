import { memo } from 'react';
import { splitMathPieces, renderLatex } from '../../utils/mathTypeset';
import { sanitizeInlineHtml } from '../../utils/sanitizeHtml';
import { formatText } from '../../utils/textFormatter';

/**
 * ===================================================================
 * BattleText — 対戦画面の問題文・選択肢の描画
 * ===================================================================
 *
 * ご指摘（原文）：
 *   > 後文字をしっかりと反映させろって言ったよね？
 *
 * ■ 何が起きていたか（添付スクリーンショットで確認）
 *   対戦の問題文に
 *     「<u>二酸化硫黄</u>」…… HTML タグがそのまま文字として見えている
 *     「FeSO4 水溶液 + H2O2」…… 化学式の下付き数字が普通の数字のまま
 *   が出ていた。演習画面では同じ問題が
 *     「二酸化硫黄」に黄色の下線、FeSO₄・H₂O₂ と組版されて出る。
 *   同じ問題データなのに、対戦だけ「生の文字列」が見えていた。
 *
 * ■ 原因
 *   以前の実装は「数学だけ KaTeX、それ以外は素のテキスト」だった。
 *   問題データは演習画面向けに <u>…</u> や H2O のような
 *   「整形される前提の書き方」で書かれているので、
 *   整形を通さずに出せば当然そのまま見える。
 *
 * ■ 直し方：演習画面と同じ整形器を通す
 *   数学以外は、演習画面が使っている formatText（utils/textFormatter.tsx）を
 *   ★そのまま★ 使う。これが
 *     ・<u> → 黄色の下線マーカー
 *     ・H2O → H₂O、Fe2+ → Fe²⁺、SO42- → SO₄²⁻
 *     ・$…$ / \ce{…} → KaTeX、35Cl → ³⁵Cl（質量数）
 *   を一手に担っている。実測で、同じ文字列に対する出力 HTML は
 *   演習画面と ★バイト単位で一致★ する（tests/battleTextRendering.test.ts）。
 *
 * ■ 数学だけは従来どおり「積極的な数式検出」を使う
 *   数学の問題文は x^5/5 や 5/42 のように「数式であることを示す
 *   マークが無い」書き方が大半で、formatText の保守的な検出では
 *   分数や積分が組まれない。数学は splitMathPieces の auto モード
 *   （context:'math'）で従来どおり組む（tests/battleMathRendering.test.ts）。
 *
 * ■ 英語（リスニング・英文法）は prose で通す
 *   formatText は英字トークンを化学式とみなしてセリフ体にするので、
 *   英文に当てると "The" や "umbrella" まで化学式扱いになる。
 *   英語系は prose:true を渡して、下線・改行だけ処理する。
 *
 * ■ 採点に使う文字列は一切書き換えない
 *   ここは表示専用。question.label / options の文字列そのものは触らない。
 *
 * ■ memo にしている理由
 *   残り時間のカウントダウンで親が頻繫に再描画されるため、
 *   毎回 KaTeX を走らせると重い。text と subject が同じなら再計算しない。
 */
const PROSE_SUBJECTS = new Set(['english_listening', 'english_grammar', 'english_vocab', 'joho']);

export const BattleText = memo(function BattleText({ text, subject }: {
  text: string;
  subject: string;
}) {
  if (subject === 'math') {
    const pieces = splitMathPieces(text, { auto: true, context: 'math' });
    return (
      <span className="battle-text">
        {pieces.map((piece, index) => piece.kind === 'text'
          ? piece.value
          : <span key={index} dangerouslySetInnerHTML={{
              __html: sanitizeInlineHtml(renderLatex(piece.value, {
                displayMode: piece.display,
                ariaLabel: piece.source ?? piece.value,
              })),
            }} />)}
      </span>
    );
  }
  return (
    <span className="battle-text">
      {formatText(text, [], { prose: PROSE_SUBJECTS.has(subject) })}
    </span>
  );
});
