import { jsxRenderer } from 'hono/jsx-renderer'
import { GRADE_PAGES, findGrade, gradeHref } from './data/grades'
import { getSet } from './data/sets'

export const renderer = jsxRenderer(({ children }, c) => {
  const path = c.req.path
  const gradeId = path.startsWith('/grades/') ? path.split('/')[2] : getSet(path.split('/').at(-1) ?? '')?.grade
  const currentGrade = findGrade(gradeId ?? '')
  const label = currentGrade ? `英検${currentGrade.label}` : '英検 全級'
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={`${label}の独立執筆オリジナル重点演習。正解の根拠・誤答理由・記述の自己点検で学びます。`} />
        <title>マナトビ | {label} オリジナル重点演習</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body>
        <a class="skip-link" href="#main">本文へスキップ</a>
        <header id="site-header" class="site-header manatobi-header">
          <a class="manatobi-brand" href="/" aria-label="マナトビ ホーム"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="158" height="50" /></a>
          <span class="site-edition">英検 / PRACTICE BOOK</span>
          <nav class="book-nav" aria-label="メインメニュー"><a href="/#grade-selection">級を選ぶ</a><a href="/#originality-policy">制作方針</a><a href="/#exam-format">学び方</a></nav>
        </header>
        <nav class="grade-navigation" aria-label="級を選ぶ">
          {GRADE_PAGES.map(grade => <a href={gradeHref(grade)} class={grade.id === gradeId ? 'grade-navigation-link is-active' : 'grade-navigation-link'} aria-current={grade.id === gradeId ? 'page' : undefined}>{grade.label}<small>{grade.available ? '独自8問' : '準備中'}</small></a>)}
        </nav>
        <main id="main">{children}</main>
        <footer id="site-footer" class="site-footer">
          <div class="footer-inner"><img class="footer-logo" src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><p class="footer-note">マナトビの学習用演習教材です。日本英語検定協会・神戸大学の公式教材ではなく、両者とは関係ありません。<br />音声はブラウザによる合成音声です。各級の独立執筆ユニットは本試験1回分の模試ではありません。</p></div>
        </footer>
        <button type="button" class="to-top" id="to-top" aria-label="ページの先頭へ戻る">↑</button>
        <script src="/static/app.js" defer></script>
      </body>
    </html>
  )
})
