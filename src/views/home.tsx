import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref } from '../data/grades'
import { getGradeSet } from '../data/sets'

export const Home: FC = () => (
  <div class="library-page">
    <header class="library-heading"><div><span class="section-caption">マナトビの英語教材</span><h1>英検の練習問題</h1><p>語彙、読解、リスニング。<br />自分の級を選んで、問題と解説に取り組めます。</p></div><dl class="library-summary"><div><dt>対象の級</dt><dd>5級〜準1級</dd></div><div><dt>各回の内容</dt><dd>選択8問<span>＋3級以上は記述2題</span></dd></div><div><dt>復習</dt><dd>根拠・和訳・解き直し</dd></div></dl></header>
    <section id="grade-selection"><header class="section-title-row"><div><h2>級から選ぶ</h2><p class="section-description">各級の第1回を収録しています。目安のレベルから選んでください。</p></div><span class="collection-count">7つの級</span></header>
      <div class="grade-cards">{GRADE_PAGES.map(grade => {
        const set = getGradeSet(grade.id)
        return <a class="grade-card" href={gradeHref(grade)}><div class="grade-card-top"><strong>{grade.label}</strong><span>{grade.level}</span></div><div class="grade-card-body"><p class="grade-card-theme">{set?.unit.theme}</p><p>{grade.topics.slice(0,2).join('・')}</p></div><div class="grade-card-foot"><span>第1回 ・ 選択8問{set?.writing.length ? '＋記述2題' : ''}</span><span class="grade-card-link">教材を見る <span aria-hidden="true">→</span></span></div></a>
      })}</div>
    </section>
    <section id="exam-format" class="learning-guide"><header class="section-title-row"><h2>学習の進め方</h2></header><ol class="learning-steps"><li><span class="step-number">1</span><div><h3>問題を解く</h3><p>本文と設問を見ながら、1問ずつ解答します。迷った問題には見直しの印を付けられます。</p></div></li><li><span class="step-number">2</span><div><h3>根拠を確認する</h3><p>採点後は、正解を決める英文と選択肢の違いを確認。本文と会話の和訳も読めます。</p></div></li><li><span class="step-number">3</span><div><h3>間違いを解き直す</h3><p>間違えた問題だけを、正解が見えない状態で解き直します。記述は解答例と比較して見直します。</p></div></li></ol></section>
    <details class="material-about" id="about-materials"><summary>教材について</summary><p>マナトビが作成したオリジナルの練習問題です。過去問の転載や言い換えによる問題作成は行いません。</p><p>各回は内容を絞った練習で、本試験1回分の模試ではありません。日本英語検定協会の公式教材ではありません。音声はブラウザの読み上げ機能を使います。</p><p>解答や作文は保存・送信されません。ページを閉じると消えるため、必要な答案はコピーしてください。</p></details>
  </div>
)
