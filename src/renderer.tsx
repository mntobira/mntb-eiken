import { jsxRenderer } from 'hono/jsx-renderer'
import { GRADE_PAGES, findGrade, gradeHref } from './data/grades'
import { getSet } from './data/sets'

export const renderer = jsxRenderer(({ children }, c) => {
  const path = c.req.path
  const gradeId = path.startsWith('/grades/') ? path.split('/')[2] : getSet(path.split('/').at(-1) ?? '')?.grade
  const currentGrade = findGrade(gradeId ?? '')
  const label = currentGrade ? `英検${currentGrade.label}` : '英検'
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={`${label}の練習問題。語彙・文法、読解、リスニングと記述問題に取り組めます。`} />
        <title>マナトビ | {label} 練習問題</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body>
        <a class="skip-link" href="#main">本文へスキップ</a>
        <header id="site-header" class="site-header manatobi-header">
          <a class="manatobi-brand" href="/" aria-label="マナトビ ホーム"><img src="/static/manatobi-logo-gray.png" alt="マナトビ" width="158" height="50" /></a>
          <span class="site-edition">英検の練習問題</span>
          <nav class="book-nav" aria-label="メインメニュー"><a href="/#grade-selection">級を選ぶ</a><a href="/#about-materials">教材について</a><a href="/#exam-format">学び方</a></nav>
        </header>
        <nav class="grade-navigation" aria-label="級を選ぶ">
          {GRADE_PAGES.map(grade => <a href={gradeHref(grade)} class={grade.id === gradeId ? 'grade-navigation-link is-active' : 'grade-navigation-link'} aria-current={grade.id === gradeId ? 'page' : undefined}>{grade.label}<small>{grade.available ? '8問' : '準備中'}</small></a>)}
        </nav>
        <main id="main">{children}</main>
        <footer id="site-footer" class="site-footer">
          <div class="footer-inner"><img class="footer-logo" src="/static/manatobi-logo-gray.png" alt="マナトビ" width="126" height="40" /><p class="footer-note">マナトビの学習用教材です。日本英語検定協会の公式教材ではありません。<br />音声はブラウザの読み上げ機能を使用しています。</p></div>
        </footer>
        <button type="button" class="to-top" id="to-top" aria-label="ページの先頭へ戻る">↑</button>
        <script src="/static/app.js" defer></script>
      </body>
    </html>
  )
})
