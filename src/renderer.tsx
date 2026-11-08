import { jsxRenderer } from 'hono/jsx-renderer'
import { GRADE_PAGES, findGrade, gradeHref } from './data/grades'

// The answer index is a grade-5 view, not the global grade selector.
export const GRADES = ['5級']

export const renderer = jsxRenderer(({ children }, c) => {
  const path = c.req.path
  const gradeId = path.startsWith('/grades/') ? path.split('/')[2] : '5'
  const currentGrade = findGrade(gradeId)
  const label = currentGrade?.label ?? '演習'
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={`マナトビの英検${label}教材ページ。5級は演習を収録し、4級から準1級は教材準備中です。`} />
        <title>マナトビ | 英検{label} 演習問題</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body>
        <a class="skip-link" href="#main">本文へスキップ</a>
        <header id="site-header" class="site-header manatobi-header">
          <a class="manatobi-brand" href="/" aria-label="マナトビ ホーム"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="158" height="50" /></a>
          <span class="site-edition">英検 / PRACTICE BOOK</span>
          <nav class="book-nav" aria-label="メインメニュー"><a href="/#grade-selection">級を選ぶ</a><a href="/">5級の問題一覧</a><a href="/#exam-format">5級の試験構成</a></nav>
        </header>
        <nav class="grade-navigation" aria-label="級を選ぶ">
          {GRADE_PAGES.map(grade => <a href={gradeHref(grade)} class={grade.id === gradeId ? 'grade-navigation-link is-active' : 'grade-navigation-link'} aria-current={grade.id === gradeId ? 'page' : undefined}>{grade.label}<small>{grade.available ? '演習あり' : '準備中'}</small></a>)}
        </nav>
        <main id="main">{children}</main>
        <footer id="site-footer" class="site-footer">
          <div class="footer-inner"><img class="footer-logo" src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><p class="footer-note">マナトビの学習用演習教材です。日本英語検定協会・神戸大学の公式教材ではなく、両者とは関係ありません。<br />5級の音声はブラウザによる合成音声です。画像・音声の生成スクリプトは別途用意しています。</p></div>
        </footer>
        <button type="button" class="to-top" id="to-top" aria-label="ページの先頭へ戻る">↑</button>
        <script src="/static/app.js" defer></script>
      </body>
    </html>
  )
})
