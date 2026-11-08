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
        <h1>英検{grade.label}<br /><span>練習問題</span></h1>
        <p class="lead">{set.unit.theme}</p><p>{set.unit.focus}</p>
        <div class="hero-facts"><span>{grade.level}</span><span>選択問題8問</span>{set.writing.length > 0 && <span>記述問題{set.writing.length}題</span>}<span>目安 {set.minutes}分</span></div>
        <div class="pill-row"><a class="btn-primary" href={`/exam/${set.id}`}>問題を解く</a><a class="btn-secondary" href={`/exam/${set.id}?show=answers`}>解答・解説</a></div>
      </header>
      <p class="practice-note">この回は選択問題8問の練習です。本試験1回分の問題数・構成とは異なります。</p>
      <section id="practice-sets" aria-labelledby="practice-heading">
        <div class="book-section-heading"><h2 id="practice-heading">この回の問題</h2></div>
        <div class="format-grid">
          <article><h3>リーディング <small>語彙・文法2問・読解4問</small></h3><ul class="note-list"><li>{set.unit.readings[0].title}</li><li>{set.unit.readings[1].title}</li></ul><a class="btn-secondary" href={`/exam/${set.id}?part=reading`}>リーディング6問</a></article>
          <article><h3>リスニング <small>会話・説明2問</small></h3><ul class="note-list">{set.unit.listenings.map(block => <li>{block.title}</li>)}</ul><a class="btn-secondary" href={`/exam/${set.id}?part=listening`}>リスニング2問</a></article>
        </div>
        <div class="set-links" style="margin-top:24px"><a href={`/sheet/${set.id}`}>解答用紙</a><a href={`/answers/${set.id}`}>解答一覧</a><a href={`/script/${set.id}`}>リスニング原稿</a>{set.writing.length > 0 && <a href={`/exam/${set.id}#writing-section`}>記述問題・解答例</a>}</div>
      </section>
      <section class="generation-panel"><div><h2>復習のしかた</h2><p>間違えた問題は、本文や音声のどこに答えがあったかを確認しましょう。解説には、ほかの選択肢が違う理由も載せています。</p>{set.writing.length > 0 && <p>記述問題は、解答例と見直しのポイントを使って確認してください。記述問題の自動採点は行いません。</p>}</div></section>
      <section aria-labelledby="other-grades-heading"><div class="book-section-heading"><h2 id="other-grades-heading">ほかの級</h2></div><div class="grade-cards">{GRADE_PAGES.filter(item => item.id !== grade.id).map(item => <a class="grade-card" href={gradeHref(item)}><strong>{item.label}</strong><span>練習問題8問</span><span aria-hidden="true">→</span></a>)}</div></section>
    </div>
  )
}
