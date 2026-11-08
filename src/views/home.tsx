import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref } from '../data/grades'

export const Home: FC = () => (
  <div class="page book-home">
    <header class="book-hero">
      <h1>英検の練習問題</h1>
      <p class="lead">5級から準1級まで、取り組みたい級を選んでください。</p>
      <p>各級に語彙・文法、読解、リスニングの8問を用意しています。<br />3級以上は、英作文や要約にも取り組めます。</p>
      <a class="btn-primary" href="#grade-selection">級を選ぶ</a>
    </header>
    <section id="grade-selection">
      <div class="book-section-heading"><h2>級を選ぶ</h2></div>
      <div class="grade-cards">{GRADE_PAGES.map(grade => <a class="grade-card" href={gradeHref(grade)}><strong>{grade.label}</strong><span>{grade.level}<br />選択問題8問{['5','4'].includes(grade.id) ? '' : '・記述問題2題'}</span><span aria-hidden="true">→</span></a>)}</div>
    </section>
    <section id="exam-format">
      <div class="book-section-heading"><h2>使い方</h2></div>
      <div class="format-grid">
        <article><h3>問題を解いて、解説を読む</h3><p>語彙・文法2問、読解4問、リスニング2問に取り組めます。採点後は、正解の根拠とほかの選択肢が違う理由を確認してください。</p></article>
        <article><h3>書いた英文を見直す</h3><p>記述問題には解答例と見直しのポイントがあります。自分の答案と比べて、内容や表現を確認してください。記述問題の自動採点は行いません。</p></article>
      </div>
    </section>
    <details class="material-about" id="about-materials">
      <summary>教材について</summary>
      <p>マナトビが作成したオリジナルの練習問題です。過去問の転載や言い換えによる問題作成は行いません。</p>
      <p>本試験1回分の模試ではなく、内容を絞った短い練習です。日本英語検定協会の公式教材ではありません。</p>
    </details>
  </div>
)
