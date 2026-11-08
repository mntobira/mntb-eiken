import type { FC } from 'hono/jsx'
import { GRADE_PAGES, gradeHref, type Grade } from '../data/grades'
import { getGradeSet } from '../data/sets'

export const GradePage: FC<{ grade: Grade }> = ({ grade }) => {
  const set = getGradeSet(grade.id)
  if (!set) return <p>この級の教材は現在作成中です。</p>
  return <div class="grade-page library-page">
    <nav class="breadcrumb" aria-label="パンくずリスト"><a href="/">教材一覧</a><span> / </span><span>{grade.label}</span></nav>
    <header class="grade-heading"><div><span class="section-caption">{grade.level}</span><h1>英検{grade.label}<span>練習問題</span></h1><p>{grade.summary}</p></div><div class="grade-head-note"><strong>1回分を収録</strong><span>選択問題8問{set.writing.length ? '・記述2題' : ''}</span><span>解説・和訳付き</span></div></header>
    <section class="lesson-overview" aria-labelledby="lesson-title"><div class="lesson-overview-main"><span class="lesson-number">第1回</span><h2 id="lesson-title">{set.unit.theme}</h2><p>{set.unit.focus}</p><div class="lesson-facts"><span>選択問題8問</span><span>目安 {set.minutes}分</span>{set.writing.length>0 && <span>記述2題は別時間</span>}</div><div class="lesson-actions"><a class="btn-primary" href={`/exam/${set.id}`}>問題を解く <span aria-hidden="true">→</span></a><a class="btn-secondary" href={`/exam/${set.id}?show=answers`}>解説から確認する</a></div></div><aside class="lesson-outline"><h3>この回の内容</h3><dl><div><dt>語彙・文法</dt><dd>2問</dd></div><div><dt>読解</dt><dd>2本文・4問</dd></div><div><dt>リスニング</dt><dd>2問</dd></div>{set.writing.length>0 && <div><dt>記述</dt><dd>2題</dd></div>}</dl><p>本試験1回分の模試ではありません。</p></aside></section>
    <section id="practice-sets"><header class="section-title-row"><h2 id="practice-heading">分野を選んで取り組む</h2><span>選択問題</span></header><div class="practice-options"><a href={`/exam/${set.id}?part=reading#sec-R1`}><span class="practice-option-number">01</span><h3>語彙・文法</h3><p>文脈に合う語句を選ぶ</p><strong>2問から始める <span aria-hidden="true">→</span></strong></a><a href={`/exam/${set.id}?part=reading#sec-R2`}><span class="practice-option-number">02</span><h3>読解</h3><p>本文を読み、根拠を探す</p><strong>読解から始める <span aria-hidden="true">→</span></strong></a><a href={`/exam/${set.id}?part=listening`}><span class="practice-option-number">03</span><h3>リスニング</h3><p>会話と説明の内容を捉える</p><strong>2問を解く <span aria-hidden="true">→</span></strong></a></div><p class="practice-note">リーディングは語彙・文法2問と読解4問のセットです。途中の問題から始めることもできます。</p></section>
    {set.writing.length>0 && <section class="writing-preview"><header class="section-title-row"><div><h2>記述問題</h2><p class="section-description">解答例、語数カウント、見直しのポイントを使って練習します。</p></div><span>自動採点なし</span></header><div class="writing-preview-list">{set.writing.map((task,index)=><a href={`/exam/${set.id}#writing-${task.id}`}><span>{index+1}</span><div><h3>{task.title}</h3><p>{task.target}</p></div><span aria-hidden="true">→</span></a>)}</div></section>}
    <nav class="resource-links" aria-label="教材の資料"><a href={`/answers/${set.id}`}>解答・解説</a><a href={`/script/${set.id}`}>リスニング原稿・和訳</a><a href={`/sheet/${set.id}`}>印刷用の解答用紙</a></nav>
    <section class="other-grades" aria-labelledby="other-grades-heading"><header class="section-title-row"><h2 id="other-grades-heading">ほかの級</h2></header><nav class="other-grade-links">{GRADE_PAGES.filter(item=>item.id!==grade.id).map(item=><a href={gradeHref(item)}>{item.label}<span aria-hidden="true">→</span></a>)}</nav></section>
  </div>
}
