import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref } from '../data/grades'

export const Home: FC = () => (
  <div class="page book-home">
    <header class="book-hero"><p class="book-kicker">MANATOBI / INDEPENDENTLY AUTHORED</p><h1>考える力を、<br /><span>一問ずつ。</span></h1><p class="lead">5級から準1級まで。マナトビのオリジナル重点演習。</p><p>場面・本文・設問を新しく執筆し、正解の根拠と誤答の理由まで確認します。<br />本試験1回分の模試ではなく、各級8問から始める小さな学習ユニットです。</p><div class="hero-facts"><span>7級 / 選択式56問</span><span>3級以上は記述2課題ずつ</span><span>過去問の流用禁止</span></div><a class="btn-primary" href="#grade-selection">級を選んで始める →</a></header>
    <aside class="book-notice" id="originality-policy"><strong>教材制作の方針</strong><p>過去問の転載・言い換え・人物名や数値だけの差し替えは行いません。以前の過去問由来プールと生成経路は廃止しました。旧セットURLは配信停止です。</p><p>これは独立執筆の初版です。外部専門家の校閲・実測による難度検証・世界中の教材との網羅的照合は未実施です。今後も内容検証を重ねます。</p></aside>
    <section id="grade-selection"><div class="book-section-heading"><span>GRADE INDEX</span><h2>自分の級から、深く学ぶ。</h2></div><div class="grade-cards">{GRADE_PAGES.map(grade => <a class="grade-card" href={gradeHref(grade)}><strong>{grade.label}</strong><span>{grade.level}<br />オリジナル8問{['5','4'].includes(grade.id) ? '' : '＋記述2課題'}</span><span aria-hidden="true">→</span></a>)}</div></section>
    <section id="exam-format"><div class="book-section-heading"><span>LEARNING CYCLE</span><h2>解いて、根拠を説明する。</h2></div><div class="format-grid"><article><h3>選択式の重点演習</h3><p>語彙・文法2問、本文2本の読解4問、独自の会話・説明を聞く2問。文脈・根拠箇所・誤答の違いを確認します。タイマーは練習の目安です。</p></article><article><h3>記述は自己点検</h3><p>3級以上にはメール返信・意見表現・要約など、級に合わせた2課題。モデル答案は採点基準そのものではなく、構成を比較するための一例です。自動採点は行いません。</p></article></div></section>
  </div>
)
