import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref, type Grade } from '../data/grades'

export const GradePage: FC<{ grade: Grade }> = ({ grade }) => (
  <div class="page book-home grade-page">
    <nav class="breadcrumb" aria-label="パンくずリスト"><a href="/">マナトビ</a><span> / </span><span>英検{grade.label}</span></nav>
    <header class="book-hero">
      <p class="book-kicker">MANATOBI / ENGLISH PRACTICE / GRADE {grade.id.toUpperCase()}</p>
      <h1>英検{grade.label}<br /><span>演習問題</span></h1>
      <p class="lead">{grade.summary}</p>
      <div class="hero-facts"><span>{grade.level}</span><span>問題セット：未収録</span></div>
    </header>
    <section class="book-notice" aria-labelledby="grade-status-heading">
      <h2 id="grade-status-heading">この級の教材は準備中です</h2>
      <p>現在はページのみ公開しています。問題冊子・解答・解説・画像・音声はまだ収録していません。5級の問題をこの級の教材として表示することはありません。</p>
    </section>
    <section aria-labelledby="learning-topics-heading">
      <div class="book-section-heading"><span>LEARNING GUIDE</span><h2 id="learning-topics-heading">学習テーマ</h2></div>
      <ul class="grade-topics">{grade.topics.map((topic, index) => <li><span>0{index + 1}</span><strong>{topic}</strong></li>)}</ul>
      <p class="body-text">レベルは学習の目安です。ここに記載したテーマは教材の案内であり、本試験の全出題形式・時間・問題数の一覧ではありません。</p>
    </section>
    <section class="generation-panel" aria-labelledby="grade-materials-heading"><div><p class="book-kicker">MATERIALS STATUS</p><h2 id="grade-materials-heading">画像・音声の制作について</h2><p>リポジトリには、後から実行できる画像・音声生成スクリプトを配置しています。<br />現在の素材定義は5級のみです。この級は問題と放送原稿の作成後に追加します。</p></div></section>
    <section aria-labelledby="other-grades-heading"><div class="book-section-heading"><span>OTHER GRADES</span><h2 id="other-grades-heading">ほかの級を見る</h2></div>
      <div class="grade-cards">{GRADE_PAGES.filter(item => item.id !== grade.id).map(item => <a class="grade-card" href={gradeHref(item)}><strong>{item.label}</strong><span>{item.available ? '演習できます' : 'ページのみ / 教材準備中'}</span><span aria-hidden="true">→</span></a>)}</div>
    </section>
  </div>
)
