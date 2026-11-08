import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref, type Grade } from '../data/grades'
import { getGradeSet } from '../data/sets'

export const GradePage: FC<{ grade: Grade }> = ({ grade }) => {
  const set = getGradeSet(grade.id)
  if (!set) return <p>この級の教材は現在作成中です。</p>
  return (
    <div class="page book-home grade-page">
      <nav class="breadcrumb" aria-label="パンくずリスト"><a href="/">マナトビ</a><span> / </span><span>英検{grade.label}</span></nav>
      <header class="book-hero">
        <p class="book-kicker">MANATOBI / ORIGINAL FOCUS UNIT</p>
        <h1>英検{grade.label}<br /><span>オリジナル重点演習</span></h1>
        <p class="lead">{set.unit.theme}</p><p>{set.unit.focus}</p>
        <div class="hero-facts"><span>{grade.level}</span><span>選択式8問</span><span>{set.writing.length ? `記述${set.writing.length}課題 / 自己点検` : '基礎の確認'}</span><span>練習目安 {set.minutes}分</span></div>
        <div class="pill-row"><a class="btn-primary" href={`/exam/${set.id}`}>重点演習を始める →</a><a class="btn-secondary" href={`/exam/${set.id}?show=answers`}>根拠・誤答理由を読む</a></div>
      </header>
      <aside class="book-notice"><h2 id="grade-status-heading">独立執筆の初版を収録しました</h2><p>本文・会話・設問・選択肢・解説を新しく執筆しています。過去問の転載・言い換え・人物名や数値だけの差し替えは行いません。本試験1回分の模試ではなく、学習項目を絞った重点演習です。</p><p>{set.provenance.review}</p></aside>
      <section id="practice-sets" aria-labelledby="practice-heading"><div class="book-section-heading"><span>01 / PRACTICE</span><h2 id="practice-heading">収録内容</h2></div>
        <div class="format-grid"><article><h3>読む・考える <small>語彙・文法2問 / 読解4問</small></h3><ul class="note-list"><li>{set.unit.readings[0].title}</li><li>{set.unit.readings[1].title}</li></ul><a class="btn-secondary" href={`/exam/${set.id}?part=reading`}>リーディング6問</a></article>
        <article><h3>聞いて整理する <small>独自の会話・説明2問</small></h3><ul class="note-list">{set.unit.listenings.map(block => <li>{block.title}</li>)}</ul><a class="btn-secondary" href={`/exam/${set.id}?part=listening`}>リスニング2問</a></article></div>
        <div class="set-links" style="margin-top:24px"><a href={`/sheet/${set.id}`}>解答用紙</a><a href={`/answers/${set.id}`}>解答一覧</a><a href={`/script/${set.id}`}>放送原稿</a>{set.writing.length > 0 && <a href={`/exam/${set.id}#writing-section`}>記述課題・モデル答案</a>}</div>
      </section>
      <section class="generation-panel"><div><p class="book-kicker">HOW TO REVIEW</p><h2>正解の番号より、根拠を確かめる。</h2><p>1. 根拠となる箇所を自分で探す。<br />2. 採点後に各選択肢の理由を照合する。<br />3. 同じ誤読をしないための一言メモを残す。</p><p>記述は自動採点せず、モデル答案と観点別チェックで見直します。画像・音声の有料生成は実行せず、生成用スクリプトを同梱しています。</p></div></section>
      <section aria-labelledby="other-grades-heading"><div class="book-section-heading"><span>OTHER GRADES</span><h2 id="other-grades-heading">ほかの級</h2></div><div class="grade-cards">{GRADE_PAGES.filter(item => item.id !== grade.id).map(item => <a class="grade-card" href={gradeHref(item)}><strong>{item.label}</strong><span>オリジナル重点演習</span><span aria-hidden="true">→</span></a>)}</div></section>
    </div>
  )
}
