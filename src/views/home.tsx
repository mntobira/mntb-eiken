import type { FC } from 'hono/jsx'
import { SETS } from '../data/sets'

export const Home: FC = () => (
  <div class="page book-home">
    <nav class="breadcrumb" aria-label="パンくずリスト"><span>マナトビ</span><span> / </span><span>英検5級</span></nav>
    <header class="book-hero">
      <p class="book-kicker">MANATOBI / ENGLISH PRACTICE</p>
      <h1>英検5級<br /><span>演習問題集</span></h1>
      <p class="lead">本試験の形式で、一問ずつ確かめる。</p>
      <p>リーディング25問・リスニング25問。<br />問題冊子を開くように取り組める、マナトビの学習教材です。</p>
      <div class="hero-facts"><span>中学初級程度</span><span>リーディング 25分</span><span>リスニング 約22分</span></div>
      <div class="pill-row"><a class="btn-primary" href="/exam/2026-2">演習をはじめる →</a><a class="btn-secondary" href="#practice-sets">問題を選ぶ</a></div>
    </header>
    <aside class="book-notice">本教材は学習用の演習です。日本英語検定協会の公式サイト・公式問題集ではありません。収録問題には過去問を参考に再構成したものが含まれます。</aside>
    <section id="practice-sets" class="practice-sets">
      <div class="book-section-heading"><span>01 / PRACTICE</span><h2>問題を選ぶ</h2></div>
      {SETS.map((set, index) => (
        <article class="practice-set">
          <div class="set-number">0{index + 1}</div>
          <div class="set-detail"><p class="book-kicker">GRADE 5 / 50 QUESTIONS</p><h3>{set.round} 形式の演習</h3><p>参照試験：{set.date}　{set.note}</p>
            <div class="set-links"><a href={`/exam/${set.id}?part=reading`}>リーディング 25問</a><a href={`/exam/${set.id}?part=listening`}>リスニング 25問</a><a href={`/answers/${set.id}`}>解答一覧</a><a href={`/script/${set.id}`}>放送原稿</a></div>
          </div>
          <a class="btn-secondary" href={`/exam/${set.id}`}>問題を開く →</a>
        </article>
      ))}
    </section>
    <section class="generation-panel" id="generate-practice"><div><p class="book-kicker">MORE PRACTICE</p><h2>問題を組み替えて、もう一度。</h2><p>文法テンプレートと収録問題を組み合わせた演習セットを作ります。</p></div><a class="btn-primary" href="/new">新しい演習を作る →</a></section>
    <section id="exam-format" class="format-section">
      <div class="book-section-heading"><span>02 / EXAM FORMAT</span><h2>本試験の構成</h2></div>
      <div class="format-grid"><article><h3>READING <small>25分 / 25問</small></h3><dl><div><dt>大問1 / 15問</dt><dd>短文の語句空所補充</dd></div><div><dt>大問2 / 5問</dt><dd>会話文の文空所補充</dd></div><div><dt>大問3 / 5問</dt><dd>日本文付き短文の語句整序</dd></div></dl><p>選択肢は各問4つ。語句整序は1番目と3番目の組合せを選びます。</p></article>
      <article><h3>LISTENING <small>約22分 / 25問</small></h3><dl><div><dt>第1部 / 10問</dt><dd>会話の応答文選択 / 3択</dd></div><div><dt>第2部 / 5問</dt><dd>会話の内容一致選択 / 4択</dd></div><div><dt>第3部 / 10問</dt><dd>イラストの内容一致選択 / 3択</dd></div></dl><p>本アプリでは合成音声を何度でも再生できます。イラストは説明文等による代替です。</p></article></div>
    </section>
  </div>
)
